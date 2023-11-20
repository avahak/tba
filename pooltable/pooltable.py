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
import json, pickle

import geometry

INCH = 0.0254
OUNCE = 0.0283495231
DEGREE = np.pi/180.0

E1 = np.array((1.0, 0.0, 0.0))
E2 = np.array((0.0, 1.0, 0.0))
E3 = np.array((0.0, 0.0, 1.0))

plane_E1 = geometry.Plane(E1, 0.0)
plane_E2 = geometry.Plane(E2, 0.0)

def normalize(p):
    return p / np.linalg.norm(p)

def write_obj_file(file_name, obj_data):
    with open(file_name, "w") as file:
        for v in obj_data["vertices"]:
            file.write(f"v {v[0]} {v[1]} {v[2]}\n")
        for f in obj_data["faces"]:
            s = "f "
            for k in f:
                s += f"{k+1} "
            file.write(s + "\n")

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

def merge_vertices_and_faces(dict_list):
    """
    Given multiple OBJ style vertices and faces in a list with each element like {"vertices":[...], "faces":[...]},
    merges them together with new indexing for vertices.
    """
    index_offsets = []
    offset = 0
    for d in dict_list:
        index_offsets.append(offset)
        offset += len(d["vertices"])

    merge_vertices = [v for d in dict_list for v in d["vertices"]]
    merge_faces = []
    for k in range(len(dict_list)):
        offset = index_offsets[k]
        for f in dict_list[k]["faces"]:
            f_new = []
            for j in f:
                f_new.append(j + offset)
            merge_faces.append(f_new)

    return { "vertices": merge_vertices, "faces": merge_faces }

def apply_reflections(points, reflect_plane_list):
    """Applies one or multiple reflections to a point or list of points.
    """
    if isinstance(reflect_plane_list, geometry.Plane):
        reflect_plane_list = [reflect_plane_list]
    if isinstance(points, np.ndarray) and points.ndim == 1:
        p = points
        for reflect_plane in reflect_plane_list:
            p = reflect_plane.reflect(p)
        return p
    return [apply_reflections(p, reflect_plane_list) for p in points]

# Defines pool table measurements and their explanations
def create_pooltable_json():
    def add_spec(obj, name, value, comment):
        obj[name] = value
        if (comment is not None):
            obj["COMMENTS"][name] = comment

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
    comment = "Offset to control depth of pocket liner, default -1.0 inch"
    add_spec(specs, "CORNER_POCKET_LINER_DEPTH_OFFSET", -1.0*INCH, comment)

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
    comment = "Offset to control depth of pocket liner, default -1.0 inch"
    add_spec(specs, "SIDE_POCKET_LINER_DEPTH_OFFSET", -1.0*INCH, comment)

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
    comment = "Depth of sights from cushion nose, WPA requires 3\"11/16(+1/8\")."
    add_spec(specs, "TABLE_SIGHTS_DEPTH", (3+11/16)*INCH, comment)
    comment = "Offset at B2 and B3 where sights block part begins, measured as distance along x-axis from 0 and cushion C nose respectively."
    add_spec(specs, "TABLE_RAIL_SIGHTS_BLOCK", (0.3*specs["TABLE_LENGTH"]/8, 0.3*specs["TABLE_LENGTH"]/8), comment)

    comment = "Width of the pocket liner part visible from above."
    add_spec(specs, "TABLE_POCKET_LINER_WIDTH", 0.5*INCH, comment)
    
    add_spec(specs, "TABLE_CASING_VERTICAL_ANGLE", 15.0*DEGREE, None)
    add_spec(specs, "TABLE_CASING_HEIGHT", 10.0*INCH, None)
    add_spec(specs, "TABLE_CASING_EDGE_RADIUS", 8.0*INCH, None)
    add_spec(specs, "TABLE_CASING_BEVEL_RADIUS", 0.5*INCH, None)

    comment = "Controls number of points on the pocket liner arc segments."
    add_spec(specs, "TABLE_POCKET_LINER_NUM_POINTS", 10, comment)
    comment = "First number controls the number of vertical slices, second number controls number or points on the arc segments."
    add_spec(specs, "TABLE_SLATE_NUM_POINTS", (3, 10), comment)
    comment = "First number controls number of points on the rounded edge of the casing, second number controls number of points for the bevel on the casing."
    add_spec(specs, "TABLE_CASING_NUM_POINTS", (5, 5), comment)
    
    return specs

