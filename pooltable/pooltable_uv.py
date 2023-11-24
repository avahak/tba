# 3) Todo UV coords: cushions: [k1,(k1,k2),(k1,k3),(k2,k4),..] order or propagation
# slate: uv=xy or top,bottom uv=xy, custom taking normal from original slice and 
#       extending according to distance on curve
# liners: x=param on path, y=easy after that
# rails: uv=xy
# casing: bottom uv=xy, categorize other faces according to their normal 
#       to x+,x-,y+,y- and for each category just do trivial projection

# 4) (optional?) pack uv-polygons
#       Kinda needed for diamonds

import numpy as np
from scipy.spatial.transform import Rotation
from typing import Any
import geometry3

E1 = np.array((1.0, 0.0, 0.0))
E2 = np.array((0.0, 1.0, 0.0))
E3 = np.array((0.0, 0.0, 1.0))

INCH = 0.0254
DEGREE = np.pi/180.0
    
def propagate(face_from, face):
    """Propagates uv-coords across a common edge from self to other face.
    """
    # Create a list of vertices that both faces share:
    common_pts = []
    for kp_from, p_from in enumerate(face_from.pts):
        for kp_to, p_to in enumerate(face.pts):
            if np.linalg.norm(p_from-p_to) < 1.0e-9:
                common_pts.append((kp_from, kp_to))
    if len(common_pts) < 2:
        return False
    for k in range(2):
        face.uvs[common_pts[k][1]] = face_from.uvs[common_pts[k][0]]
    z1 = complex(np.dot(face.basis[0], face.pts[common_pts[0][1]]), np.dot(face.basis[1], face.pts[common_pts[0][1]]))
    z2 = complex(np.dot(face.basis[0], face.pts[common_pts[1][1]]), np.dot(face.basis[1], face.pts[common_pts[1][1]]))
    w1 = complex(face.uvs[common_pts[0][1]][0], face.uvs[common_pts[0][1]][1])
    w2 = complex(face.uvs[common_pts[1][1]][0], face.uvs[common_pts[1][1]][1])
    # z1 -> w1, z2 -> w2 in a similarity
    # w = A*z+B: w1-A*z1 = B, w2 = A*z2+B = A*z2 + w1 - A*z1
    # w2-w1 = A*(z2-z1): A = (w2-w1)/(z2-z1), B = w1-A*z1
    A = (w2-w1) / (z2-z1)
    B = w1 - A*z1
    for kp, p in enumerate(face.pts):
        z = complex(np.dot(face.basis[0], p), np.dot(face.basis[1], p))
        w = A*z + B
        # if (kp == common_pts[0][1]):
        #     print(face.uvs[common_pts[0][1]], " vs ", w)
        # if (kp == common_pts[1][1]):
        #     print(face.uvs[common_pts[1][1]], " vs ", w)
        face.uvs[kp] = np.array((w.real, w.imag))

    return True

    # # Idea: after rotating normals, the uv maps have to agree
    # plane1 = self.plane()
    # plane2 = face.plane()
    # n1 = self.basis[0]
    # n2 = face.basis[0]
    # n = normalize(np.cross(n1, n2))
    # plane3 = geometry3.Plane(n, 0.0)
    # p0 = geometry3.Plane.intersection(plane1, plane2, plane3)
    # rot = Rotation.from_rotvec(np.arccos(np.dot(n1, n2))*n).as_matrix()
    # rot4 = np.eye(4, 4)
    # rot4[0:3,0:3] = rot
    # tr = lambda offset: np.ndarray(((1.0,0,0,offset[0]), (0,1.0,0,offset[1]), (0,0,1.0,offset[2]), (0,0,0,1.0)))
    # return uv_map @ tr(p0) @ rot4.T @ tr(-p0)

def normalize(p):
    return p / np.linalg.norm(p)

def setup_faces(data, name):
    mesh = data[name]
    for face in mesh.fs:
        for k, p in enumerate(face.pts):
            face.uvs[k] = np.array((np.dot(p, E1), np.dot(p, E2)))

def face_in_plane(face, plane):
    for p in face.pts:
        if plane.distance(p) > 1.0e-9:
            return False
    return True

def unwrap_cushions(data):
    """Idea: propagate the uv-coordinates from face to face in order given by 
    propagation_order.
    """
    mesh = data["cushions"]
    propagation_order = (("rail_top", "end1"), ("rail_top", "end2"), ("rail_top", "rail_back"), ("rail_top", "rubber_top"), ("rubber_top", "rubber_bottom"), ("rubber_bottom", "slate"))
    plane_names = ("end1", "end2", "rail_back", "rail_top", "rubber_top", "rubber_bottom", "slate")
    plane_faces = { name: set() for name in plane_names }
    face_to_plane = {}
    for plane_name in plane_names:
        for cushion_name in ("A", "B", "C", "D", "E", "F"):
            for face in mesh.fs:
                if face_in_plane(face, data["planes"][cushion_name][plane_name]):
                    plane_faces[plane_name].add(face)
                    face_to_plane[face] = plane_name
    propagating = plane_faces["rail_top"]
    propagated_already = set()
    while propagating:
        propagating_next = set()
        for face_to in mesh.fs:
            for face_from in propagating:
                if (face_to_plane[face_from], face_to_plane[face_to]) not in propagation_order:
                    if face_to_plane[face_from] != face_to_plane[face_to]:
                        continue
                result = propagate(face_from, face_to)
                if result and (not face_to in propagated_already):
                    propagating_next.add(face_to)
        propagated_already.update(propagating)
        propagating = propagating_next

def unwrap_liners(data):
    pass

def unwrap_casing(data):
    pass

def run(data):
    for name in ["cushions", "slate", "rails", "rail_sights", "liners", "casing"]:
        setup_faces(data, name)
    unwrap_cushions(data)
    unwrap_liners(data)
    unwrap_casing(data)
    for name in ["cushions", "slate", "rails", "rail_sights", "liners", "casing"]:
        pass
        # print(f"{name}:")
        # print(data[name])
        data[name] = data[name].triangulate()
        # print(data[name])
        # print()
        
    return data

if __name__ == "__main__":
    pass