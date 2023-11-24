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

class Face:
    pts: np.ndarray | list[np.ndarray]
    uvs: np.ndarray         # 2x4 array that multiplied with (x,y,z,1) gives (uv_x,uv_y)
    basis: np.ndarray

    def __init__(self, pts):
        self.pts = pts
        _, basis = geometry3.Polygon.oriented_basis(pts)
        signed_area = geometry3.Polygon.signed_area(pts, basis)
        basis[0] = basis[0] if signed_area > 0.0 else -basis[0]
        self.basis = basis
        self.uvs = np.zeros((2, 4))

    def uv(self, p):
        return self.uvs @ np.array((*p, 1.0))

    def plane(self):
        p0 = self.pts[0]
        return geometry3.Plane(self.basis[0], np.dot(self.basis[0], p0))

    def area(self):
        return geometry3.Polygon.signed_area(self.pts, self.basis)
    
    def initialize_uvs(self):
        """Initialize uvs to match x,y coords.
        """
        self.uvs = np.eye(2, 4)

    def propagate_to(self, face: 'Face'):
        """Propagates uv-coordinates across a common edge from self to other face
        """
        # Create a list of vertices that both faces share:
        # common_pts = []
        # for p1 in face1.pts:
        #     for p2 in face2.pts:
        #         if np.linalg.norm(p1-p2) < 1.0e-9:
        #             common_pts.append(p1)
        #             break

        # Idea: after rotating normals, the uv maps have to agree
        plane1 = self.plane()
        plane2 = face.plane()
        n1 = self.basis[0]
        n2 = face.basis[0]
        n = normalize(np.cross(n1, n2))
        plane3 = geometry3.Plane(n, 0.0)
        p0 = geometry3.Plane.intersection(plane1, plane2, plane3)
        rot = Rotation.from_rotvec(np.arccos(np.dot(n1, n2))*n).as_matrix()
        rot4 = np.eye(4, 4)
        rot4[0:3,0:3] = rot
        tr = lambda offset: np.ndarray(((1.0,0,0,offset[0]), (0,1.0,0,offset[1]), (0,0,1.0,offset[2]), (0,0,0,1.0)))
        face.uvs = self.uvs @ tr(p0) @ rot4.T @ tr(-p0)

    def __repr__(self):
        return f"Face(n={len(self.pts)})"
    
def normalize(p):
    return p / np.linalg.norm(p)

def setup_faces(data, name):
    mesh = data[name]
    for face in mesh.fs:
        for k, p in face.pts:
            face.uvs[k] = np.array((np.dot(p, E1), np.dot(p, E2)))

def propagate(face1: Face, face2: Face):
    """Propagates uv-coordinates across a common edge from face1 to face2
    """
    # Create a list of vertices that both faces share:
    # common_pts = []
    # for p1 in face1.pts:
    #     for p2 in face2.pts:
    #         if np.linalg.norm(p1-p2) < 1.0e-9:
    #             common_pts.append(p1)
    #             break

    # Idea: after rotating normals, the uv maps have to agree
    plane1 = face1.plane()
    plane2 = face2.plane()
    n1 = face1.basis[0]
    n2 = face2.basis[0]
    n = normalize(np.cross(n1, n2))
    plane3 = geometry3.Plane(n, 0.0)
    p0 = geometry3.Plane.intersection(plane1, plane2, plane3)
    rot = Rotation.from_rotvec(np.arccos(np.dot(n1, n2))*n).as_matrix()
    rot4 = np.eye(4, 4)
    rot4[0:3,0:3] = rot
    tr = lambda offset: np.ndarray(((1.0,0,0,offset[0]), (0,1.0,0,offset[1]), (0,0,1.0,offset[2]), (0,0,0,1.0)))
    face2.uvs = face1.uvs @ tr(p0) @ rot4.T @ tr(-p0)


def run(data):
    for name in ["cushions", "slate", "rails", "rail_sights", "liners", "casing"]:
        print(f"{name}:")
        print(data[name])
        data[name] = data[name].triangulate()
        print(data[name])
        print()
        
        setup_faces(data, name)

        # Assign uvs here
    return data

if __name__ == "__main__":
    pass