def create_pocket_points(data):
    """Returns points related to pocket locations
    """
    w = data["specs"]["TABLE_LENGTH"]
    h = data["specs"]["CUSHION_NOSE_HEIGHT"]
    cm = data["specs"]["CORNER_POCKET_MOUTH"]
    sm = data["specs"]["SIDE_POCKET_MOUTH"]

    points = {}
    points["A1"] = np.array([cm/np.sqrt(2)-w/2, w/4, h])
    points["A2"] = np.array([-sm/2, w/4, h])
    points["B2"] = np.array([sm/2, w/4, h])
    points["B3"] = np.array([w/2-cm/np.sqrt(2), w/4, h])
    points["C3"] = np.array([w/2, w/4-cm/np.sqrt(2), h])
    points["C4"] = np.array([w/2, cm/np.sqrt(2)-w/4, h])
    points["D4"] = np.array([w/2-cm/np.sqrt(2), -w/4, h])
    points["D5"] = np.array([sm/2, -w/4, h])
    points["E5"] = np.array([-sm/2, -w/4, h])
    points["E6"] = np.array([cm/np.sqrt(2)-w/2, -w/4, h])
    points["F6"] = np.array([-w/2, cm/np.sqrt(2)-w/4, h])
    points["F1"] = np.array([-w/2, w/4-cm/np.sqrt(2), h])

    # Pocket mouth definition: center of the two cushion noses of the pocket
    points["mouth_center_1"] = (points["A1"] + points["F1"])/2
    points["mouth_center_2"] = (points["A2"] + points["B2"])/2
    points["mouth_center_3"] = (points["B3"] + points["C3"])/2
    points["mouth_center_4"] = (points["C4"] + points["D4"])/2
    points["mouth_center_5"] = (points["D5"] + points["E5"])/2
    points["mouth_center_6"] = (points["E6"] + points["F6"])/2

    # Pocket fall center definition: center of the disc that cuts into the table bed
    dc = data["specs"]["CORNER_POCKET_RADIUS"] + data["specs"]["CORNER_POCKET_SHELF"]
    ds = data["specs"]["SIDE_POCKET_RADIUS"] + data["specs"]["SIDE_POCKET_SHELF"]
    # corner pockets (1, 3, 4, 6)
    points[f"fall_center_1"] = points[f"mouth_center_1"]*(E1 + E2) + dc*normalize(-E1 + E2)
    points[f"fall_center_3"] = points[f"mouth_center_3"]*(E1 + E2) + dc*normalize(E1 + E2)
    points[f"fall_center_4"] = points[f"mouth_center_4"]*(E1 + E2) + dc*normalize(E1 - E2)
    points[f"fall_center_6"] = points[f"mouth_center_6"]*(E1 + E2) + dc*normalize(-E1 - E2)
    # side pockets (2, 5)
    points[f"fall_center_2"] = points[f"mouth_center_2"]*(E1 + E2) + ds*(E2)
    points[f"fall_center_5"] = points[f"mouth_center_5"]*(E1 + E2) + ds*(-E2)

    return points

def pool_cushion(data, p1, p2, pn, h_angle1, v_angle1, h_angle2, v_angle2, cushion_name):
    """Returns vertices and faces for given cushion based on the specs.
    """
    specs = data["specs"]
    pn = normalize(pn)
    p12u = normalize(p2-p1)

    plane_slate = geometry.Plane(E3, 0.0)
    plane_rail_top = geometry.Plane(E3, specs["TABLE_RAIL_HEIGHT"])
    p = p1 + np.sin(specs["CUSHION_SLOPE"])*E3 + np.cos(specs["CUSHION_SLOPE"])*pn
    plane_rubber_top = geometry.Plane.from_points(p1, p2, p)

    p = p1 + np.sin(specs["CUSHION_BED_ANGLE"])*E3 + np.cos(specs["CUSHION_BED_ANGLE"])*(-pn)
    plane_rubber_bottom = geometry.Plane.from_points(p1, p2, p)

    p = p1 + specs["CUSHION_WIDTH"]*pn
    plane_rail_back = geometry.Plane.from_points(p, p+p12u, p+E3)

    q = np.sin(h_angle1)*pn + np.cos(h_angle1)*p12u
    v = np.cross(q, E3)
    v = normalize(v)
    q2 = np.cos(-v_angle1)*E3 + np.sin(-v_angle1)*v
    plane_end1 = geometry.Plane.from_points(p1, p1+q, p1+q2)

    q = np.sin(h_angle2)*pn + np.cos(h_angle2)*(-p12u)
    v = np.cross(q, E3)
    v = normalize(v)
    q2 = np.cos(v_angle2)*E3 + np.sin(v_angle2)*v
    plane_end2 = geometry.Plane.from_points(p2, p2+q, p2+q2)

    if ("planes" not in data):
        data["planes"] = {}
    data["planes"][cushion_name] = {}
    data["planes"][cushion_name]["end1"] = plane_end1
    data["planes"][cushion_name]["end2"] = plane_end2
    data["planes"][cushion_name]["rail_back"] = plane_rail_back
    data["planes"][cushion_name]["rail_top"] = plane_rail_top
    data["planes"][cushion_name]["rubber_top"] = plane_rubber_top
    data["planes"][cushion_name]["rubber_bottom"] = plane_rubber_bottom
    data["planes"][cushion_name]["slate"] = plane_slate

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
    
    return { "vertices": v_list, "faces": f_list }

