"""Quick messy handmade methods to uv unpack the meshes.
Containers (=materials):
    1) Cushions ("cushions", "A"-"F")
    2) Slate ("slate", "slate")
    3) Rails ("rails", 1-6)
    4) Rail sights ("rail_sights", "A"-"F")
    5) Liners ("liners", 1-6)
    6) Casing ("casing", 0-4)
"""
# The sights may be round (between 7/16 [11.11 mm] and ½ inch [12.7 mm] in diameter) 
# or diamond-shaped (between 1 x 7/16 [25.4 x 11.11 mm] and 1 ¼ x 5/8 inch [31.75 x 15.875 mm]).

import numpy as np
from PIL import Image, ImageDraw
# from scipy.spatial.transform import Rotation
from typing import Any
import geometry3, mesh3, packer

E1 = np.array((1.0, 0.0, 0.0))
E2 = np.array((0.0, 1.0, 0.0))
E3 = np.array((0.0, 0.0, 1.0))

INCH = 0.0254
DEGREE = np.pi/180.0

def normalize(p):
    return p / np.linalg.norm(p)

def propagate(face_from, face):
    """Propagates uv-coords across a common edge from self to other face.
    """
    # Create a list of vertices that both faces share:
    common_pts = []
    for kp_from, p_from in enumerate(face_from.pts):
        for kp_to, p_to in enumerate(face.pts):
            if np.linalg.norm(p_from-p_to) < 1.0e-9:
                common_pts.append((kp_from, kp_to))
    if len(common_pts) < 2:
        return False
    for k in range(2):
        face.uvs[common_pts[k][1]] = face_from.uvs[common_pts[k][0]]
    z1 = complex(np.dot(face.basis[0], face.pts[common_pts[0][1]]), np.dot(face.basis[1], face.pts[common_pts[0][1]]))
    z2 = complex(np.dot(face.basis[0], face.pts[common_pts[1][1]]), np.dot(face.basis[1], face.pts[common_pts[1][1]]))
    w1 = complex(face.uvs[common_pts[0][1]][0], face.uvs[common_pts[0][1]][1])
    w2 = complex(face.uvs[common_pts[1][1]][0], face.uvs[common_pts[1][1]][1])
    # z1 -> w1, z2 -> w2 in a similarity
    # w = A*z+B: w1-A*z1 = B, w2 = A*z2+B = A*z2 + w1 - A*z1
    # w2-w1 = A*(z2-z1): A = (w2-w1)/(z2-z1), B = w1-A*z1
    A = (w2-w1) / (z2-z1)
    B = w1 - A*z1
    for kp, p in enumerate(face.pts):
        z = complex(np.dot(face.basis[0], p), np.dot(face.basis[1], p))
        w = A*z + B
        face.uvs[kp] = np.array((w.real, w.imag))
    return True

def init_uvs(mesh):
    for face in mesh.fs:
        for k, p in enumerate(face.pts):
            face.uvs[k] = np.array((np.dot(p, E1), np.dot(p, E2)))

def face_in_plane(face, plane):
    for p in face.pts:
        if plane.distance(p) > 1.0e-9:
            return False
    return True

def unwrap_cushion(data, cushion):
    """Idea: propagate the uv-coordinates from face to face in order given by 
    propagation_order.
    """
    mesh = data["cushions"][cushion]
    propagation_order = (("rail_top", "end1"), ("rail_top", "end2"), ("rail_top", "rail_back"), ("rail_top", "rubber_top"), ("rubber_top", "rubber_bottom"), ("rubber_bottom", "slate"))
    plane_names = ("end1", "end2", "rail_back", "rail_top", "rubber_top", "rubber_bottom", "slate")
    plane_faces = { name: set() for name in plane_names }
    face_to_plane = {}
    for plane_name in plane_names:
        for face in mesh.fs:
            if face_in_plane(face, data["planes"][cushion][plane_name]):
                plane_faces[plane_name].add(face)
                face_to_plane[face] = plane_name
    propagating = plane_faces["rail_top"]
    propagated_already = set()
    while propagating:
        propagating_next = set()
        for face_to in mesh.fs:
            for face_from in propagating:
                if (face_to_plane[face_from], face_to_plane[face_to]) not in propagation_order:
                    if face_to_plane[face_from] != face_to_plane[face_to]:
                        continue
                result = propagate(face_from, face_to)
                if result and (not face_to in propagated_already):
                    propagating_next.add(face_to)
        propagated_already.update(propagating)
        propagating = propagating_next

