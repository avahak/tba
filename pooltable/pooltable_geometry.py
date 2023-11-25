import numpy as np
import json, pickle

import geometry3, mesh3

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

def to_mesh(obj):
    # Converts { "vertices": ..., "faces": ... } to Mesh3
    mesh = mesh3.Mesh3()
    for face in obj["faces"]:
        points = [obj["vertices"][k] for k in face]
        face = mesh3.Face3(points)
        mesh.add_face(face)
    return mesh

def apply_reflections(points, reflect_plane_list):
    """Applies one or multiple reflections to a point or list of points.
    """
    if isinstance(reflect_plane_list, geometry3.Plane):
        reflect_plane_list = [reflect_plane_list]
    if isinstance(points, np.ndarray) and points.ndim == 1:
        p = points
        for reflect_plane in reflect_plane_list:
            p = reflect_plane.reflect(p)
        return p
    return [apply_reflections(p, reflect_plane_list) for p in points]

def pool_cushion(data, p1, p2, pn, h_angle1, v_angle1, h_angle2, v_angle2, cushion_name):
    """Returns vertices and faces for given cushion based on the specs.
    """
    specs = data["specs"]
    pn = normalize(pn)
    p12u = normalize(p2-p1)

    plane_slate = geometry3.Plane(E3, 0.0)
    plane_rail_top = geometry3.Plane(E3, specs["TABLE_RAIL_HEIGHT"])
    p = p1 + np.sin(specs["CUSHION_SLOPE"])*E3 + np.cos(specs["CUSHION_SLOPE"])*pn
    plane_rubber_top = geometry3.Plane.from_points(p1, p2, p)

    p = p1 + np.sin(specs["CUSHION_BED_ANGLE"])*E3 + np.cos(specs["CUSHION_BED_ANGLE"])*(-pn)
    plane_rubber_bottom = geometry3.Plane.from_points(p1, p2, p)

    p = p1 + specs["CUSHION_WIDTH"]*pn
    plane_rail_back = geometry3.Plane.from_points(p, p+p12u, p+E3)

    q = np.sin(h_angle1)*pn + np.cos(h_angle1)*p12u
    v = np.cross(q, E3)
    v = normalize(v)
    q2 = np.cos(-v_angle1)*E3 + np.sin(-v_angle1)*v
    plane_end1 = geometry3.Plane.from_points(p1, p1+q, p1+q2)

    q = np.sin(h_angle2)*pn + np.cos(h_angle2)*(-p12u)
    v = np.cross(q, E3)
    v = normalize(v)
    q2 = np.cos(v_angle2)*E3 + np.sin(v_angle2)*v
    plane_end2 = geometry3.Plane.from_points(p2, p2+q, p2+q2)

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
        v_list.append(geometry3.Plane.intersection(plane_end1, planes[k], planes[(k+1)%len(planes)]))
    for k in range(len(planes)):
        v_list.append(geometry3.Plane.intersection(plane_end2, planes[k], planes[(k+1)%len(planes)]))

    f_list = []
    # endcaps:
    f_list.append([4, 3, 2, 1, 0])
    f_list.append([5, 6, 7, 8, 9])
    for k in range(5):
        f_list.append([k, (k+1)%5, (k+1)%5+5, k+5])
    
    return to_mesh({ "vertices": v_list, "faces": f_list })

