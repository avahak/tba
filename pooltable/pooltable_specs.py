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

import geometry2, geometry3

INCH = 0.0254
OUNCE = 0.0283495231
DEGREE = np.pi/180.0

E1 = np.array((1.0, 0.0, 0.0))
E2 = np.array((0.0, 1.0, 0.0))
E3 = np.array((0.0, 0.0, 1.0))

plane_E1 = geometry3.Plane(E1, 0.0)
plane_E2 = geometry3.Plane(E2, 0.0)

def normalize(p):
    return p / np.linalg.norm(p)

# Defines pool table measurements and their explanations
def create_pooltable_specs():
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
    comment = "Radius of the circular sights. WPA requires between 7/16 [11.11 mm] and ½ inch [12.7 mm] in diameter."
    add_spec(specs, "TABLE_RAIL_SIGHTS_RADIUS", (8/16)/2*INCH, comment)

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

    comment = "Gap in pixels left on the border of the uv-patch to prevent color smearing with JPEG artifacts."
    add_spec(specs, "UV_TEXTURE_GAP", 8, comment)
    comment = "Base resolution of the uv-map."
    add_spec(specs, "UV_PIXELS_PER_METER", 128, comment)
    comment = "Multipliers for base resolution of the uv-map used for prominent parts of the mesh."
    add_spec(specs, "UV_ENHANCE_FACTOR", (4, 8), comment)
    
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

def create_pocket_fall_metadata(data, meta, box):
    box_corners = (np.array((-box[0], box[1])), np.array((box[0], box[1])), np.array((box[0], -box[1])), np.array((-box[0], -box[1])))
    box_ls = tuple(geometry2.LineSegment2(box_corners[k], box_corners[(k+1)%4]) for k in range(4))
    slate_corners = []

    for k in range(1, 7):
        meta[f"pocket_fall_center_{k}"] = data["points"][f"fall_center_{k}"]
        pocket_type = "SIDE" if (k in (2, 5)) else "CORNER"
        meta[f"pocket_fall_radius_{k}"] = data["specs"][f"{pocket_type}_POCKET_RADIUS"]

        for ls in box_ls:
            intersections = geometry2.intersections_circle_ls(meta[f"pocket_fall_center_{k}"][0:2], meta[f"pocket_fall_radius_{k}"], ls)
            slate_corners.extend(intersections)
    # corners of the slate where the pocket fall circles intersect the flat slate edges
    if (len(slate_corners) != 12):
        raise Exception(f"Error computing pocket_fall_corners: found {len(slate_corners)} instead of 12.")
    meta[f"pocket_fall_corners"] = slate_corners

def create_metadata(data):
    meta = { "specs": data["specs"] }
    
    # Box from rail back to rail back:
    box = np.array((data["specs"]["TABLE_LENGTH"]/2+data["specs"]["CUSHION_WIDTH"], data["specs"]["TABLE_LENGTH"]/4+data["specs"]["CUSHION_WIDTH"], data["specs"]["TABLE_RAIL_HEIGHT"]))
    meta["railbox"] = box

    create_pocket_fall_metadata(data, meta, box)

    meta["sights"] = create_sights_metadata(data)
    return meta

def run():
    data = {}
    data["specs"] = create_pooltable_specs()
    data["points"] = create_pocket_points(data)
    data["meta"] = create_metadata(data)
    return data

if __name__ == "__main__":
    data = run()
    print(data)