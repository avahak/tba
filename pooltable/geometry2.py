"""Code for polygon triangulation (from OpenGL testing).
"""

from collections.abc import Sequence
import numpy as np
import math, cmath

def isclose(v1: np.ndarray, v2: np.ndarray, *, rel_tol=1e-09, abs_tol=1e-20) -> bool:
    """Scuffed isclose for numpy arrays needed because np.isclose and np.allclose
    are based on elementwise comparisons instead of comparisons as vectors.
    """
    return np.linalg.norm(v1-v2) <= max(rel_tol * max(np.linalg.norm(v1), np.linalg.norm(v2)), abs_tol)

class LineSegment2():
    z1: np.ndarray
    z2: np.ndarray

    def __init__(self, z1: np.ndarray, z2: np.ndarray):
        self.z1 = z1
        self.z2 = z2

    #def is_degenerate(self) -> bool:
    #    """Return True iff z1 and z2 are very close to each other.
    #    """
    #    return isclose(z1, z2)

    def param(self, t: float) -> np.ndarray:
        return (1-t)*self.z1+t*self.z2

    def length(self):
        return np.linalg.norm(self.z2-self.z1)

    def __repr__(self):
        return f"{self.__class__.__name__}({self.z1}, {self.z2})"

def dist_z_ls(z: np.ndarray, ls: LineSegment2):
    """Returns (d,t) where t is the parameter that minimizes
    dist(z,ls.param(t)) and d is the minimal value.
    """
    if isclose(ls.z1, ls.z2):
        return (np.linalg.norm(z-ls.z1), 0)
    v1 = z-ls.z1
    v2 = ls.z2-ls.z1
    t = np.clip(np.dot(v1,v2)/np.dot(v2,v2), 0, 1)
    d = np.linalg.norm(v1-t*v2)
    return d, t

def dist_ls_ls(ls1: LineSegment2, ls2: LineSegment2):
    if isclose(ls1.z1, ls1.z2):
        # ls1 is degenerate
        d, t = dist_z_ls(ls1.z1, ls2)
        return d, 0, t
    if isclose(ls2.z1, ls2.z2):
        # ls2 is degenerate
        d, t = dist_z_ls(ls2.z1, ls1)
        return d, t, 0

    dz1 = ls1.z2-ls1.z1
    dz2 = ls2.z2-ls2.z1
    dz10 = dz1/np.linalg.norm(dz1)
    dz20 = dz2/np.linalg.norm(dz2)
    if isclose(dz10, dz20) or isclose(dz10, -dz20):
        # ls1 and ls2 are parallel
        t1 = np.dot(ls2.z1-ls1.z1, dz1)/np.dot(dz1, dz1)
        t2 = np.dot(ls2.z2-ls1.z1, dz1)/np.dot(dz1, dz1)
        if t1 <= 0 and t2 <= 0:
            d, t = dist_z_ls(ls1.z1, ls2)
            return d, 0, t
        if t1 >= 1 and t2 >= 1:
            d, t = dist_z_ls(ls1.z2, ls2)
            return d, 1, t
        if t1 >= 0 and t1 <= 1:
            d, t = dist_z_ls(ls2.z1, ls1)
            return d, t, 0
        if t2 >= 0 and t2 <= 1:
            d, t = dist_z_ls(ls2.z2, ls1)
            return d, t, 1
        d, t = dist_z_ls(ls1.z1, ls2)
        return d, 0, t

    # segments non-degenerate non-parallel: just solve for paramters
    M = np.column_stack((dz1, -dz2))
    t1, t2 = np.linalg.inv(M) @ (ls2.z1-ls1.z1)
    t1 = np.clip(t1, 0, 1)
    t2 = np.clip(t2, 0, 1)
    return np.linalg.norm(ls1.param(t1)-ls2.param(t2)), t1, t2

