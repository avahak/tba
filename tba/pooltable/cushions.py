# Naming system for cushions (A,..,F) and pockets (1,..,6): 
# 1 A 2 B 3 
# F - - - C 
# 6 E 5 D 4

# Creates files:
#   - pooltable.json: measurements of a pooltable and their explanations
#   - cushions.obj: vertices and faces of the cushions of that table
#   - cushions.json: same as .obj but in a .json file

import numpy as np
import json
from itertools import batched

import geometry

# Defines pool table measurements and their explanations
def create_pooltable_json():
    def add_spec(obj, name, value, comment):
        obj[name] = value
        if (comment is not None):
            obj["COMMENTS"][name] = comment

    INCH = 0.0254
    OUNCE = 0.0283495231
    DEGREE = np.pi/180.0
    comment = "Measurements are in SI units, angles in radians. Sources: WPA rules: wpapool.com/equipment-specifications, BCA rules: bca-pool.com/associations/7744/files/BCAEquipmentSpecifications_2008.pdf"
    specs = {"COMMENTS": {"GENERAL": comment}}

    # BALL
    comment = "Billiard ball radius, WPA requires 0.5*2.25 inches"
    add_spec(specs, "BALL_RADIUS", 0.5*2.25*INCH, comment)
    comment = "Billiard ball mass"
    add_spec(specs, "BALL_MASS", 0.163, comment)
    
    # CUSHION
    comment = "Width of cloth-covered cushion (as seen from above), WPA requires [1.875,2]."
    add_spec(specs, "CUSHION_WIDTH", 2.0*INCH, comment)
    comment = "Height of nose of cushion (approx 1.43\"), WPA requires [62.5%,64.5%], BCA requires [63.2,65.277]"
    add_spec(specs, "CUSHION_NOSE_HEIGHT", 2*0.635*specs["BALL_RADIUS"], comment)
    # The nose area of the cushion is made from a k66 rubber cushion piece.
    # Think of k66 rubber as a triangle with known sides but 
    # with possible extra geometry (curve) instead of a line segment for its top edge. 
    # We ignore the curve on top and just consider the isosceles triangle its corners make.
    comment = "K66 rubber base length (base against cushion)"
    add_spec(specs, "CUSHION_RUBBER_BASE_LENGTH", (1.0 + 3.0/16.0)*INCH, comment)
    comment = "K66 rubber side length (top and bottom)"
    add_spec(specs, "CUSHION_RUBBER_SIDE_LENGTH", (1.0 + 1.0/8.0)*INCH, comment)
    comment = "Angle between the base of the k66 cushion rubber and a vertical line (16deg to 27deg)."
    add_spec(specs, "CUSHION_K66_PROFILE_ANGLE", 23.0*DEGREE, comment)
    # Ignoring extra geometry, the angle alpha at nose between the two basespoints is alpha,
    # with sin(alpha/2) = ((1+3/16)/2) / (1+1/16). Therefore alpha=63.611deg.
    # Angles of k66: alpha=63.711deg (CUSHION_NOSE_ANGLE), beta=58.145deg, beta=58.145deg.
    comment = "Angle at nose of cushion to basepoints of rubber cushion"
    add_spec(specs, "CUSHION_NOSE_ANGLE", 2.0*np.arcsin(0.5*specs["CUSHION_RUBBER_BASE_LENGTH"]/specs["CUSHION_RUBBER_SIDE_LENGTH"]), comment)
    # The angle between the table bed and cushion is pi/2-(beta-CUSHION_K66_PROFILE_ANGLE)=alpha/2+CUSHION_K66_PROFILE_ANGLE:
    comment = "Angle between cushion and table bed"
    add_spec(specs, "CUSHION_BED_ANGLE", specs["CUSHION_NOSE_ANGLE"]/2.0+specs["CUSHION_K66_PROFILE_ANGLE"], comment)
    # from CUSHION_ANGLE we can derive the following (k66 cushion rubber has known sides so can compute angle at nose (RUBBER_ANGLE) and from this the rest):
    comment = "Small angle between cushion and horizon."
    add_spec(specs, "CUSHION_SLOPE", specs["CUSHION_NOSE_ANGLE"]/2.0-specs["CUSHION_K66_PROFILE_ANGLE"], comment)
    
    # CORNER_POCKET
    comment = "Length of corner-pocket mouth (distance from nose to nose), WPA requires [4.5,4.625], BCA requires [4.875,5.125]"
    add_spec(specs, "CORNER_POCKET_MOUTH", 4.625*INCH, comment)
    comment = "Horizontal pocket cut angle for corner-pocket, WPA requires 142, BCA requires 142"
    add_spec(specs, "CORNER_POCKET_HORIZONTAL_ANGLE", 142.0*DEGREE, comment)
    comment = "Shelf depth for corner-pocket, WPA requires [1,2.25], BCA requires [1.625,1.875]"
    add_spec(specs, "CORNER_POCKET_SHELF", 1.5*INCH, comment)
    comment = "Radius of the corner pocket circle, maybe 3\""
    add_spec(specs, "CORNER_POCKET_RADIUS", 3.25*INCH, comment)
    comment = "Vertical pocket cut angle, WPA requires [12,15], BCA requires 12"
    add_spec(specs, "CORNER_POCKET_VERTICAL_ANGLE", 12.0*DEGREE, comment)

    # SIDE_POCKET
    comment = "Length of side-pocket mouth (distance from nose to nose) (usually corner pocket mouth +0.5), WPA requires [5,5.125], BCA requires [5.375,5.625]"
    add_spec(specs, "SIDE_POCKET_MOUTH", specs["CORNER_POCKET_MOUTH"] + 0.5*INCH, comment)
    comment = "Horizontal pocket cut angle for side-pocket, WPA requires 104, BCA requires 103"
    add_spec(specs, "SIDE_POCKET_HORIZONTAL_ANGLE", 104.0*DEGREE, comment)
    comment = "Shelf depth for side-pocket, WPA, BCA require [0,0.375]"
    add_spec(specs, "SIDE_POCKET_SHELF", 0.1875*INCH, comment)
    comment = "Radius of the side pocket circle, maybe 3\""
    add_spec(specs, "SIDE_POCKET_RADIUS", 3.25*INCH, comment)
    comment = "Vertical pocket cut angle, WPA,BCA require [12,15]"
    add_spec(specs, "SIDE_POCKET_VERTICAL_ANGLE", 12.0*DEGREE, comment)

    # TABLE
    #pool table (PT) constants:
    comment = "Distance from nose to nose, WPA requires 100 for 9-foot table. Width is always half of length."
    add_spec(specs, "TABLE_LENGTH", 100.0*INCH, comment)
    comment = "Table bed height from floor, WPA requires [29.25,31], BCA requires 30"
    add_spec(specs, "TABLE_HEIGHT", 30.0*INCH, comment)
    comment = "Width of rail including cloth, WPA requires [4,7.5]"
    add_spec(specs, "TABLE_RAIL_WIDTH", 7.0*INCH, comment)
    # cosmetic table constants:
    comment = "\"The pocket radius measured from the vertical cut of the slate to the playing surface.\", BCA requires [0.125,0.25]"
    add_spec(specs, "TABLE_SLATE_DROP_POINT_RADIUS", 0.25*INCH, comment)
    comment = "Height of the slate WPA requires >=1"
    add_spec(specs, "TABLE_SLATE_THICKNESS", 1.0*INCH, comment)
    comment = "Height of rail from table bed (1.6\" for 23deg CUSHION_K66_PROFILE_ANGLE)"
    add_spec(specs, "TABLE_RAIL_HEIGHT", specs["CUSHION_NOSE_HEIGHT"]+specs["CUSHION_RUBBER_SIDE_LENGTH"]*np.sin(specs["CUSHION_SLOPE"]), comment)
    
    add_spec(specs, "TABLE_CASING_VERTICAL_ANGLE", 15.0*DEGREE, None)
    add_spec(specs, "TABLE_CASING_HEIGHT", 10.0*INCH, None)

    # add_spec(specs, "TABLE_RAIL_CORNER_RADIUS", 0.5*specs["TABLE_RAIL_WIDTH"], None)
    # add_spec(specs, "TABLE_RAIL_EDGE_RADIUS", 1.0*INCH, None)
    # comment = "Number of vertices on the edge of the rail, has to be of form 4n+4"
    # add_spec(specs, "TABLE_RAIL_EDGE_N", 4*8+4, comment)
    # comment = "Number of vertices in a vertical stripe on the casing"
    # add_spec(specs, "TABLE_RAIL_EDGE_M", 7, comment)
    
    return specs