def create_cushions(data):
    """Joins vertices and faces of all six cushions on the table.
    """
    ch = data["specs"]["CORNER_POCKET_HORIZONTAL_ANGLE"]
    cv = data["specs"]["CORNER_POCKET_VERTICAL_ANGLE"]
    sh = data["specs"]["SIDE_POCKET_HORIZONTAL_ANGLE"]
    sv = data["specs"]["SIDE_POCKET_VERTICAL_ANGLE"]

    ret = []
    # top-right (B)
    ret.append(pool_cushion(data, data["points"]["B2"], data["points"]["B3"], E2, sh, sv, ch, cv, "B"))
    # top-left (A)
    ret.append(pool_cushion(data, data["points"]["A1"], data["points"]["A2"], E2, ch, cv, sh, sv, "A"))
    # bottom-right (D)
    ret.append(pool_cushion(data, data["points"]["D4"], data["points"]["D5"], -E2, ch, cv, sh, sv, "D"))
    # bottom-left (E)
    ret.append(pool_cushion(data, data["points"]["E5"], data["points"]["E6"], -E2, sh, sv, ch, cv, "E"))
    # left (F)
    ret.append(pool_cushion(data, data["points"]["F6"], data["points"]["F1"], -E1, ch, cv, ch, cv, "F"))
    # right (C)
    ret.append(pool_cushion(data, data["points"]["C3"], data["points"]["C4"], E1, ch, cv, ch, cv, "C"))

    data["points"]["normal_1"] = normalize(-E1 + E2)
    data["points"]["normal_2"] = E2
    data["points"]["normal_3"] = normalize(E1 + E2)
    data["points"]["normal_4"] = normalize(E1 - E2)
    data["points"]["normal_5"] = -E2
    data["points"]["normal_6"] = normalize(-E1 - E2)
    for k in range(1, 7):
        base = data["points"][f"mouth_center_{k}"]
        data["planes"][f"bisector_{k}"] = geometry.Plane.from_points(base, base+data["points"][f"normal_{k}"], base+E3)

    return merge_vertices_and_faces(ret)

def slate_xy_slice(data, num_arc_points, bulge):
    """
    Generates a list of points corresponding to a cross-section of the slate parallel to XY-plane.
    Note: z-coordinates are ignored here completely.
    """
    specs = data["specs"]

    pocket2_radius = specs["SIDE_POCKET_RADIUS"] - bulge
    pocket3_radius = specs["CORNER_POCKET_RADIUS"] - bulge
    fall_center_2 = data["points"]["fall_center_2"]
    fall_center_3 = data["points"]["fall_center_3"]
    x_rail = specs["TABLE_LENGTH"]/2 + specs["CUSHION_WIDTH"]
    y_rail = specs["TABLE_LENGTH"]/4 + specs["CUSHION_WIDTH"]

    if ((fall_center_2[1] < y_rail) or (fall_center_3[0] < x_rail-np.sqrt(2)*specs["CORNER_POCKET_RADIUS"])):
        raise Exception("Pocket radius too small.")
    if ((fall_center_2[1] > y_rail+pocket2_radius) or (fall_center_3[0] > x_rail+pocket3_radius/np.sqrt(2))):
        raise Exception("Bulge is too large.")

    pocket2_arc_angle = 2*np.arccos((fall_center_2[1]-y_rail) / pocket2_radius)
    alpha = np.arccos((x_rail-fall_center_3[0]) / pocket3_radius)
    pocket3_arc_angle = 2*(3*np.pi/4 - alpha)

    # Next we put 
    pocket2_arc = []
    pocket3_arc = []
    for k in range(num_arc_points):
        t = -0.5 + k/(num_arc_points-1)       # -0.5 to 0.5
        pocket2_arc.append(fall_center_2 + pocket2_radius*np.array((np.cos(t*pocket2_arc_angle-np.pi/2), np.sin(t*pocket2_arc_angle-np.pi/2), 0.0)))
        pocket3_arc.append(fall_center_3 + pocket3_radius*np.array((np.cos(t*pocket3_arc_angle-3*np.pi/4), np.sin(t*pocket3_arc_angle-3*np.pi/4), 0.0)))

    pts = []    # pocket order: 2, 3, 4, 5, 6, 1
    pts.extend(pocket2_arc)
    pts.extend(pocket3_arc)
    pts.extend([np.array((p[0], -p[1], p[2])) for p in reversed(pocket3_arc)])
    pts.extend([np.array((p[0], -p[1], p[2])) for p in reversed(pocket2_arc)])
    pts.extend([np.array((-p[0], -p[1], p[2])) for p in pocket3_arc])
    pts.extend([np.array((-p[0], p[1], p[2])) for p in reversed(pocket3_arc)])

    return pts

