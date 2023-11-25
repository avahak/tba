"""Idea: take vertices and faces given by pooltable.py and 
try to compute normal vectors for the model automatically by smoothing
over the raw face normals (also computed here) over all the faces
that share that point and that are close to the same orientation as the 
original face (ANGLE_LIMIT).
"""

import json, pickle
import numpy as np
import geometry3, mesh3

E1 = np.array((1.0, 0.0, 0.0))
E2 = np.array((0.0, 1.0, 0.0))
E3 = np.array((0.0, 0.0, 1.0))

INCH = 0.0254
DEGREE = np.pi/180.0
ANGLE_LIMIT_DEFAULT = 60.0*DEGREE
ANGLE_LIMIT_SPECIAL = { "casing": 60.0*DEGREE }

def normalize(p):
    return p / np.linalg.norm(p)

def test_planarity(mesh: mesh3.Mesh3):
    # Tests the planarity of faces in the mesh.
    for f in mesh.fs:
        xs = [np.dot(p-f.basis[3], f.basis[0]) for p in f.pts]
        ys = [np.dot(p-f.basis[3], f.basis[1]) for p in f.pts]
        zs = [np.dot(p-f.basis[3], f.basis[2]) for p in f.pts]
        bbox_dims = [np.max(xs)-np.min(xs), np.max(ys)-np.min(ys), np.max(zs)-np.min(zs)]
        if bbox_dims[2] == 0.0:
            return float('inf')
        planarity = np.min([bbox_dims[0], bbox_dims[1]]) / bbox_dims[2]
        if abs(planarity) < 1.0e12:
            raise Exception(f"Nonplanar face: {planarity = }")

def is_slate_cutoff_face(data, name, face):
    # Returns true if f is one of the slate faces that are at the x or y cutoff.
    v_avg = face.basis[3]
    if (name == "slate") and ((np.abs(np.abs(v_avg[0])-data["specs"]["TABLE_LENGTH"]/2.0-data["specs"]["CUSHION_WIDTH"]) < 1.0e-9) 
            or (np.abs(np.abs(v_avg[1])-data["specs"]["TABLE_LENGTH"]/4.0-data["specs"]["CUSHION_WIDTH"]) < 1.0e-9)):
        return True
    return False

def compute_smooth_normals(data, name, mesh, mesh_indexing):
    # Adds smooth normals to the mesh. These are averaged normals.
    for fk, face in enumerate(mesh_indexing["f"]):
        n0 = face.basis[2]
        for pk, p in enumerate(mesh_indexing["fv"][fk]):
            close_normals = []
            for f_other in mesh_indexing["vf"][p]:
                face_other = mesh.fs[f_other]
                n = mesh.fs[f_other].basis[2]
                if np.dot(n, n0) > np.cos(ANGLE_LIMIT_SPECIAL.get(name, ANGLE_LIMIT_DEFAULT)):
                    if not is_slate_cutoff_face(data, name, face_other):
                        close_normals.append(n)
            n = normalize(np.sum(close_normals, axis=0)) if len(close_normals) > 0 else n0
            face.ns[pk] = n

def select_normals(data, name, mesh):
    """Select between normals from smooth_normals and flat_normals
    based on custom rules.
    """
    for fk, face in enumerate(mesh.fs):
        n0 = face.basis[2]
        for n_index, n1 in enumerate(face.ns):
            n = n1
            if (np.linalg.norm(n0-E3) < 1.0e-9) or (np.linalg.norm(n0+E3) < 1.0e-9):
                n = n0
            if is_slate_cutoff_face(data, name, face):
                n = n0
            if (name == "cushions") or (name == "rails") or (name == "rail_sights"):
                n = n0

            face.ns[n_index] = n

def run(data):
    data["normals"] = dict()
    for name in ["cushions", "slate", "rails", "rail_sights", "liners", "casing"]:
        for mesh in data[name].values():
            mesh_indexing = mesh.mesh_indexing()
            test_planarity(mesh)
            compute_smooth_normals(data, name, mesh, mesh_indexing)
            select_normals(data, name, mesh)
    return data

if __name__ == "__main__":
    pass