def pool_cushion(data, p1, p2, pn, h_angle1, v_angle1, h_angle2, v_angle2):
    """Returns vertices and faces for given cushion based on the specs.
    """
    specs = data["specs"]
    pu = np.array([0.0, 0.0, 1.0])
    pn = pn / np.linalg.norm(pn)
    p12u = (p2-p1) / np.linalg.norm(p2-p1)

    plane_slate = geometry.Plane(pu, 0.0)
    plane_rail_top = geometry.Plane(pu, specs["TABLE_RAIL_HEIGHT"])
    p = p1 + np.sin(specs["CUSHION_SLOPE"])*pu + np.cos(specs["CUSHION_SLOPE"])*pn
    plane_rubber_top = geometry.Plane.from_points(p1, p2, p)

    p = p1 + np.sin(specs["CUSHION_BED_ANGLE"])*pu + np.cos(specs["CUSHION_BED_ANGLE"])*(-pn)
    plane_rubber_bottom = geometry.Plane.from_points(p1, p2, p)

    p = p1 + specs["CUSHION_WIDTH"]*pn
    plane_rail_back = geometry.Plane.from_points(p, p+p12u, p+pu)

    q = np.sin(h_angle1)*pn + np.cos(h_angle1)*p12u
    v = np.cross(q, pu)
    v = v / np.linalg.norm(v)
    q2 = np.cos(-v_angle1)*pu + np.sin(-v_angle1)*v
    plane_end1 = geometry.Plane.from_points(p1, p1+q, p1+q2)

    q = np.sin(h_angle2)*pn + np.cos(h_angle2)*(-p12u)
    v = np.cross(q, pu)
    v = v / np.linalg.norm(v)
    q2 = np.cos(v_angle2)*pu + np.sin(v_angle2)*v
    plane_end2 = geometry.Plane.from_points(p2, p2+q, p2+q2)

    # data["planes"] = {}       # BUG not correct! needs name like data["planes"][name]["plane_end1"] when called
    # data["planes"]["plane_end1"] = plane_end1
    # data["planes"]["plane_end2"] = plane_end2
    # data["planes"]["rail_back"] = plane_rail_back
    # data["planes"]["rail_top"] = plane_rail_top
    # data["planes"]["rubber_top"] = plane_rubber_top
    # data["planes"]["rubber_bottom"] = plane_rubber_bottom
    # data["planes"]["rail_slate"] = plane_slate

    planes = [plane_rail_back, plane_rail_top, plane_rubber_top, plane_rubber_bottom, plane_slate]
    v_list = []
    for k in range(len(planes)):
        v_list.append(geometry.Plane.intersection(plane_end1, planes[k], planes[(k+1)%len(planes)]))
    for k in range(len(planes)):
        v_list.append(geometry.Plane.intersection(plane_end2, planes[k], planes[(k+1)%len(planes)]))

    f_list = []
    # endcaps:
    for k in range(3):
        f_list.append([0, k+2, k+1])
        f_list.append([5, k+6, k+7])
    # long triangles:
    for k in range(5):
        f_list.append([k, (k+1)%5+5, k+5])
        f_list.append([k, (k+1)%5, (k+1)%5+5])
    
    return v_list, f_list