def create_slate(data):
    num_slices = data["specs"]["TABLE_SLATE_NUM_POINTS"][0]
    num_arc_points = data["specs"]["TABLE_SLATE_NUM_POINTS"][1]
    r = data["specs"]["TABLE_SLATE_DROP_POINT_RADIUS"]
    thickness = data["specs"]["TABLE_SLATE_THICKNESS"]
    if (data["specs"]["TABLE_SLATE_THICKNESS"] < 2*r):
        raise Exception("Slate is too thin compared to slate drop point radius.")
    
    slate_slices = []
    for k in range(num_slices):
        bulge = r*np.sin(0.5*np.pi*k/(num_slices-1))
        slate_slices.append(slate_xy_slice(data, num_arc_points, bulge))

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

    f_slate = (2*(2*num_slices-1)*(6*num_arc_points)+2*(6*num_arc_points)) * [(0,0,0)]    # TODO put back None
    # Add rectangular faces on the sides of the slate:
    for ks in range(2*num_slices-1):
        for ka in range(6*num_arc_points):
            quad = (ks*(6*num_arc_points)+ka, ks*(6*num_arc_points)+(ka+1)%(6*num_arc_points), 
                    (ks+1)*(6*num_arc_points)+(ka+1)%(6*num_arc_points), (ks+1)*(6*num_arc_points)+ka)
            # Since quad is not perfectly planar, add triangles instead of the quad:
            f_slate[2*ks*(6*num_arc_points)+2*ka+0] = (quad[0], quad[1], quad[2])
            f_slate[2*ks*(6*num_arc_points)+2*ka+1] = (quad[0], quad[2], quad[3])
    # Add triangles to top and bottom by connecting to top or bottom center:
    for ka in range(6*num_arc_points):
        f_slate[2*(2*num_slices-1)*(6*num_arc_points)+ka] = (index_top_center, (ka+1)%(6*num_arc_points), ka)
        f_slate[(2*(2*num_slices-1)+1)*(6*num_arc_points)+ka] = (index_bottom_center, (2*num_slices-1)*(6*num_arc_points)+ka, 
                (2*num_slices-1)*(6*num_arc_points)+(ka+1)%(6*num_arc_points))
        
    # f_slate_flat = [v for f in f_slate for v in f]
    return {"vertices": v_slate, "faces": f_slate}

