import numpy as np
import numpy.typing as npt
from collections.abc import Iterable, Sequence
from typing import Any
import geometry2

def normalize(p):
    return p / np.linalg.norm(p)

def unique_indexing(points, EPSILON=1.0e-9):
    """Returns list of unique points and indexing from points to the unique points.
    """
    if isinstance(points, list):
        points = {k: p for k, p in enumerate(points)}
    u_points = []
    indexing_p_to_up = {}
    for key, p in points.items():
        for uk, up in enumerate(u_points):
            if np.linalg.norm(up-p) < EPSILON:
                indexing_p_to_up[key] = uk
                break
        else:
            # p not found in u_points:
            indexing_p_to_up[key] = len(u_points)
            u_points.append(p)
    return (u_points, indexing_p_to_up)

class Face3: 
    """A polygonal face of a 3D mesh. The best fitting plane for the face
    is spanned by self.basis[0] and self.basis[1] and the correctly oriented 
    normal of the face is self.basis[2].
    """
    pts: Sequence[np.ndarray]
    ns: Sequence[np.ndarray]
    uvs: Sequence[np.ndarray]
    basis: Sequence[np.ndarray]     # (b1,b2,b3, p0)
    
    def __init__(self, pts):
        self.pts = pts
        self.ns = len(pts)*[None]
        self.uvs = len(pts)*[None]
        self.basis = self.oriented_basis(pts)

    @property
    def n(self):
        return len(self.pts)
    
    @staticmethod 
    def oriented_basis(points):
        """Computes an oriented basis of R^3 using PCA.
        Finds oriented orthonormal basis (b1,b2,b3) such that b3 is the
        best fitting normal for the face and returns (b1,b2,b3,p0), where p0
        is a point in the polygon.
        """
        points = np.array(points)
        p0 = np.mean(points, axis=0)    # centroid
        cov_matrix = np.cov((points - p0).T)
        basis,_,_ = np.linalg.svd(cov_matrix)
        b1, b2, b3 = basis[:,0], basis[:,1], basis[:,2]
        if np.linalg.det(basis) < 0.0:
            b3 = -b3

        xy_list = [np.array([np.dot(p-p0, b1), np.dot(p-p0, b2)]) for p in points]
        poly = geometry2.Polygon2(xy_list)
        if poly.signed_area() < 0.0:
            b1, b2, b3 = b2, b1, -b3

        return (b1, b2, b3, p0)
    
    def triangulate(self) -> list:
        """Triangulates the polygon and returns the triangles as a list.
        """
        if len(self.pts) == 3:
            return [self]
        xy = [np.array([np.dot(p-self.basis[3],self.basis[0]), np.dot(p-self.basis[3],self.basis[1])]) for p in self.pts]
        poly = geometry2.Polygon2(xy)
        tri = poly.triangulate()
        faces = []
        for ind in tri:
            face = Face3(np.array([self.pts[ind[k]] for k in range(3)]))
            for kp, _ in enumerate(face.pts):
                face.ns[kp] = self.ns[ind[kp]]
                face.uvs[kp] = self.uvs[ind[kp]]
            faces.append(face)
        return faces
    
    def __repr__(self):
        s = f"Face3(n={self.n}"
        for p in self.pts:
            s += f", {p}"
        return s + ")"
    
class Mesh3:
    fs: Sequence[Face3]

    def __init__(self):
        self.fs = []

    def add_face(self, face: Face3):
        self.fs.append(face)

    def mesh_indexing(self):
        # Indexes: 
        # f->v (face def), f->e, 
        # e->f, e->v (edge def), 
        # v->f, v->e
        # ---
        # vertices = list of unique pts
        # fv = just pick matching index from vertices
        # vf = fill vf by going through fv and storing each
        # edges = list of unique vertex pairs (from faces) in form k1*vn+k2 (k1=min,k2=max)
        # ev = trivial
        # ve = inverse fill from ev
        # fe = directly from face
        # ef = filling inverses again by looping through fe and storing inverses

        # vertices:
        vertices, indexing_p_to_up = unique_indexing({(fk, pk): p for fk, face in enumerate(self.fs) for pk, p in enumerate(face.pts)})
        vn = len(vertices)
        # fv, vf:
        fv = [[] for face in self.fs]
        vf = [[] for p in vertices]
        for kf, face in enumerate(self.fs):
            for kp, p in enumerate(face.pts):
                u_index = indexing_p_to_up[(kf,kp)]
                fv[kf].append(u_index)
                vf[u_index].append(kf)
        # edges, ev, ve:
        edges = {}
        ev = []
        ve = [[] for p in vertices]
        fe = [[] for face in self.fs]
        en = 0
        for kf, face in enumerate(self.fs):
            for kp, p in enumerate(face.pts):
                kp1 = (kp+1) % face.n
                fv0 = fv[kf][kp]
                fv1 = fv[kf][kp1]
                e_index = min(fv0, fv1)*vn + max(fv0, fv1)
                if e_index not in edges:
                    edges[e_index] = en
                    ev.append((fv0, fv1))
                    ve[fv0].append(en)
                    ve[fv1].append(en)
                    en += 1
                fe[kf].append(edges[e_index])
        # ef:
        ef = [[] for e in edges]
        for kf, face in enumerate(self.fs):
            for kp, p in enumerate(face.pts):
                ef[fe[kf][kp]].append(kf)
        
        mesh_indexing = {}
        mesh_indexing["f"] = self.fs
        mesh_indexing["v"] = vertices
        # mesh_indexing["e"] = edges
        mesh_indexing["ve"] = ve
        mesh_indexing["vf"] = vf
        mesh_indexing["ev"] = ev
        mesh_indexing["fv"] = fv
        mesh_indexing["ef"] = ef
        mesh_indexing["fe"] = fe
        return mesh_indexing
    
    def triangulate(self):
        tri_mesh = Mesh3()
        for face in self.fs:
            tri_face = face.triangulate()
            for tri in tri_face:
                tri_mesh.add_face(tri)
        return tri_mesh

    def is_triangle_mesh(self) -> bool:
        """Returns True if every face has 3 vertices, False otherwise.
        """
        for face in self.fs:
            if face.n != 3:
                return False
        return True
    
    def __repr__(self):
        face_count = {}  # n:c means mesh has c n-gons
        for face in self.fs:
            face_count[face.n] = face_count.get(face.n, 0)+1
        s = ''
        for count in sorted(face_count):
            name = f'{count}-gon'
            if count == 3:
                name = 'tri'
            if count == 4:
                name = 'quad'
            s = s+f', #{name}={face_count[count]}'
        return f'Mesh3(#faces={len(self.fs)}{s})'

def main():
    print("Testing Mesh3")
    for k in range(10000):
        pts = np.random.randn(6, 3)

        b1, b2, b3, p0 = Face3.oriented_basis(pts)
        # print(f"{b1 = }, {b2 = }, {b3 = }, {p0 = }")

if __name__ == "__main__":
    main()