def unwrap_liner(data, pocket):
    """UV-unwrap the pocket liner with uv_x=angle as seen from the center of the liner.
    """
    pocket_type = "SIDE" if pocket in (2, 5) else "CORNER"
    center = data["points"][f"pocket_liner_circle_center_{pocket}"]
    mesh = data["liners"][pocket]
    h0 = data["specs"]["TABLE_RAIL_HEIGHT"]
    for face in mesh.fs:
        p0 = face.basis[3]      # Center of the face
        vertical_angle = data["specs"][f"{pocket_type}_POCKET_VERTICAL_ANGLE"]
        n = data["points"][f"normal_{pocket}"]
        v = -np.cross(n, E3)
        # Now (n, v, E3) forms an orthonormal basis that we operate with.

        for k, p in enumerate(face.pts):
            angle = np.arctan2(np.dot(p-center, v), np.dot(p-center, n))
            # The following is just an approximation, a heuristic:
            uv_x = (0.5*data["specs"][f"{pocket_type}_POCKET_MOUTH"] + (h0-p[2])*np.tan(vertical_angle)) * angle
            uv_y = None
            if np.linalg.norm(face.basis[2]-E3) < 1.0e-9:
                # face is horizontal
                if np.linalg.norm(p-center) > np.linalg.norm(p0-center):
                    # vertex is on outside
                    uv_y = h0 + data["specs"]["TABLE_POCKET_LINER_WIDTH"]
                else:
                    # vertex is on inside
                    uv_y = h0
            else:
                # face is vertical
                uv_y = p[2]
            face.uvs[k] = np.array((uv_x, uv_y))

def unwrap_and_split_casing(data):
    """Idea: crudely project faces to one of preselected directions that
    is closest face normal. Also split the mesh into 5 pieces (bottom,+x,+y,-x,-y).
    """
    vertical_angle = data["specs"]["TABLE_CASING_VERTICAL_ANGLE"]
    n1 = np.array((np.cos(vertical_angle), 0.0, -np.sin(vertical_angle)))
    n2 = np.array((0.0, np.cos(vertical_angle), -np.sin(vertical_angle)))
    normals = (-E3, n1, n2, -n1, -n2)
    main_directions = (E1, E2, -E1, -E2, E1)
    mesh = data["casing"]["casing"]
    sub_meshes = { num: mesh3.Mesh3() for num in range(len(normals)) }
    for face in mesh.fs:
        closest = np.argmin([-np.dot(n*(E1+E2), face.basis[2]) for n in normals])
        n = normals[closest]
        uv_x = main_directions[closest]
        uv_y = normalize(np.cross(n, uv_x))
        # Now (uv_x, uv_y, n) is used as a basis for uv projection:
        for k, p in enumerate(face.pts):
            face.uvs[k] = np.array((np.dot(uv_x, p), np.dot(uv_y, p)))
        sub_meshes[closest].add_face(face)
    data["casing"] = sub_meshes

def transform_uvs(mesh, A: complex, B: complex):
    """Transforms all uv-coordinates with z -> A*x+B.
    """
    for face in mesh.fs:
        for k, uv in enumerate(face.uvs):
            w = A*complex(uv[0], uv[1]) + B
            face.uvs[k] =  np.array((w.real, w.imag))

def uv_bounding_box(mesh, gap=0.0):
    bbox = np.array(((np.inf, np.inf), (-np.inf, -np.inf)))     # ((x_min,y_min),(w,h))
    for face in mesh.fs:
        for uv in face.uvs:
            bbox[0][0] = min(uv[0]-gap, bbox[0][0])
            bbox[0][1] = min(uv[1]-gap, bbox[0][1])
            bbox[1][0] = max(uv[0]+gap, bbox[1][0])
            bbox[1][1] = max(uv[1]+gap, bbox[1][1])
    bbox[1] = (bbox[1][0]-bbox[0][0], bbox[1][1]-bbox[0][1])
    return bbox