def create_cushions(data):
    """Joins vertices and faces of all six cushions on the table.
    """
    ch = data["specs"]["CORNER_POCKET_HORIZONTAL_ANGLE"]
    cv = data["specs"]["CORNER_POCKET_VERTICAL_ANGLE"]
    sh = data["specs"]["SIDE_POCKET_HORIZONTAL_ANGLE"]
    sv = data["specs"]["SIDE_POCKET_VERTICAL_ANGLE"]

    ret = {}
    # top-right (B)
    ret["B"] = pool_cushion(data, data["points"]["B2"], data["points"]["B3"], E2, sh, sv, ch, cv, "B")
    # top-left (A)
    ret["A"] = pool_cushion(data, data["points"]["A1"], data["points"]["A2"], E2, ch, cv, sh, sv, "A")
    # bottom-right (D)
    ret["D"] = pool_cushion(data, data["points"]["D4"], data["points"]["D5"], -E2, ch, cv, sh, sv, "D")
    # bottom-left (E)
    ret["E"] = pool_cushion(data, data["points"]["E5"], data["points"]["E6"], -E2, sh, sv, ch, cv, "E")
    # left (F)
    ret["F"] = pool_cushion(data, data["points"]["F6"], data["points"]["F1"], -E1, ch, cv, ch, cv, "F")
    # right (C)
    ret["C"] = pool_cushion(data, data["points"]["C3"], data["points"]["C4"], E1, ch, cv, ch, cv, "C")

    data["points"]["normal_1"] = normalize(-E1 + E2)
    data["points"]["normal_2"] = E2
    data["points"]["normal_3"] = normalize(E1 + E2)
    data["points"]["normal_4"] = normalize(E1 - E2)
    data["points"]["normal_5"] = -E2
    data["points"]["normal_6"] = normalize(-E1 - E2)
    for k in range(1, 7):
        base = data["points"][f"mouth_center_{k}"]
        data["planes"][f"bisector_{k}"] = geometry3.Plane.from_points(base, base+data["points"][f"normal_{k}"], base+E3)

    return ret

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
    return { "slate": to_mesh({"vertices": v_slate, "faces": f_slate}) }

def pocket_liner_circle_center(data, pocket):
    """Returns center of the pocket liner circular arc. 
    NOTE this is not the same as fall_center_{pocket}.
    """
    POCKET_TYPE = ("SIDE" if (pocket in (2, 5)) else "CORNER")
    # Pocket center offset to make pocket deeper or shallower:
    OFFSET = data["specs"][f"{POCKET_TYPE}_POCKET_LINER_DEPTH_OFFSET"]

    # LINER_CORNER_D is distance from pocket mouth to center (ignoring z-axis):
    LINER_CORNER_D = OFFSET + data["specs"][f"{POCKET_TYPE}_POCKET_SHELF"] + data["specs"][f"{POCKET_TYPE}_POCKET_RADIUS"]
    # center is the center of the circle that we follow as part of the arc:
    center = data["points"][f"mouth_center_{pocket}"]*(E1 + E2) + LINER_CORNER_D*data["points"][f"normal_{pocket}"]
    center[2] = 0.0
    return center

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
        final_reflects = [geometry3.Plane(E1, 0.0), data["planes"]["bisector_1"]]
    elif (pocket == 4):
        final_reflects = [geometry3.Plane(E2, 0.0), data["planes"]["bisector_4"]]
    elif (pocket == 5):
        final_reflects = [geometry3.Plane(E2, 0.0), data["planes"]["bisector_5"]]
    elif (pocket == 6):
        final_reflects = [geometry3.Plane(E1, 0.0), geometry3.Plane(E2, 0.0)]
    pocket = 2 if (pocket in (2, 5)) else 3

    POCKET_TYPE = ("CORNER" if (pocket == 3) else "SIDE")
    CUSHION_NAME = ("C" if (pocket == 3) else "B")
    MID_ANGLE = (np.pi/4 if (pocket == 3) else np.pi/2)     # angle corresponding to bisector
    # Following results in arc with total 2*NUM_POINTS+1 points:
    NUM_POINTS = data["specs"]["TABLE_POCKET_LINER_NUM_POINTS"]
    bisector = data["planes"][f"bisector_{pocket}"]

    # center is the center of the circle that we follow as part of the arc:
    center = pocket_liner_circle_center(data, pocket)
    center[2] = height

    # Relevant planes to help calculate points:
    # NOTE: in plane_end we need cos(vertical_angle) to correct for the tilt of the plane:
    plane_end = geometry3.Plane.translate(data["planes"][CUSHION_NAME]["end1"], -bulge*np.cos(data["specs"][f"{POCKET_TYPE}_POCKET_VERTICAL_ANGLE"]))
    plane_z_is_height = geometry3.Plane(E3, height)
    plane_rail_back = data["planes"][CUSHION_NAME]["rail_back"]

    # First we need the starting point and direction:
    start = geometry3.Plane.intersection(plane_end, plane_z_is_height, plane_rail_back)
    sp = geometry3.Plane.intersection(plane_end, plane_z_is_height, geometry3.Plane.translate(plane_rail_back, 1.0))
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

    return to_mesh({ "vertices": vertices, "faces": faces })

