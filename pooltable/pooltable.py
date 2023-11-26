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
import mesh3

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

def write_mtl_file(data, file_name):
    with open(file_name, "w") as file:
        for name in ("cushions", "slate", "rails", "rail_sights", "liners", "casing"):
            file.write(f"newmtl material_{name}\n")
            file.write("Ka 0.1 0.1 0.1\n")
            file.write("Kd 0.7 0.7 0.7\n")
            file.write("Ks 0.5 0.5 0.5\n")
            file.write("map_Kd atlas.jpg\n\n")
    print(f"File {file_name} written.")

def write_obj_file(mesh, file_name, name):
    vertices = {(fk, pk): p for fk, face in enumerate(mesh.fs) for pk, p in enumerate(face.pts)}
    unique_vertices, indexing_vertices = mesh3.unique_indexing(vertices)
    normals = {(fk, nk): n for fk, face in enumerate(mesh.fs) for nk, n in enumerate(face.ns)}
    unique_normals, indexing_normals = mesh3.unique_indexing(normals)
    uvs = {(fk, k): uv for fk, face in enumerate(mesh.fs) for k, uv in enumerate(face.uvs)}
    unique_uvs, indexing_uvs = mesh3.unique_indexing(uvs)

    with open(file_name, "w") as file:
        file.write(f"mtllib pooltable.mtl\n")
        for v in unique_vertices:
            file.write(f"v {v[0]} {v[1]} {v[2]}\n")
        for v in unique_normals:
            file.write(f"vn {v[0]} {v[1]} {v[2]}\n")
        for v in unique_uvs:
            file.write(f"vt {v[0]} {v[1]}\n")
        file.write(f"usemtl material_{name}\n")
        for fk, face in enumerate(mesh.fs):
            s = "f "
            for vk, v in enumerate(face.pts):
                s += f"{indexing_vertices[(fk,vk)]+1}/{indexing_uvs[(fk,vk)]+1}/{indexing_normals[(fk,vk)]+1} "
            file.write(s + "\n")
    print(f"File {file_name} written.")

def run():
    data = pooltable_specs.run()
    data = pooltable_geometry.run(data)
    data = pooltable_normals.run(data)
    data = pooltable_uv.run(data)

    # Triangulate everything
    for name in ("cushions", "slate", "rails", "rail_sights", "liners", "casing"):
        for key, mesh in data[name].items():
            print(f"{name = }, {key = }, {mesh = }")
            data[name][key] = mesh.triangulate()

    WRITE_FILE = True
    if WRITE_FILE:
        # Write to file:
        write_mtl_file(data, "obj/pooltable.mtl")
        for name in ("cushions", "slate", "liners", "casing", "rails", "rail_sights"):
            merged_mesh = mesh3.Mesh3.merge(data[name].values())
            write_obj_file(merged_mesh, f"obj/{name}.obj", name)

if __name__ == '__main__':
    run()