def create_pocket_liner_arc(data, pocket, bulge, height): 
    """Idea: On rail top level the pocket liner inner edge follows the cushion endcap plane 
    until its closest point to pocket center, then follows the circle C(pocket center,d_min), and then 
    returns back to the rail on the other side of the pocket.
        The arc can be widened (parameter bulge) by moving its points in the normal direction 
    but it still needs to meet the cushion rail back.
    Returns arc points in a list.
    """
    # To make things easier, we reduce the situation to pockets 2 and 3. 
    # We just have to reflect afterwards accordingly.
    final_reflects = []
    if (pocket == 1):
        final_reflects = [geometry.Plane(E1, 0.0), data["planes"]["bisector_1"]]
    elif (pocket == 4):
        final_reflects = [geometry.Plane(E2, 0.0), data["planes"]["bisector_4"]]
    elif (pocket == 5):
        final_reflects = [geometry.Plane(E2, 0.0), data["planes"]["bisector_5"]]
    elif (pocket == 6):
        final_reflects = [geometry.Plane(E1, 0.0), geometry.Plane(E2, 0.0)]
    pocket = 2 if (pocket in (2, 5)) else 3

    POCKET_TYPE = ("CORNER" if (pocket == 3) else "SIDE")
    CUSHION_NAME = ("C" if (pocket == 3) else "B")
    MID_ANGLE = (np.pi/4 if (pocket == 3) else np.pi/2)     # angle corresponding to bisector
    # Pocket center offset to pocket deeper or shallower:
    OFFSET = data["specs"][f"{POCKET_TYPE}_POCKET_LINER_DEPTH_OFFSET"]
    # Following results in arc with total 2*NUM_POINTS+1 points:
    NUM_POINTS = data["specs"]["TABLE_POCKET_LINER_NUM_POINTS"]
    bisector = data["planes"][f"bisector_{pocket}"]

    # LINER_CORNER_D is distance from pocket mouth to center (ignoring z-axis):
    LINER_CORNER_D = OFFSET + data["specs"][f"{POCKET_TYPE}_POCKET_SHELF"] + data["specs"][f"{POCKET_TYPE}_POCKET_RADIUS"]
    # center is the center of the circle that we follow as part of the arc:
    center = data["points"][f"mouth_center_{pocket}"]*(E1 + E2) + LINER_CORNER_D*data["points"][f"normal_{pocket}"]
    center[2] = height

    # Relevant planes to help calculate points:
    # NOTE: in plane_end we need cos(vertical_angle) to correct for the tilt of the plane:
    plane_end = geometry.Plane.translate(data["planes"][CUSHION_NAME]["end1"], -bulge*np.cos(data["specs"][f"{POCKET_TYPE}_POCKET_VERTICAL_ANGLE"]))
    plane_z_is_height = geometry.Plane(E3, height)
    plane_rail_back = data["planes"][CUSHION_NAME]["rail_back"]

    # First we need the starting point and direction:
    start = geometry.Plane.intersection(plane_end, plane_z_is_height, plane_rail_back)
    sp = geometry.Plane.intersection(plane_end, plane_z_is_height, geometry.Plane.translate(plane_rail_back, 1.0))
    start_dir = normalize(sp-start)

    # Next we need to find the closest point on the line (start+t*start_dir) to center_3:
    # <start+t*start_dir-center_3, start_dir> = 0  =>   <start-center3,start_dir>+t*<start_dir,start_dir>=0
    q = start - np.dot(start-center, start_dir)*start_dir
    angle = np.arctan2(q[1]-center[1], q[0]-center[0])
    r = np.linalg.norm(q-center)
    # We go from angle to MID_ANGLE and after that the previous points are reflected through pocket bisector:
    circle_path = lambda t: center + r*np.array((np.cos(angle+t*(MID_ANGLE-angle)), np.sin(angle+t*(MID_ANGLE-angle)), 0.0))
    arc = [start]
    for k in range(NUM_POINTS):
        t = k / (NUM_POINTS-1)
        arc.append(circle_path(t))
    for p in list(reversed(arc))[1:]:
        arc.append(bisector.reflect(p))

    # Finally, apply final_reflections:
    # for reflect_plane in final_reflects:
    #     arc = [reflect_plane.reflect(p) for p in arc]
    arc = apply_reflections(arc, final_reflects)

    return arc

def create_one_pocket_liner(data, pocket):
    """Connect three arcs with faces and add two triangles to cover a hole.
    """
    arcs = []
    arcs.append(create_pocket_liner_arc(data, pocket, data["specs"]["TABLE_POCKET_LINER_WIDTH"], data["specs"]["TABLE_RAIL_HEIGHT"]))
    arcs.append(create_pocket_liner_arc(data, pocket, 0.0, data["specs"]["TABLE_RAIL_HEIGHT"]))
    arcs.append(create_pocket_liner_arc(data, pocket, 0.0, -data["specs"]["TABLE_SLATE_THICKNESS"]))
    n = len(arcs[0])
    vertices = [p for arc in arcs for p in arc]

    faces = []
    for k in range(n-1):
        faces.append([0*n+k, 0*n+(k+1), 1*n+(k+1), 1*n+k])
        faces.append([1*n+k, 1*n+(k+1), 2*n+(k+1), 2*n+k])

    # Add two triangles to cover a small hole where the slate bevel is:
    arc00 = create_pocket_liner_arc(data, pocket, 0.0, 0.0)
    dir_1 = normalize(arc00[1]-arc00[0])
    dir_2 = normalize(arc00[-2]-arc00[-1])
    x = data["specs"]["TABLE_SLATE_DROP_POINT_RADIUS"]
    vertices.append(arc00[0])       # 3*n
    vertices.append(arc00[0]-x*dir_1)
    vertices.append(arc00[-1])
    vertices.append(arc00[-1]-x*dir_2)
    faces.append([3*n, 2*n, 3*n+1])
    faces.append([3*n+2, 3*n+3, 2*n+(n-1)])

    return { "vertices": vertices, "faces": faces }

def create_pocket_liners(data):
    liners = [create_one_pocket_liner(data, k) for k in range(1, 7)]
    return merge_vertices_and_faces(liners)