def create_cushions(data):
    """Joins vertices and faces of all six cushions on the table defined specs.
    """
    w = data["specs"]["TABLE_LENGTH"]
    h = data["specs"]["CUSHION_NOSE_HEIGHT"]
    cm = data["specs"]["CORNER_POCKET_MOUTH"]
    sm = data["specs"]["SIDE_POCKET_MOUTH"]
    ch = data["specs"]["CORNER_POCKET_HORIZONTAL_ANGLE"]
    cv = data["specs"]["CORNER_POCKET_VERTICAL_ANGLE"]
    sh = data["specs"]["SIDE_POCKET_HORIZONTAL_ANGLE"]
    sv = data["specs"]["SIDE_POCKET_VERTICAL_ANGLE"]

    e1 = np.array([1.0, 0.0, 0.0])
    e2 = np.array([0.0, 1.0, 0.0])

    data["points"] = {}
    data["points"]["A1"] = np.array([cm/np.sqrt(2)-w/2, w/4, h])
    data["points"]["A2"] = np.array([-sm/2, w/4, h])
    data["points"]["B2"] = np.array([sm/2, w/4, h])
    data["points"]["B3"] = np.array([w/2-cm/np.sqrt(2), w/4, h])
    data["points"]["C3"] = np.array([w/2, w/4-cm/np.sqrt(2), h])
    data["points"]["C4"] = np.array([w/2, cm/np.sqrt(2)-w/4, h])
    data["points"]["D4"] = np.array([w/2-cm/np.sqrt(2), -w/4, h])
    data["points"]["D5"] = np.array([sm/2, -w/4, h])
    data["points"]["E5"] = np.array([-sm/2, -w/4, h])
    data["points"]["E6"] = np.array([cm/np.sqrt(2)-w/2, -w/4, h])
    data["points"]["F6"] = np.array([-w/2, cm/np.sqrt(2)-w/4, h])
    data["points"]["F1"] = np.array([-w/2, w/4-cm/np.sqrt(2), h])

    ret = []
    # top-right (B)
    ret.append(pool_cushion(data, data["points"]["B2"], data["points"]["B3"], e2, sh, sv, ch, cv))
    # top-left (A)
    ret.append(pool_cushion(data, data["points"]["A1"], data["points"]["A2"], e2, ch, cv, sh, sv))
    # bottom-right (D)
    ret.append(pool_cushion(data, data["points"]["D4"], data["points"]["D5"], -e2, ch, cv, sh, sv))
    # bottom-left (E)
    ret.append(pool_cushion(data, data["points"]["E5"], data["points"]["E6"], -e2, sh, sv, ch, cv))
    # left (F)
    ret.append(pool_cushion(data, data["points"]["F6"], data["points"]["F1"], -e1, ch, cv, ch, cv))
    # right (C)
    ret.append(pool_cushion(data, data["points"]["C3"], data["points"]["C4"], e1, ch, cv, ch, cv))

    # merge all the vertex, face lists into one:
    v_list_all = []
    f_list_all = []
    for (v_list, f_list) in ret:
        offset = len(v_list_all)
        v_list_all.extend(v_list)
        for f in f_list:
            f_list_all.append((f[0]+offset, f[1]+offset, f[2]+offset))

    # v_list_all_flat = [t for v in v_list_all for t in v]
    # f_list_all_flat = [k for f in f_list_all for k in f]
    return {"vertices": v_list_all, "faces": f_list_all}

