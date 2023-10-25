import numpy as np
import numpy.typing as npt

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
        return p - 2*self.signed_distance(p)*self.abc

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