def casing_circuit(data, bulge_radius, bulge_length, height):
    """
    Creates a path around the table, following the outer edge of the casing at z=height.
    The radius is extended by bulge_radius and edge lengths by 2*budge_length.
    """
    r = data["specs"]["TABLE_CASING_EDGE_RADIUS"] + bulge_radius
    x = data["specs"]["TABLE_RAIL_WIDTH"] - data["specs"]["TABLE_CASING_EDGE_RADIUS"] #- data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    arc3 = []
    center = np.array((bulge_length+data["specs"]["TABLE_LENGTH"]/2+x,
            bulge_length+data["specs"]["TABLE_LENGTH"]/4+x, height))
    n = 2*data["specs"]["TABLE_CASING_NUM_POINTS"][0] + 1
    for k in range(n):
        t = np.pi/2*k/(n-1)
        arc3.append(np.array((center[0]+r*np.cos(t), center[1]+r*np.sin(t), center[2])))
    arc1 = apply_reflections(arc3, [geometry.Plane(E1, 0.0), data["planes"]["bisector_1"]])
    arc6 = apply_reflections(arc3, [geometry.Plane(E1, 0.0), geometry.Plane(E2, 0.0)])
    arc4 = apply_reflections(arc3, [geometry.Plane(E2, 0.0), data["planes"]["bisector_4"]])
    circuit = []
    circuit.extend(arc3)
    circuit.extend(arc1)
    circuit.extend(arc6)
    circuit.extend(arc4)
    return circuit

def create_casing(data):
    """Returns vertices and faces for the casing.
    """
    n1 = 2*data["specs"]["TABLE_CASING_NUM_POINTS"][0] + 1 
    n2 = data["specs"]["TABLE_CASING_NUM_POINTS"][1]
    h0 = data["specs"]["TABLE_RAIL_HEIGHT"]
    vertical_angle = data["specs"]["TABLE_CASING_VERTICAL_ANGLE"]
    casing_height = data["specs"]["TABLE_CASING_HEIGHT"]
    r = data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    vertices = []
    for k in range(n2):
        t = np.pi/2*k/(n2-1)
        circuit = casing_circuit(data, -r+r*np.sin(t), 0, h0-r+r*np.cos(t))
        vertices.extend(circuit)
    bottom_circuit = casing_circuit(data, 0, -np.tan(vertical_angle)*casing_height, h0-casing_height)
    vertices.extend(bottom_circuit)
    bottom_point = np.array((0.0, 0.0, h0-casing_height))
    vertices.append(bottom_point)

    faces = []
    for k in range(n2):
        for j in range(4*n1):
            jp = (j+1)%(4*n1)
            faces.append([k*(4*n1)+j, (k+1)*(4*n1)+j, (k+1)*(4*n1)+jp, k*(4*n1)+jp])
    # Faces for the bottom:
    for j in range(4*n1):
        jp = (j+1)%(4*n1)
        faces.append([n2*(4*n1)+j, (n2+1)*(4*n1), n2*(4*n1)+jp])
    
    return { "vertices": vertices, "faces": faces}
    
def rail_top_b3(data):
    """Returns points for one complex polygon that defines the rail top near B3.
    """
    r = data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    h0 = data["specs"]["TABLE_RAIL_HEIGHT"]
    y0 = data["specs"]["TABLE_LENGTH"]/4 + data["specs"]["CUSHION_WIDTH"]
    y1 = data["specs"]["TABLE_LENGTH"]/4 + data["specs"]["TABLE_RAIL_WIDTH"] - data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    n = data["specs"]["TABLE_CASING_NUM_POINTS"][0]
    m = data["specs"]["TABLE_POCKET_LINER_NUM_POINTS"]
    w = data["specs"]["TABLE_LENGTH"]/2
    offset = data["specs"]["TABLE_RAIL_SIGHTS_BLOCK"][1]

    # First follow 
    circuit = casing_circuit(data, -r, 0, h0)
    # from n to 2n, then go to (w-offset,y1,h0), then 
    # go to (w-offset,y0,h0), then follow
    arc3 = create_pocket_liner_arc(data, 3, data["specs"]["TABLE_POCKET_LINER_WIDTH"], h0)
    # from 2*m to m:
    vertices = [circuit[k] for k in range(n, 2*n+1)]
    vertices.append(np.array((w-offset, y1, h0)))
    vertices.append(np.array((w-offset, y0, h0)))
    vertices.extend([arc3[2*m-k] for k in range(m+1)])

    if (w-offset >= circuit[2*n][0]) or (w-offset >= arc3[2*m][0]):
        raise Exception("Invalid table specs: TABLE_RAIL_SIGHTS_BLOCK[1] is too small.")

    return vertices

