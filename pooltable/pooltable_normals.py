"""Idea: take vertices and faces given by pooltable.py and 
try to compute normal vectors for the model automatically by smoothing
over the raw face normals (also computed here) over all the faces
that share that point and that are close to the same orientation as the 
original face (ANGLE_LIMIT).
"""

import json, pickle
import numpy as np
import geometry

E1 = np.array((1.0, 0.0, 0.0))
E2 = np.array((0.0, 1.0, 0.0))
E3 = np.array((0.0, 0.0, 1.0))

INCH = 0.0254
DEGREE = np.pi/180.0
ANGLE_LIMIT_DEFAULT = 60.0*DEGREE
ANGLE_LIMIT_SPECIAL = { "casing": 60.0*DEGREE }

def normalize(p):
    return p / np.linalg.norm(p)

def unique_indexing(points):
    """Returns list of unique points and indexing from points to the unique points.
    """
    u_points = []
    indexing_p_to_up = []
    for p in points:
        u_index = None
        for uk, up in enumerate(u_points):
            if np.linalg.norm(up-p) < 1.0e-12:
                u_index = uk
                break
        if u_index is None:
            # p is not found in u_points:
            indexing_p_to_up.append(len(u_points))
            u_points.append(p)
        else:
            # p is found in u_points:
            indexing_p_to_up.append(u_index)
    return u_points, indexing_p_to_up

def mesh_from(data_mesh):
    # Here just for additional index_vertex_to_faces info.
    mesh = {}
    mesh["vertices"] = data_mesh["vertices"]
    mesh["faces"] = data_mesh["faces"]
    mesh["index_vertex_to_faces"] = [[] for _ in data_mesh["vertices"]]
    for fk, face in enumerate(data_mesh["faces"]):
        for v in face:
            mesh["index_vertex_to_faces"][v].append(fk)
    return mesh

def compute_planarity(points):
    # Returns measure of planarity for the points.
    eigenvalues, _ = geometry.Polygon.oriented_basis(points)
    if eigenvalues[0] < 1.0e-20:
        return float('inf')
    return eigenvalues[1]/eigenvalues[0]

def compute_normal(points):
    # Returns normal for the points.
    _, basis = geometry.Polygon.oriented_basis(points)
    signed_area = geometry.Polygon.signed_area(points, basis)
    n = basis[0] if signed_area > 0.0 else -basis[0]
    if len(points) <= 4: 
        n0 = normalize(np.cross(points[1]-points[0], points[2]-points[0]))
        if np.dot(n, n0) < 0.0:
            print("PROBLEM! Normal has wrong sign.")
    return n

def test_planarity(mesh):
    # Tests the planarity of faces in the mesh.
    for f in mesh["faces"]:
        face_points = [mesh["vertices"][k] for k in f]
        if len(face_points) == 3:
            continue
        planarity = compute_planarity(face_points)
        if abs(planarity) < 1.0e12:
            print(f"{len(face_points) = }, {planarity:.2e}")

def compute_flat_normals(mesh):
    # Computes the normal associated to each face when only that face is considered.
    mesh["flat_normals"] = [None for f in mesh["faces"]]
    for f_index, f in enumerate(mesh["faces"]):
        face_points = [mesh["vertices"][k] for k in f]
        n = compute_normal(face_points)
        mesh["flat_normals"][f_index] = n
        # print(face_points, n, "\n")

def is_slate_cutoff_face(f, mesh, name, data):
    # Returns true if f is one of the slate faces that are at the x or y cutoff.
    v_avg = np.average([mesh["vertices"][v] for v in f], axis=0)
    if (name == "slate") and ((np.abs(np.abs(v_avg[0])-data["specs"]["TABLE_LENGTH"]/2.0-data["specs"]["CUSHION_WIDTH"]) < 1.0e-9) 
            or (np.abs(np.abs(v_avg[1])-data["specs"]["TABLE_LENGTH"]/4.0-data["specs"]["CUSHION_WIDTH"]) < 1.0e-9)):
        return True
    return False

def compute_smooth_normals(mesh, name, data):
    # Adds smooth_normals to the mesh. These are averaged normals.
    mesh["smooth_normals"] = [(len(f) * [None]) for f in mesh["faces"]]
    for f_index, f in enumerate(mesh["faces"]):
        n0 = mesh["flat_normals"][f_index]
        for v_index, v in enumerate(f):
            close_normals = []
            for f_index2 in mesh["index_vertex_to_faces"][v]:
                n = mesh["flat_normals"][f_index2]
                if np.dot(n, n0) > np.cos(ANGLE_LIMIT_SPECIAL.get(name, ANGLE_LIMIT_DEFAULT)):
                    if not is_slate_cutoff_face(mesh["faces"][f_index2], mesh, name, data):
                        close_normals.append(n)
            n = normalize(np.sum(close_normals, axis=0)) if len(close_normals) > 0 else n0
            mesh["smooth_normals"][f_index][v_index] = n

def select_normals(mesh, name, data):
    """Select between normals from smooth_normals and flat_normals
    based on custom rules.
    """
    mesh["normals"] = [(len(f) * [None]) for f in mesh["faces"]]
    mesh["normal_list"] = []
    for f_index, f in enumerate(mesh["faces"]):
        n0 = mesh["flat_normals"][f_index]
        v_avg = np.average([mesh["vertices"][v] for v in f], axis=0)
        for v_index, v in enumerate(f):
            n1 = mesh["smooth_normals"][f_index][v_index]

            n = n1
            if (np.linalg.norm(n0-E3) < 1.0e-9) or (np.linalg.norm(n0+E3) < 1.0e-9):
                n = n0
            if is_slate_cutoff_face(f, mesh, name, data):
                n = n0
            if (name == "cushions") or (name == "rails") or (name == "rail_sights"):
                n = n0

            mesh["normals"][f_index][v_index] = len(mesh["normal_list"])
            mesh["normal_list"].append(n)

def write_obj(mesh, name):
    vertices = mesh["vertices"]
    unique_vertices, indexing_vertices = unique_indexing(vertices)
    faces = mesh["faces"]
    unique_normals, indexing_normals = unique_indexing(mesh["normal_list"])

    file_name = f"{name}_n.obj"
    with open(file_name, "w") as file:
        for v in unique_vertices:
            file.write(f"v {v[0]} {v[1]} {v[2]}\n")
        for v in unique_normals:
            file.write(f"vn {v[0]} {v[1]} {v[2]}\n")
        for fk, f in enumerate(faces):
            s = "f "
            for vk, v in enumerate(f):
                j = mesh["normals"][fk][vk]
                s += f"{indexing_vertices[v]+1}//{indexing_normals[j]+1} "
            file.write(s + "\n")
    print(f"File {file_name} written.")

def main():
    with open("pooltable_all_data.pkl", "rb") as f:
        data = pickle.load(f)
    # print(f"{data.keys() = }")
    # mesh = data["cushions"]
    for name in ["cushions", "slate", "rails", "rail_sights", "liners", "casing"]:
    # for name in ["rails"]:
        mesh = mesh_from(data[name])
        test_planarity(mesh)
        compute_flat_normals(mesh)
        compute_smooth_normals(mesh, name, data)
        select_normals(mesh, name, data)
        write_obj(mesh, name)

if __name__ == "__main__":
    main()