def sights_pos(data, cushion_name, index):
    """Returns position of the sights in the xy-plane.
    """
    data["specs"]["TABLE_SIGHTS_DEPTH"] # from nose
    sights_top = lambda k: np.array((k*data["specs"]["TABLE_LENGTH"]/8, data["specs"]["TABLE_LENGTH"]/4+data["specs"]["TABLE_SIGHTS_DEPTH"]))
    sights_right = lambda k: np.array((data["specs"]["TABLE_LENGTH"]/2+data["specs"]["TABLE_SIGHTS_DEPTH"], (k-2)*data["specs"]["TABLE_LENGTH"]/8))
    if cushion_name == "A":
        return sights_top(-index)
    if cushion_name == "B":
        return sights_top(index)
    if cushion_name == "C":
        return sights_right(index)
    if cushion_name == "D":
        return -sights_top(-index)
    if cushion_name == "E":
        return -sights_top(index)
    if cushion_name == "F":
        return -sights_right(index)

def draw_sights(data, atlas):
    """Draws the sights (diamonds) on rail_sights.
    """
    draw = ImageDraw.Draw(atlas)
    WH = np.array(atlas.size)
    for cushion_name in ("A", "B", "C", "D", "E", "F"):
        face = data["rail_sights"][cushion_name].fs[0]
        v0 = face.pts[0]
        v1, v2 = face.pts[1]-v0, face.pts[2]-v0
        for k in range(1, 4):
            p = np.array((*sights_pos(data, cushion_name, k), data["specs"]["TABLE_RAIL_HEIGHT"]))

            A = np.vstack([v1, v2, E3]).T
            c = np.linalg.solve(A, p-v0)
            uv = face.uvs[0] + c[0]*(face.uvs[1]-face.uvs[0]) + c[1]*(face.uvs[2]-face.uvs[0])

            # Convert radius of sight from meters to pixels:
            r = data["specs"]["TABLE_RAIL_SIGHTS_RADIUS"]
            c = np.linalg.solve(A, r*E1)
            duv = c[0]*(face.uvs[1]-face.uvs[0]) + c[1]*(face.uvs[2]-face.uvs[0])
            r_pixels = np.linalg.norm(WH*duv)

            img_pos = (WH[0]*uv[0]-r_pixels, WH[1]*uv[1]-r_pixels, WH[0]*uv[0]+r_pixels, WH[1]*uv[1]+r_pixels)
            draw.ellipse(img_pos, fill=(230,230,235), outline=(0,0,0))

def tile_image(source_image, target_wh):
    """Creates a tiled version of the source image
    """
    tiled_image = Image.new('RGB', (target_wh[0], target_wh[1]))
    source_width, source_height = source_image.size
    for y in range(0, target_wh[1], source_height):
        for x in range(0, target_wh[0], source_width):
            tiled_image.paste(source_image, (x, y))
    return tiled_image

def image_paste(target_img, source_img, data, bbox, mesh_name):
    for key, mesh in data[mesh_name].items():
        xy = (data["specs"]["UV_PIXELS_PER_METER"]*bbox[(mesh_name,key)][0][0], data["specs"]["UV_PIXELS_PER_METER"]*bbox[(mesh_name,key)][0][1])
        wh = (data["specs"]["UV_PIXELS_PER_METER"]*bbox[(mesh_name,key)][1][0], data["specs"]["UV_PIXELS_PER_METER"]*bbox[(mesh_name,key)][1][1])
        xy = np.array(xy).astype(int)
        wh = np.array(wh).astype(int)
        region = (xy[0], xy[1], xy[0]+wh[0], xy[1]+wh[1])
        crop = source_img.crop(region)
        target_img.paste(crop, (xy[0], xy[1]))

def create_atlas(data, bbox):
    bbox_all = np.array(((np.inf, np.inf), (-np.inf, -np.inf)))
    for bb in bbox.values():
        bbox_all[0][0] = min(bb[0][0], bbox_all[0][0])
        bbox_all[0][1] = min(bb[0][1], bbox_all[0][1])
        bbox_all[1][0] = max(bb[0][0]+bb[1][0], bbox_all[1][0])
        bbox_all[1][1] = max(bb[0][1]+bb[1][1], bbox_all[1][1])
    bbox_all[1] = (bbox_all[1][0]-bbox_all[0][0], bbox_all[1][1]-bbox_all[0][1])
    WH = (data["specs"]["UV_PIXELS_PER_METER"]*bbox_all[1][0], data["specs"]["UV_PIXELS_PER_METER"]*bbox_all[1][1])
    WH = np.ceil(WH).astype(int)
    image1 = tile_image(Image.open("d:/resources/img/wood_dark.jpg"), WH)
    image2 = tile_image(Image.open("d:/resources/img/cloth1.png"), WH)
    image3 = tile_image(Image.open("d:/resources/img/contour.jpg"), WH)
    image4 = tile_image(Image.open("d:/resources/img/wood1.jpg"), WH)
    image5 = Image.new('RGB', (WH[0], WH[1]), (20, 20, 50))
    image6 = Image.new('RGB', (WH[0], WH[1]), (20, 20, 10))
    atlas = Image.new('RGB', (WH[0], WH[1]), (50, 50, 100))
    image_paste(atlas, image2, data, bbox, "cushions")
    image_paste(atlas, image2, data, bbox, "slate")
    image_paste(atlas, image1, data, bbox, "rail_sights")
    image_paste(atlas, image5, data, bbox, "rails")
    image_paste(atlas, image3, data, bbox, "casing")
    image_paste(atlas, image6, data, bbox, "liners")
    return atlas, bbox_all