def rail_top_b2(data):
    """Returns points for one complex polygon that defines the rail top near B2.
    """
    h0 = data["specs"]["TABLE_RAIL_HEIGHT"]
    y0 = data["specs"]["TABLE_LENGTH"]/4 + data["specs"]["CUSHION_WIDTH"]
    y1 = data["specs"]["TABLE_LENGTH"]/4 + data["specs"]["TABLE_RAIL_WIDTH"] - data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    n = data["specs"]["TABLE_CASING_NUM_POINTS"][0]
    m = data["specs"]["TABLE_POCKET_LINER_NUM_POINTS"]
    offset = data["specs"]["TABLE_RAIL_SIGHTS_BLOCK"][0]

    # Start at (offset,y1,h0), then go to (0,y1,h0), then follow
    arc2 = create_pocket_liner_arc(data, 2, data["specs"]["TABLE_POCKET_LINER_WIDTH"], h0)
    # from m to 0, then go to (offset,y0,h0)
    vertices = [np.array((offset, y1, h0)), np.array((0.0, y1, h0))]
    vertices.extend([arc2[m-k] for k in range(m+1)])
    vertices.append(np.array((offset, y0, h0)))

    if (offset <= arc2[0][0]):
        raise Exception("Invalid table specs: TABLE_RAIL_SIGHTS_BLOCK[0] is too small.")

    return vertices

def rail_top(data, cushion_pocket: str):
    """Generalizing from rail_top_b2, rail_top_b3 using reflections. 
    """
    cushion_pocket = cushion_pocket.upper()
    base = rail_top_b2(data) if cushion_pocket in ["B2", "A2", "D5", "E5"] else rail_top_b3(data)

    vertices = base     # works fr B2, B3
    if cushion_pocket in ("A1", "A2"):
        vertices = plane_E1.reflect(list(reversed(base)))
    elif cushion_pocket == "C3":
        vertices = data["planes"]["bisector_3"].reflect(list(reversed(base)))
    elif cushion_pocket == "C4":
        vertices = data["planes"]["bisector_4"].reflect(plane_E2.reflect(base))
    elif cushion_pocket in ("D4", "D5"):
        vertices = plane_E2.reflect(list(reversed(base)))
    elif cushion_pocket in ("E5", "E6"):
        vertices = plane_E2.reflect(plane_E1.reflect(base))
    elif cushion_pocket == "F6":
        vertices = apply_reflections(list(reversed(base)), [plane_E1, plane_E2, data["planes"]["bisector_6"]])
    elif cushion_pocket == "F1":
        vertices = data["planes"]["bisector_1"].reflect(plane_E1.reflect(base))

    return { "vertices": vertices, "faces": [list(range(len(vertices)))] }

def create_rail_tops(data):
    """Merges all rail tops.
    """
    cushion_pockets = ["A1", "A2", "B2", "B3", "C3", "C4", "D4", "D5", "E5", "E6", "F6", "F1"]
    tops = [rail_top(data, cushion_pocket) for cushion_pocket in cushion_pockets]
    return merge_vertices_and_faces(tops) 

def create_rail_sights(data):
    """Returns the six rectangular rail plates for the sights.
    """
    h0 = data["specs"]["TABLE_RAIL_HEIGHT"]
    y0 = data["specs"]["TABLE_LENGTH"]/4 + data["specs"]["CUSHION_WIDTH"]
    y1 = data["specs"]["TABLE_LENGTH"]/4 + data["specs"]["TABLE_RAIL_WIDTH"] - data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    x0 = data["specs"]["TABLE_LENGTH"]/2 + data["specs"]["CUSHION_WIDTH"]
    x1 = data["specs"]["TABLE_LENGTH"]/2 + data["specs"]["TABLE_RAIL_WIDTH"] - data["specs"]["TABLE_CASING_BEVEL_RADIUS"]
    w = data["specs"]["TABLE_LENGTH"]/2
    offset0 = data["specs"]["TABLE_RAIL_SIGHTS_BLOCK"][0]
    offset1 = data["specs"]["TABLE_RAIL_SIGHTS_BLOCK"][1]
    rs_b = [np.array((offset0, y0, h0)), np.array((w-offset1, y0, h0)), np.array((w-offset1, y1, h0)), np.array((offset0, y1, h0))]
    rs_c = [np.array((x0, -w/2+offset1, h0)), np.array((x1, -w/2+offset1, h0)), np.array((x1, w/2-offset1, h0)), np.array((x0, w/2-offset1, h0))]
    rs_a = plane_E1.reflect(list(reversed(rs_b)))
    rs_d = plane_E2.reflect(list(reversed(rs_b)))
    rs_e = plane_E1.reflect(plane_E2.reflect(rs_b))
    rs_f = plane_E1.reflect(list(reversed(rs_c)))
    f = lambda v_list: { "vertices": v_list, "faces": [[0, 1, 2, 3]] }
    return merge_vertices_and_faces([f(rs_a), f(rs_b), f(rs_c), f(rs_d), f(rs_e), f(rs_f)])

