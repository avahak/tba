import numpy as np
import numpy.typing as npt
from collections.abc import Iterable

def normalize(p):
    return p / np.linalg.norm(p)

def closest_point(p, a, b, c):
    """Computes the closest point on the triangle a, b, c to p.
    """
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
    
    # Below lambda_c, lambda_b can be obtained by setting p*=projection of p to plane of triangle
    # and requiring that a+lambda_b*(b-a)+lambda_c*(c-a) = p* and then testing this 
    # by taking inner product with b-a and c-a.
    # lambda_a below is pretty far from "bc_bc*ba_bp - bc_ba*bc_bp" that is obtained
    # by this scheme but evaluates to the same value by at least brute force term by term calculation.

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
    
def main():
    p = np.random.randn(3)
    a = np.random.randn(3)
    b = np.random.randn(3)
    c = np.random.randn(3)

    print(f"{p = }\n{a = }\n{b = }\n{c = }\n")

    closest_point(p, a, b, c)


if __name__ == "__main__":
    main()