def slate_xy_slice(data, num_arc_points, bulge, mouth2_center, mouth3_center):
    """
    Generates a list of points corresponding to a cross-section of the slate parallel to XY-plane.
    Note: z-coordinates are ignored here completely.
    """
    specs = data["specs"]

    pocket2_radius = specs["SIDE_POCKET_RADIUS"] - bulge
    pocket3_radius = specs["CORNER_POCKET_RADIUS"] - bulge
    # pocket2_shelf = specs["SIDE_POCKET_SHELF"] + bulge
    # pocket3_shelf = specs["CORNER_POCKET_SHELF"] + bulge
    pocket2_center = mouth2_center + (specs["SIDE_POCKET_RADIUS"] + specs["SIDE_POCKET_SHELF"])*np.array((0.0, 1.0, 0.0))
    pocket3_center = mouth3_center + (specs["CORNER_POCKET_RADIUS"] + specs["CORNER_POCKET_SHELF"])*np.array((1.0, 1.0, 0.0))/np.sqrt(2.0)
    x_rail = specs["TABLE_LENGTH"]/2 + specs["CUSHION_WIDTH"]
    y_rail = specs["TABLE_LENGTH"]/4 + specs["CUSHION_WIDTH"]

    if ((pocket2_center[1] < y_rail) or (pocket3_center[0] < x_rail-np.sqrt(2)*specs["CORNER_POCKET_RADIUS"])):
        raise Exception("Pocket radius too small.")
    if ((pocket2_center[1] > y_rail+pocket2_radius) or (pocket3_center[0] > x_rail+pocket3_radius/np.sqrt(2))):
        raise Exception("Bulge is too large.")

    pocket2_arc_angle = 2*np.arccos((pocket2_center[1]-y_rail) / pocket2_radius)
    alpha = np.arccos((x_rail-pocket3_center[0]) / pocket3_radius)
    pocket3_arc_angle = 2*(3*np.pi/4 - alpha)

    # Next we put 
    pocket2_arc = []
    pocket3_arc = []
    for k in range(num_arc_points):
        t = -0.5 + k/(num_arc_points-1)       # -0.5 to 0.5
        pocket2_arc.append(pocket2_center + pocket2_radius*np.array((np.cos(t*pocket2_arc_angle-np.pi/2), np.sin(t*pocket2_arc_angle-np.pi/2), 0.0)))
        pocket3_arc.append(pocket3_center + pocket3_radius*np.array((np.cos(t*pocket3_arc_angle-3*np.pi/4), np.sin(t*pocket3_arc_angle-3*np.pi/4), 0.0)))

    pts = []    # pocket order: 2, 3, 4, 5, 6, 1
    pts.extend(pocket2_arc)
    pts.extend(pocket3_arc)
    pts.extend([np.array((p[0], -p[1], p[2])) for p in reversed(pocket3_arc)])
    pts.extend([np.array((p[0], -p[1], p[2])) for p in reversed(pocket2_arc)])
    pts.extend([np.array((-p[0], -p[1], p[2])) for p in pocket3_arc])
    pts.extend([np.array((-p[0], p[1], p[2])) for p in reversed(pocket3_arc)])

    return pts