def create_sights_metadata(data):
    """From WPA (https://wpapool.com/equipment-specifications/):
    18 sights (or 17 and a name plate) shall be attached flush on the rail cap with:
    12 ½ inches [31.75 cm] from sight to sight on a 9-foot regulation table
    11 ½ inches [29.20 cm] from sight to sight on a 8-foot regulation table.
    The center of each sight should be located 3 11/16 (+ ) inches [93.6625 mm (+ 3.175 mm)] 
    from the nose of the cushion. The sights may be round (between 7/16 [11.11 mm] 
    and ½ inch [12.7 mm] in diameter) or diamond-shaped (between 1 x 7/16 [25.4 x 11.11 mm] 
    and 1 ¼ x 5/8 inch [31.75 x 15.875 mm]). Any nameplates and score counters should be 
    flush level with rail top.
    """
    # Idea of the sights: 9 foot table is 100 inches from cushion nose to nose.
    # The length is divided evenly into 8 parts, each 12.5 inches.
    x0 = data["specs"]["TABLE_LENGTH"]/2
    y0 = data["specs"]["TABLE_LENGTH"]/4
    h0 = data["specs"]["TABLE_RAIL_HEIGHT"]
    depth = data["specs"]["TABLE_SIGHTS_DEPTH"]
    sights_b = [np.array((x0*k/4, y0+depth, h0)) for k in range(1, 4)]
    sights_c = [np.array((x0+depth, y0-(2*y0)*k/4, h0)) for k in range(1, 4)]
    return { "A": plane_E1.reflect(reversed(sights_b)), "B": sights_b, "C": sights_c,
             "D": plane_E2.reflect(reversed(sights_b)), "E": plane_E2.reflect(plane_E1.reflect(sights_b)),
             "F": plane_E1.reflect(reversed(sights_c)) }

def create_metadata(data):
    meta = { "specs": data["specs"] }
    for k in range(1, 7):
        meta[f"pocket_fall_center_{k}"] = data["points"][f"fall_center_{k}"]
        pocket_type = "SIDE" if (k in (2, 5)) else "CORNER"
        meta[f"pocket_fall_radius_{k}"] = data["specs"][f"{pocket_type}_POCKET_RADIUS"]
    # Box from rail back to rail back:
    meta["railbox"] = np.array((data["specs"]["TABLE_LENGTH"]/2+data["specs"]["CUSHION_WIDTH"], data["specs"]["TABLE_LENGTH"]/4+data["specs"]["CUSHION_WIDTH"], data["specs"]["TABLE_RAIL_HEIGHT"]))
    
    meta["sights"] = create_sights_metadata(data)
    return meta


def main():
    WRITE_FILE = True

    # np.random.seed(20)
    data = {}
    data["specs"] = create_pooltable_json()
    data["points"] = create_pocket_points(data)
    data["cushions"] = create_cushions(data)
    data["slate"] = create_slate(data)
    data["liners"] = create_pocket_liners(data)
    data["casing"] = create_casing(data)
    data["rails"] = create_rail_tops(data)
    data["rail_sights"] = create_rail_sights(data)
    meta = create_metadata(data)

    if WRITE_FILE:
        # Write to file:
        with open("pooltable_metadata.json", "w") as f:
            f.write(json.dumps(convert_numpy_to_lists(meta), indent=4))
        with open("pooltable_all_data.pkl", "wb") as f:
            pickle.dump(data, f)
        write_obj_file("cushions.obj", data["cushions"])
        write_obj_file("slate.obj", data["slate"])
        write_obj_file("liners.obj", data["liners"])
        write_obj_file("casing.obj", data["casing"])
        write_obj_file("rails.obj", data["rails"])
        write_obj_file("rail_sights.obj", data["rail_sights"])

    # print(f"{data["specs"] = }")
    # print(f"{data["points"] = }")
    # print(f"{data["planes"] = }")
    # print(f"{data["cushions"] = }")
    # print(f"{data["slate"] = }")
    # print(f"{data["slate"] = }")
    # print(f"{data["liners"] = }")
    # print(f"{data["casing"] = }")
    # print(f"{data["rails"] = }")
    # print(f"{data["rail_sights"] = }")
    # print(f"{meta = }")

if __name__ == "__main__":
    main()