# WPA https://wpapool.com/equipment-specifications/
# BCA https://cdn.ymaws.com/bca-pool.com/resource/resmgr/imported/BCAEquipmentSpecifications_2008.pdf
# Naming system for cushions (A,..,F) and pockets (1,..,6): 
# 1 A 2 B 3 
# F - - - C 
# 6 E 5 D 4

# Creates files:
#   - pooltable.json: measurements of a pooltable and their explanations
#   - cushions.obj - cushions
#   - slate.obj - slate
#   - liners.obj - pocket liners
#   - rails.obj - rails
#   - casing.obj - casing

import json, pickle
import numpy as np
import pooltable_specs, pooltable_geometry, pooltable_normals, pooltable_uv

def convert_numpy_to_lists(obj):
    """Converts numpy ndarray objects to lists so that they can be serialized.
    """
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (list, tuple)):
        return [convert_numpy_to_lists(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_numpy_to_lists(value) for key, value in obj.items()}
    else:
        return obj

# def write_obj_file(file_name, obj_data):
#     with open(file_name, "w") as file:
#         for v in obj_data["vertices"]:
#             file.write(f"v {v[0]} {v[1]} {v[2]}\n")
#         for f in obj_data["faces"]:
#             s = "f "
#             for k in f:
#                 s += f"{k+1} "
#             file.write(s + "\n")

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

def write_obj_file(mesh, name):
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

def run():
    data = pooltable_specs.run()
    data = pooltable_geometry.run(data)
    data = pooltable_normals.run(data)
    data = pooltable_uv.run(data)

    WRITE_FILE = True
    if WRITE_FILE:
        # Write to file:
        # with open("pooltable_metadata.json", "w") as f:
        #     f.write(json.dumps(convert_numpy_to_lists(meta), indent=4))
        # with open("pooltable_all_data.pkl", "wb") as f:
        #     pickle.dump(data, f)
        for name in ["cushions", "slate", "liners", "casing", "rails", "rail_sights"]:
            write_obj_file(data["normals"][name], name)

if __name__ == '__main__':
    run()