class Polygon2():
    """A simple 2d-polygon. Not necessarily positively oriented.
    """
    zs: np.ndarray
    checked: bool   # True means polygon is verified to be simple

    def __init__(self, zs):
        if isinstance(zs, np.ndarray):
            self.zs = zs
        else:
            self.zs = np.array([z for z in zs])
        self.checked = False

    @classmethod
    def create(cls, zs):
        poly = Polygon2(zs)
        poly.check()
        if poly.checked:
            return poly
        return None

    def check(self) -> bool:
        """Checks if the polygon is simple, returns the
        result of the check, and sets checked=True if
        the polygon passed the check.
        """
        for k, z in enumerate(self.zs):
            zn = self.zs[(k+1)%self.n]
            ls1 = LineSegment2(z, zn)
            for j in range(k-1):
                if j == 0 and k == self.n-1:
                    continue
                ls2 = LineSegment2(self.zs[j], self.zs[j+1])
                d, t1, t2 = dist_ls_ls(ls1, ls2)
                if isclose(ls1.param(t1), ls2.param(t2)):
                    self.checked = False
                    return False
        self.checked = True
        return True

    @property
    def n(self):
        return len(self.zs)

    def __repr__(self):
        return f"{self.__class__.__name__}({self.zs})"

    def param(self, t: float) -> np.ndarray:
        s = t-self.n*math.floor(t/self.n)
        si = int(s)
        sf = s-si
        return (1-sf)*self.zs[si]+sf*self.zs[(si+1)%self.n]

    def signed_area(self) -> float:
        area = 0
        n = self.n
        for k,z in enumerate(self.zs):
            zn = self.zs[(k+1)%n]
            area += z[0]*zn[1] - zn[0]*z[1]
        return area/2

    def area(self) -> float:
        return np.abs(self.signed_area())

    def __signed_distance(self, z: np.ndarray, bk: int, bt: float) -> float:
        """Returns signed distance to boundary given that closest
        boundary point is self.param(bk+bt) where bk is int and 0<=bt<=1.
        """
        if math.isclose(bt, 1):
            bk = (bk+1)%self.n
            bt = 0
        z_prev = self.zs[bk]
        z_next = self.zs[(bk+1)%self.n]
        zb = (1-bt)*z_prev+bt*z_next
        if math.isclose(1-bt, 1):
            zb = z_prev
            z_prev = self.zs[(bk-1)%self.n]
        # now polygon boundary near zb consists of nondegenerate line segments z_prev->zb->z_next
        if isclose(z, zb):
            # z is on boundary
            return 0
        w = z-zb
        dz1 = zb-z_prev
        dz2 = z_next-zb
        ang1 = cmath.phase((w[0]+1j*w[1]) / (dz1[0]+1j*dz1[1]))
        ang2 = cmath.phase((dz2[0]+1j*dz2[1]) / (dz1[0]+1j*dz1[1]))
        sign = np.sign(self.signed_area())
        if ang1 > ang2:
            return -sign*np.linalg.norm(w)
        return sign*np.linalg.norm(w)

    def signed_distance(self, z: np.ndarray):
        """Return distance and parameter t s.t. self.param(t) is the
        closest distance realizing point on the boundary.
        """
        closest_found = [float('inf'), 0, 0.0]
        for k in range(self.n):
            ls = LineSegment2(self.zs[k], self.zs[(k+1)%self.n])
            d, t = dist_z_ls(z, ls)
            if d < closest_found[0]:
                closest_found = d, k, t
        return self.__signed_distance(z, *closest_found[1:3]), sum(closest_found[1:3])

    def triangulate(self) -> Sequence[int]:
        """Slow and dirty, O(n^3).
        """
        tri = []
        rem = [k for k in range(self.n)]

        pair_usable = np.full((self.n, self.n), False)
        for k1 in range(self.n):
            for k2 in range(k1+2, self.n):
                if k1 == 0 and k2 == self.n-1:
                    # we don't want ls1 to be part of the boundary of self
                    continue
                ls1 = LineSegment2(self.zs[k1], self.zs[k2])
                for j in range(self.n):
                    jn = (j+1)%self.n
                    if j == k1 or j == k2 or jn == k1 or jn == k2:
                        continue
                    ls2 = LineSegment2(self.zs[j], self.zs[jn])
                    d, t1, t2 = dist_ls_ls(ls1, ls2)
                    if isclose(ls1.param(t1), ls2.param(t2)):
                        break
                else:
                    ls1_mid = ls1.param(0.5)
                    d, t = self.signed_distance(ls1_mid)
                    if (d < 0) and not (isclose(self.param(t), ls1_mid)):
                        pair_usable[k1,k2] = True
                        pair_usable[k2,k1] = True

        while len(rem) > 3:
            m = len(rem)
            for k in range(m):
                prev = rem[(k-1)%m]
                next = rem[(k+1)%m]
                if pair_usable[prev,next]:
                    break
            else:
                # for loop ended without break
                print('ERROR! geometry2d.py: triangulate(..) could not finish.')
            tri.append([rem[(k-1)%m], rem[k], rem[(k+1)%m]])
            rem.pop(k)
        tri.append(rem)
        return tri

def main():
    print("geometry2d.py testing")

if __name__ == '__main__':
    main()