def run(data):
    mesh_names = ("cushions", "slate", "rails", "rail_sights", "liners", "casing")
    cushion_names = ("A", "B", "C", "D", "E", "F")
    for name in mesh_names:
        for mesh in data[name].values():
            init_uvs(mesh)
    for cushion in cushion_names:
        unwrap_cushion(data, cushion)
    for pocket in range(1, 7):
        unwrap_liner(data, pocket)
    unwrap_and_split_casing(data)

    # Rotate vertically aligned long pieces 90 degrees:
    transform_uvs(data["cushions"]["C"], complex(0.0, -1.0), 0.0)
    transform_uvs(data["cushions"]["F"], complex(0.0, -1.0), 0.0)
    transform_uvs(data["rail_sights"]["C"], complex(0.0, -1.0), 0.0)
    transform_uvs(data["rail_sights"]["F"], complex(0.0, -1.0), 0.0)

    # Enhance selected prominent parts of the model:
    transform_uvs(data["slate"]["slate"], data["specs"]["UV_ENHANCE_FACTOR"][1], 0.0)
    for cushion_name in cushion_names:
        transform_uvs(data["cushions"][cushion_name], data["specs"]["UV_ENHANCE_FACTOR"][1], 0.0)
        transform_uvs(data["rail_sights"][cushion_name], data["specs"]["UV_ENHANCE_FACTOR"][1], 0.0)
    for k in range(1, 5):
        transform_uvs(data["casing"][k], data["specs"]["UV_ENHANCE_FACTOR"][0], 0.0)

    # Pack the parts:
    bbox = {}
    wh_all = []
    packing_indexing = {}
    for name in mesh_names:
        wh_list = []
        for key, mesh in data[name].items():
            bbox[(name, key)] = uv_bounding_box(mesh, data["specs"]["UV_TEXTURE_GAP"]/data["specs"]["UV_PIXELS_PER_METER"])
            packing_indexing[(name, key)] = len(wh_all)
            wh_list.append(bbox[(name, key)][1,:])
            wh_all.append(bbox[(name, key)][1,:])
        wh_list = np.array(wh_list)
        wh_list = np.array((wh_list[:,0], wh_list[:,1]))
        # packing = packer.pack(wh_list)

    wh_all = np.array(wh_all)
    wh_all = np.array((wh_all[:,0], wh_all[:,1]))
    packing = packer.pack(wh_all)

    # Apply the packing to the uv-coords:
    for name in mesh_names:
        for key, mesh in data[name].items():
            xy = packing[0][0:2,packing_indexing[(name, key)]] - bbox[(name, key)][0,:]
            transform_uvs(mesh, 1.0, complex(xy[0], xy[1]))

    # We still need to create the atlas image by patching multiple source images together:
    for name in mesh_names:
        for key, mesh in data[name].items():
            bbox[(name, key)] = uv_bounding_box(mesh, data["specs"]["UV_TEXTURE_GAP"]/data["specs"]["UV_PIXELS_PER_METER"])
    atlas, bbox_all = create_atlas(data, bbox)
    
    # Scale uv coords to 0..1 range:
    for name in mesh_names:
        for key, mesh in data[name].items():
            for face in mesh.fs:
                for k, uv in enumerate(face.uvs):
                    uv_x = (uv[0]-bbox_all[0][0]) / bbox_all[1][0]
                    uv_y = (uv[1]-bbox_all[0][1]) / bbox_all[1][1]
                    face.uvs[k] = np.array((uv_x, uv_y))

    draw_sights(data, atlas)

    file_name = "obj/atlas.jpg"
    atlas = atlas.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    atlas.save(file_name, quality=80)
    print(f"File {file_name} written.")

    return data

if __name__ == "__main__":
    pass