def create_pocket_liners(data):
    for pocket in range(1, 7):
        data["points"][f"pocket_liner_circle_center_{pocket}"] = pocket_liner_circle_center(data, pocket)
    liners = { pocket: create_one_pocket_liner(data, pocket) for pocket in range(1, 7) }
    return liners

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
    arc1 = apply_reflections(arc3, [geometry3.Plane(E1, 0.0), data["planes"]["bisector_1"]])
    arc6 = apply_reflections(arc3, [geometry3.Plane(E1, 0.0), geometry3.Plane(E2, 0.0)])
    arc4 = apply_reflections(arc3, [geometry3.Plane(E2, 0.0), data["planes"]["bisector_4"]])
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
    
    return { "casing": to_mesh({ "vertices": vertices, "faces": faces}) }
    
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

    return to_mesh({ "vertices": vertices, "faces": [list(range(len(vertices)))] })

def create_rail_tops(data):
    """Merges all rail tops.
    """
    # cushion_pockets = ("A1", "A2", "B2", "B3", "C3", "C4", "D4", "D5", "E5", "E6", "F6", "F1")
    tops = {}
    tops[1] = mesh3.Mesh3.merge([rail_top(data, "F1"), rail_top(data, "A1")])
    tops[2] = mesh3.Mesh3.merge([rail_top(data, "A2"), rail_top(data, "B2")])
    tops[3] = mesh3.Mesh3.merge([rail_top(data, "B3"), rail_top(data, "C3")])
    tops[4] = mesh3.Mesh3.merge([rail_top(data, "C4"), rail_top(data, "D4")])
    tops[5] = mesh3.Mesh3.merge([rail_top(data, "D5"), rail_top(data, "E5")])
    tops[6] = mesh3.Mesh3.merge([rail_top(data, "E6"), rail_top(data, "F6")])
    return { cushion: tops[cushion] for cushion in range(1, 7) }

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
    rs = {}
    rs["B"] = [np.array((offset0, y0, h0)), np.array((w-offset1, y0, h0)), np.array((w-offset1, y1, h0)), np.array((offset0, y1, h0))]
    rs["C"] = [np.array((x0, -w/2+offset1, h0)), np.array((x1, -w/2+offset1, h0)), np.array((x1, w/2-offset1, h0)), np.array((x0, w/2-offset1, h0))]
    rs["A"] = plane_E1.reflect(list(reversed(rs["B"])))
    rs["D"] = plane_E2.reflect(list(reversed(rs["B"])))
    rs["E"] = plane_E1.reflect(plane_E2.reflect(rs["B"]))
    rs["F"] = plane_E1.reflect(list(reversed(rs["C"])))
    f = lambda v_list: to_mesh({ "vertices": v_list, "faces": [[0, 1, 2, 3]] })
    return { cushion: f(rs[cushion]) for cushion in ("A", "B", "C", "D", "E", "F") }

def run(data):
    data["cushions"] = create_cushions(data)
    data["slate"] = create_slate(data)
    data["liners"] = create_pocket_liners(data)
    data["casing"] = create_casing(data)      # not cut into pieces yet, split during uv unwrap
    data["rails"] = create_rail_tops(data)
    data["rail_sights"] = create_rail_sights(data)
    return data

if __name__ == "__main__":
    pass