def create_slate(data, num_slices, num_arc_points):
    r = data["specs"]["TABLE_SLATE_DROP_POINT_RADIUS"]
    thickness = data["specs"]["TABLE_SLATE_THICKNESS"]
    if (data["specs"]["TABLE_SLATE_THICKNESS"] < 2*r):
        raise Exception("Slate is too thin compared to slate drop point radius.")
    
    mouth2_center = (data["points"]["A2"] + data["points"]["B2"])/2
    mouth3_center = (data["points"]["B3"] + data["points"]["C3"])/2

    slate_slices = []
    for k in range(num_slices):
        bulge = r*np.sin(0.5*np.pi*k/(num_slices-1))
        slate_slices.append(slate_xy_slice(data, num_arc_points, bulge, mouth2_center, mouth3_center))

    # print(f"{slate_slices = }")

    v_slate = ((2*num_slices)*(6*num_arc_points)+2) * [None]
    for ks in range(num_slices):
        for ka in range(6*num_arc_points):
            v_slate[ks*(6*num_arc_points)+ka] = np.array((slate_slices[ks][ka][0], slate_slices[ks][ka][1], -r+r*np.cos(0.5*np.pi*ks/(num_slices-1))))
            v_slate[(2*num_slices-1-ks)*(6*num_arc_points)+ka] = np.array((slate_slices[ks][ka][0], 
                    slate_slices[ks][ka][1], -thickness+r-r*np.cos(0.5*np.pi*ks/(num_slices-1))))
    index_top_center = (2*num_slices)*(6*num_arc_points)
    index_bottom_center = (2*num_slices)*(6*num_arc_points)+1
    v_slate[index_top_center] = np.array((0.0, 0.0, 0.0))
    v_slate[index_bottom_center] = np.array((0.0, 0.0, -thickness))

    f_slate = ((2*num_slices-1)*(6*num_arc_points)+2*(6*num_arc_points)) * [(0,0,0)]    # TODO put back None
    # Add rectangular faces on the sides of the slate:
    for ks in range(2*num_slices-1):
        for ka in range(6*num_arc_points):
            f_slate[ks*(6*num_arc_points)+ka] = (ks*(6*num_arc_points)+ka, ks*(6*num_arc_points)+(ka+1)%(6*num_arc_points), 
                    (ks+1)*(6*num_arc_points)+(ka+1)%(6*num_arc_points), (ks+1)*(6*num_arc_points)+ka)
    # Add triangles to top and bottom by connecting to top or bottom center:
    for ka in range(6*num_arc_points):
        f_slate[(2*num_slices-1)*(6*num_arc_points)+ka] = (index_top_center, (ka+1)%(6*num_arc_points), ka)
        f_slate[(2*num_slices)*(6*num_arc_points)+ka] = (index_bottom_center, (2*num_slices-2)*(6*num_arc_points)+ka, 
                (2*num_slices-2)*(6*num_arc_points)+(ka+1)%(6*num_arc_points))
        
    # f_slate_flat = [v for f in f_slate for v in f]
    return {"vertices": v_slate, "faces": f_slate}


def main():
    WRITE_FILE = True

    # np.random.seed(20)
    data = {}
    data["specs"] = create_pooltable_json()
    data["cushions"] = create_cushions(data)
    data["slate"] = create_slate(data, 5, 8)

    if WRITE_FILE:
        # Write to file:
        with open("pooltable.json", "w") as file:
            file.write(json.dumps(data["specs"], indent=4))
        # with open("cushions.json", "w") as file:
        #     file.write(json.dumps(data["cushions"]))
        with open("cushions.obj", "w") as file:
            for v in data["cushions"]["vertices"]:
                file.write(f"v {v[0]} {v[1]} {v[2]}\n")
            for f in data["cushions"]["faces"]:
                s = "f "
                for k in f:
                    s += f"{k+1} "
                file.write(s + "\n")
        with open("slate.obj", "w") as file:
            for v in data["slate"]["vertices"]:
                file.write(f"v {v[0]} {v[1]} {v[2]}\n")
            for f in data["slate"]["faces"]:
                s = "f "
                for k in f:
                    s += f"{k+1} "
                file.write(s + "\n")
    else: 
        # print(f"{data["specs"] = }")
        # print(f"{data["cushions"] = }")
        print(f"{data["slate"] = }")

if __name__ == "__main__":
    main()