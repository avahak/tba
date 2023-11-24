import numpy as np
import numpy.typing as npt
from collections.abc import Iterable, Sequence
from typing import Any

def normalize(p):
    return p / np.linalg.norm(p)

def closest_point(p, a, b, c):
    """Computes the closest point on the triangle a, b, c to p.
    """
    # Below lambda_a, lambda_b, lambda_c are barycentric coordinates for p*=proj_{abc plane}(p).
    # Lambda_c, lambda_b can be obtained requiring that a+lambda_b*(b-a)+lambda_c*(c-a) = p* 
    # and then testing this by taking inner product of both sides with b-a and c-a. 
    # After that \lambda_a=1-\lambda_b-\lambda_c. The formulas below are optimized forms
    # that avoid the need for intermediate calculations. I am not aware of the derivation 
    # of these formulas, only the proof that they work.
    # See https://github.com/embree/embree/blob/master/tutorials/common/math/closest_point.h
    ab = b - a
    ac = c - a

    # Closest point a:
    ap = p - a
    ab_ap = np.dot(ab, ap)
    ac_ap = np.dot(ac, ap)
    if (ab_ap <= 0.0 and ac_ap <= 0.0):
        return a

    # Closest point b:
    bp = p - b
    ab_bp = np.dot(ab, bp)
    ac_bp = np.dot(ac, bp)
    if (ab_bp >= 0.0 and ac_bp <= ab_bp):
        return b

    # Closest point c:
    cp = p - c
    ab_cp = np.dot(ab, cp)
    ac_cp = np.dot(ac, cp)
    if ((ac_cp >= 0.0) and (ab_cp <= ac_cp)):
        return c
    
    # Closest point on edge (a, b): (lambda_c is barycentric coordinate coefficient for c)
    lambda_c = ab_ap*ac_bp - ab_bp*ac_ap    # = ab_ab*ac_ap - ab_ac*ab_ap
    if (lambda_c <= 0.0 and ab_ap >= 0.0 and ab_bp <= 0.0):
        v = ab_ap / (ab_ap - ab_bp)
        return a + v*ab
    
    # Closest point on edge (a, c):
    lambda_b = ab_cp*ac_ap - ab_ap*ac_cp    # = ac_ac*ab_ap - ab_ac*ac_ap
    if (lambda_b <= 0.0 and ac_ap >= 0.0 and ac_cp <= 0.0):
        v = ac_ap / (ac_ap - ac_cp)
        return a + v*ac
    
    # Closest point on edge (b, c):
    lambda_a = ab_bp*ac_cp - ab_cp*ac_bp    # = bc_bc*ba_bp - bc_ba*bc_bp
    if (lambda_a <= 0.0 and (ac_bp-ab_bp) >= 0.0 and (ab_cp-ac_cp) >= 0.0):
        v = (ac_bp-ab_bp) / ((ac_bp-ab_bp) + (ab_cp-ac_cp))
        return b + v*(c-b)
    
    # Closest point inside the triangle:
    return (lambda_a*a + lambda_b*b + lambda_c*c) / (lambda_a + lambda_b + lambda_c)


# Represents plane defined by (x,y,z): abc.(x,y,z)=d (point-normal form)
class Plane:
    abc: npt.ArrayLike      # Unit normal of the plane.
    d: float

    def __init__(self, abc, d):
        """Note: abc is normalized.
        """
        self.abc = abc / np.linalg.norm(abc)
        self.d = d

    def __str__(self):
        return f"{self.abc}, {self.d}"

    def signed_distance(self, p):
        return np.dot(self.abc, p) - self.d

    def distance(self, p):
        return np.abs(self.signed_distance(p))

    def reflect(self, p):
        """Reflects a point or a list of points. 
        TODO write better
        """
        if isinstance(p, np.ndarray):
            return p - 2*self.signed_distance(p)*self.abc
        elif isinstance(p, Iterable):
            return [self.reflect(q) for q in p]
        return None
    
    def __repr__(self):
        return f"Plane(abc={self.abc}, d={self.d})"
    
    @staticmethod
    def translate(plane, length):
        return Plane(np.copy(plane.abc), plane.d+length)

    @staticmethod
    def from_points(p1, p2, p3):
        n = np.cross(p3-p1, p2-p1)
        n = n / np.linalg.norm(n)
        return Plane(n, np.dot(n, p1))

    @staticmethod    
    def intersection(p1, p2, p3): 
        a = np.array([p1.abc, p2.abc, p3.abc])
        b = np.array([p1.d, p2.d, p3.d])
        return np.linalg.solve(a, b)
    
# class Polygon3:
#     @staticmethod 
#     def oriented_basis(points):
#         """Returns an oriented basis of R^3 with PCA.
#         """
#         points = np.array(points)
#         centroid = np.mean(points, axis=0)
#         cov_matrix = np.cov((points - centroid).T)
#         eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)
#         eigenvectors = eigenvectors.T
#         if np.linalg.det(eigenvectors) < 0.0:
#             eigenvalues[0] = -eigenvalues[0]
#             eigenvectors[0] *= -1.0
#         return eigenvalues, eigenvectors

#     @staticmethod 
#     def signed_area(points, basis):
#         """Computes signed area of a polygon lying on a plane in R^3 with Shoelace formula.
#         The first component of basis, basis[0] should point to the normal direction
#         of the polygon plane.
#         """
#         e1, e2 = basis[1], basis[2]
#         area = 0.0
#         n = len(points)
#         for k in range(n):
#             p, p1 = points[k], points[(k+1)%n]
#             area += (np.dot(e2, p) + np.dot(e2, p1))*(np.dot(e1, p) - np.dot(e1, p1))
#         return 0.5*area

def main():
    pass
    # if False:
    #     p = np.random.randn(3)
    #     a = np.random.randn(3)
    #     b = np.random.randn(3)
    #     c = np.random.randn(3)
    #     print(f"{p = }\n{a = }\n{b = }\n{c = }\n")
    #     q = closest_point(p, a, b, c)
    #     qq = closest_point(q, a, b, c)
    #     print(f"{q = }\n{qq =}")
    # if True:
    #     points = np.random.randn(3, 3)*np.array((0.1, 1.0, 0.5))
    #     _, basis = Polygon.oriented_basis(points)
    #     print(basis[0])
    #     print(basis[1])
    #     print(basis[2])
    #     print(np.linalg.det(basis))
    #     print("area: ", Polygon.signed_area(points, basis))


if __name__ == "__main__":
    main()