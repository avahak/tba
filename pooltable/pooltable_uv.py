# 3) Todo UV coords: cushions: [k1,(k1,k2),(k1,k3),(k2,k4),..] order or propagation
# slate: uv=xy or top,bottom uv=xy, custom taking normal from original slice and 
#       extending according to distance on curve
# liners: x=param on path, y=easy after that
# rails: uv=xy
# casing: bottom uv=xy, categorize other faces according to their normal 
#       to x+,x-,y+,y- and for each category just do trivial projection

# 4) (optional?) pack uv-polygons
#       Kinda needed for diamonds

import numpy as numpy

def graph(name, data):
    # what do we need? This is probably mainly for cushions - so we can 
    # propagate the uv coords across edges.
    pass


def run(data):
    for name in ["cushions", "slate", "rails", "rail_sights", "liners", "casing"]:
        mesh = data["normals"][name]
    return data

if __name__ == "__main__":
    pass