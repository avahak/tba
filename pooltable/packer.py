# Input: 1) enclosing rectangle (W,H) 2) list of rectangle sizes (w,h)
# Output: list of positions (x,y) for rectangles or None

# IMPORTANT! For integers:
# DEFINE that (x,y) is in rectangle (x0,y0,w,h) iff 0 <= x-x0 < w and 0 <= y-y0 < h
#
# Note: during .pack we reuse the same bottom left again and again..
# could use some randomness (example to order or rects in) to break the left bottom..

import numpy as np
from math import *
import time
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# following outline in https://github.com/TeamHypersomnia/rectpack2D/blob/master/README.md
def guillotine_pack_fast(W, H, wh_list, DEBUG=False):
    wh_scoring_desca = lambda wh: -np.sqrt(wh[0]*wh[1])   # descending area
    wh_scoring_descratio = lambda wh: np.min(wh, axis=0)/np.max(wh, axis=0)   # descending ratio
    wh_scoring_descss = lambda wh: -np.min(wh, axis=0)   # descending short side
    wh_scoring_descpathology = lambda wh: -np.max(wh, axis=0)   # descending 'pathology'

    f_scoring_baf = lambda f, wh: -f[2]*f[3]   # area
    f_scoring_bssf = lambda f, wh: -np.min([f[2]-wh[0], f[3]-wh[1]])

    #wh_scoring = wh_scoring_descpathology
    wh_scoring = wh_scoring_desca
    f_scoring = f_scoring_baf

    n = wh_list.shape[1]
    xy_list = np.empty((2,n), dtype=np.int32)

    # argsort returns indices that would sort an array
    wh_order = np.argsort(wh_scoring(wh_list))

    # list of empty rectangles:
    f_list = [(0,0,W,H)]

    for k in range(n):
        wh = wh_list[:,wh_order[k]]
        for j, f in enumerate(f_list[::-1]):
            if (wh[0] <= f[2]) and (wh[1] <= f[3]):
                # wh fits in f, place it there:

                if f[2] >= f[3]:
                    # split vertically:
                    new_f_1 = (f[0], f[1]+wh[1], wh[0], f[3]-wh[1])
                    new_f_2 = (f[0]+wh[0], f[1], f[2]-wh[0], f[3])
                else:
                    # split horizontally:
                    new_f_1 = (f[0]+wh[0], f[1], f[2]-wh[0], wh[1])
                    new_f_2 = (f[0], f[1]+wh[1], f[2], f[3]-wh[1])
                if f_scoring(new_f_1, wh) > f_scoring(new_f_2, wh):
                    # swap the new f's:
                    new_f_1, new_f_2 = new_f_2, new_f_1

                xy_list[:,wh_order[k]] = f[0:2]

                f_list[-j-1] = f_list[-1]
                f_list[-1] = new_f_1
                f_list.append(new_f_2)

                break
        else:
            # wh didn't fit in any f:
            return None, None
        f_list = maxrects_prune(f_list, 3000)
        if (DEBUG) and (k % 100 == 0):
            print(f'{k}: |F|={len(f_list)}')
    return np.vstack([xy_list, wh_list]), np.array(f_list).T

def guillotine_pack(W, H, wh_list):
    wh_scoring_desca = lambda wh: -np.sqrt(wh[0]*wh[1])   # descending area
    wh_scoring_descratio = lambda wh: np.min(wh, axis=0)/np.max(wh, axis=0)   # descending ratio
    wh_scoring_descss = lambda wh: -np.min(wh, axis=0)   # descending short side
    wh_scoring_descpathology = lambda wh: -np.max(wh, axis=0)   # descending 'pathology'
    f_scoring_baf = lambda f, wh: f[2]*f[3]   # area
    f_scoring_bssf = lambda f, wh: -np.min([f[2]-wh[0], f[3]-wh[1]])

    #f_scoring = f_scoring_baf
    f_scoring = f_scoring_bssf
    #f_scoring = lambda f, wh: -(f[0]+f[1])
    #wh_scoring = wh_scoring_desca
    #wh_scoring = wh_scoring_descss
    #wh_scoring = lambda wh: 0.5*wh_scoring_descss(wh) + 0.0*wh_scoring_desca(wh)
    wh_scoring = wh_scoring_descpathology

    # best so far seems to be (f_scoring_bssf, wh_scoring_descpathology)
    # (f_scoring_baf, wh_scoring_desca) works better without sorting...??

    n = wh_list.shape[1]
    xy_list = np.empty((2,n), dtype=np.int32)

    # argsort returns indices that would sort an array
    wh_order = np.argsort(wh_scoring(wh_list))
    #print(wh_list[:,wh_order])
    #print(wh_scoring_descss(wh_list[:,wh_order]))

    # wh_list in order of descending rectangle_score:
    #wh_sorted = wh_list[:,wh_order]

    # list of empty rectangles:
    f_list = [(0,0,W,H)]

    for k in range(n):
        wh = wh_list[:,wh_order[k]]
        f_list = sorted(f_list, key=lambda f: f_scoring(f, wh)) # FIX: SLOW
        for j, f in enumerate(f_list[::-1]):
            if (wh[0] <= f[2]) and (wh[1] <= f[3]):
                # wh fits in f, place it there:

                if f[2] >= f[3]:
                    # split vertically:
                    new_f_1 = (f[0], f[1]+wh[1], wh[0], f[3]-wh[1])
                    new_f_2 = (f[0]+wh[0], f[1], f[2]-wh[0], f[3])
                else:
                    # split horizontally:
                    new_f_1 = (f[0]+wh[0], f[1], f[2]-wh[0], wh[1])
                    new_f_2 = (f[0], f[1]+wh[1], f[2], f[3]-wh[1])

                xy_list[:,wh_order[k]] = f[0:2]

                f_list[-j-1] = f_list[-1]
                f_list[-1] = new_f_1
                f_list.append(new_f_2)

                break
        else:
            # wh didn't fit in any f:
            return None, None
        f_list = maxrects_prune(f_list, 500)
        if (k % 100 == 0):
            print(f'{k}: |F|={len(f_list)}')
    return np.vstack([xy_list, wh_list]), np.array(f_list).T

# computes maximal free rectangles after removing rect from free space
def maxrects_update(f_list, rect):
    # step 1: (cut by rect:) for each f in f_list divide it into max 4 parts by rect and construct f_list again by these
    # Throw each new free rectangle obtained by this process into touching_list or separate_list
    # based on whether it intersects R=rect (when both are considered as closed sets).
    # NOTE: When converting all coordinates to integers, need to be real careful here
    # (rectangles can touch even with no integer coord overlap.)
    # [ Maybe with integer coords define f touching R if dist(f,R)<=1. ]
    touching_list = []  # new free rects g with d(g,R) {=0 for reals, <=1 for integers}
    mg_list = []        # final free rectangles, contains all new free rects g that are not touching R
    for f in f_list:
        x1 = max(f[0], rect[0])
        x2 = min(f[0]+f[2], rect[0]+rect[2])
        y1 = max(f[1], rect[1])
        y2 = min(f[1]+f[3], rect[1]+rect[3])
        if (x2-x1 < 0) or (y2-y1 < 0):  # Careful here with integers!!
            # f and rect do not touch:
            mg_list.append(f)
            continue

        # part of f left of rect:
        if rect[0] > f[0]:     # Careful with integers!
            g1 = (f[0], f[1], min(f[2], rect[0]-f[0]), f[3])
            touching_list.append(g1)

        # part of f top of rect:
        if rect[1] > f[1]:
            g2 = (f[0], f[1], f[2], min(f[3], rect[1]-f[1]))
            touching_list.append(g2)

        # part of f right of rect:
        if rect[0]+rect[2] < f[0]+f[2]:
            x = max(f[0], rect[0]+rect[2])
            g3 = (x, f[1], f[0]+f[2]-x, f[3])
            touching_list.append(g3)

        # part of f under rect:
        if rect[1]+rect[3] < f[1]+f[3]:
            y = max(f[1], rect[1]+rect[3])
            g4 = (f[0], y, f[2], f[1]+f[3]-y)
            touching_list.append(g4)

    """touching_count = len(touching_list)
    if touching_count > 30:
        print(f'{touching_count=}')"""

    # step 2: (remove non-maximal:)
    # Make a new list that has every g_list[k1] that is not fully contained in a g_list[k2] for any k2 > k1.
    # TODO: PROVE/DISPROVE: only need to consider g2 that are new too.. would make this much faster if true..
    # well, g1 touches R [i.e. g1\bar\cap R\ne\empty] and g1\subset g2 so g2 touches R..
    # which means that _IF_ we extend new designation to any g that touches R, then g2 is new too
    # SO.. need to extend 'newness' a little (important for integers) but this does not matter with random float coords
    # Fixed: using touching, separate.

    touching_list_removal = np.full((len(touching_list),), False, dtype=bool)
        # Needed to handle possible case where g1 and g2 are the same rectangle, in which case need to only 1 of them.
        # touching_list_removal flags touching_list members for deletion (needed because cant delete while iterating.)
        # Value is set to True if corresponding touching_list member is a subset of another non-flagged touching_list member.
    for k1, g1 in enumerate(touching_list):
        for k2, g2 in enumerate(touching_list):
            if (k1 == k2) or touching_list_removal[k2]:
                # If g2 is flagged for removal then can't test against it.
                continue
            if (g1[0] >= g2[0]) and (g1[1] >= g2[1]) and (g1[0]+g1[2] <= g2[0]+g2[2]) and (g1[1]+g1[3] <= g2[1]+g2[3]):
                # g1\subset g2:
                touching_list_removal[k1] = True
                break
        else:
            # else clause in for-loop is executed when loop completes normally (without break)
            mg_list.append(g1)

    return mg_list

def intersection(f1, f2):
    x1 = max(f1[0], f2[0])
    y1 = max(f1[1], f2[1])
    x2 = min(f1[0]+f1[2], f2[0]+f2[2])
    y2 = min(f1[1]+f1[3], f2[1]+f2[3])
    if (x2 > x1) and (y2 > y1):
        return (x1, y1, x2-x1, y2-y1)
    return None

def maxrects_prune(f_list, max_size):
    LAMBDA = 1.25

    if len(f_list) < LAMBDA*max_size:
        return f_list

    f_scoring_area = lambda f: np.sqrt(f[2]*f[3])
    f_scoring_ss = lambda f: min(f[2], f[3])
    f_scoring_hybrid = lambda kappa: lambda f: min(f[2], f[3])*np.power(max(f[2], f[3]), kappa)

    f_scoring = f_scoring_area
    #f_scoring = f_scoring_ss
    #f_scoring = f_scoring_hybrid(0.5)

    sf_list = sorted(f_list, key=f_scoring, reverse=True)
    pf_list = sf_list[0:max_size]
    return pf_list

# tetris-algorithm (MAXRECTS-BL):
def maxrects_pack(W, H, wh_list, DEBUG=False):
    n = wh_list.shape[1]

    wh_scoring_desca = lambda wh: -np.sqrt(wh[0]*wh[1])   # descending area
    wh_scoring_descratio = lambda wh: np.min(wh, axis=0)/np.max(wh, axis=0)   # descending ratio
    wh_scoring_descss = lambda wh: -np.min(wh, axis=0)   # descending short side
    wh_scoring_descpathology = lambda wh: -np.max(wh, axis=0)   # descending 'pathology'
    wh_scoring_rand = lambda wh: np.random.rand(n)
    wh_scoring_w = lambda wh: -wh[0]   # descending width
    wh_scoring_h = lambda wh: -wh[1]   # descending height
    f_scoring_baf = lambda f, wh: f[2]*f[3]   # area
    f_scoring_bssf = lambda f, wh: -np.min([f[2]-wh[0], f[3]-wh[1]])

    #f_scoring = f_scoring_baf
    #f_scoring = f_scoring_bssf
    #wh_scoring = wh_scoring_desca
    #wh_scoring = wh_scoring_h
    #wh_scoring = wh_scoring_descss
    #wh_scoring = wh_scoring_descratio
    #wh_scoring = wh_scoring_descpathology
    #wh_scoring = wh_scoring_rand
    #wh_scoring = lambda wh: 0.5*wh_scoring_descpathology(wh) + 0.5*wh_scoring_desca(wh)
    wh_scoring = lambda wh: wh_scoring_descpathology(wh)*(1.0+0.1*np.random.randn(n))

    # best so far seems to be (f_scoring_bssf, wh_scoring_descpathology)
    # (f_scoring_baf, wh_scoring_desca) works better without sorting...??

    xy_list = np.empty((2,n), dtype=wh_list.dtype)

    # argsort returns indices that would sort an array
    wh_order = np.argsort(wh_scoring(wh_list))
    """wh_order2 = np.argsort(wh_scoring(wh_list))
    wh_order3 = list(reversed(wh_order2))
    z = zip(wh_order2, wh_order3)
    wh_order = [x for pair in z for x in pair]  # understand list comprehension by imagining them as actual for-loops
    """
    #wh_order = np.arange(0, n)
    #print(wh_list[:,wh_order])
    #print(wh_scoring_descss(wh_list[:,wh_order]))

    # wh_list in order of descending rectangle_score:
    #wh_sorted = wh_list[:,wh_order]

    # list of empty rectangles:
    f_list = [(0,0,W,H)]

    for k in range(n):
        wh = wh_list[:,wh_order[k]]
        f_list = sorted(f_list, key=lambda f: f[0]+f[1])

        for f in f_list:
            if (wh[0] <= f[2]) and (wh[1] <= f[3]):
                # wh fits in f, place it there:
                xy = f[0:2]
                rect = (xy[0], xy[1], wh[0], wh[1])
                f_list = maxrects_update(f_list, rect)
                xy_list[:,wh_order[k]] = xy
                break
        else:
            return None, None

        f_list = maxrects_prune(f_list, 3000)
        if (DEBUG) and (k % 100 == 0):
            print(f'{k}: |F|={len(f_list)}')

    return np.vstack([xy_list, wh_list]), np.array(f_list).T

def cdf(t, inverse=False):
    # t is in [-1,1]
    # choosing the pdf is pretty arbitrary..
    # x>0: pdf(x)=1-x, x<0:pdf(x)=1+x
    # y>0.5: y=cdf(x)=int(1-t,t=0..x)=0.5+x-0.5*x^2: x^2-2x+2y-1=0: x=1-sqrt(2-2y)
    # y<0.5: y=int(1+t,t=-1..x)=(x+x^2/2)|(-1..x)=x+x^2/2+0.5: x^2+2x+1-2y=0: x=-1+sqrt(2y)
    if inverse:
        return 1.0-sqrt(2.0-2.0*t) if t >= 0.5 else -1.0+sqrt(2.0*t)
    return 0.5+t-0.5*t*t if t >= 0.0 else 0.5+t+0.5*t*t

def generate_normalized_samples(n, a, b):
    # generate samples from [a,b]\subset [-1,1]:
    cdf_a = cdf(a)
    cdf_b = cdf(b)
    samples = np.empty(n)
    for k in range(n):
        y = cdf_a + (cdf_b-cdf_a)*np.random.rand()
        samples[k] = cdf(y, inverse=True)
    return samples

def generate_samples(n, A, WH0):
    # returns n (w,h) pairs with wh=A, (w,h)>=WH0
    # TODO: how to do this?
    ang1 = atan2(WH0[1], A/WH0[1])  # corresponds (w,h) with wh=A, h=WH0[1]
    ang2 = atan2(A/WH0[0], WH0[0])  # corresponds (w,h) with wh=A, w=WH0[0]
    if ang1 > ang2:
        return None
    # ang1<=ang2 since we assume that A>=WH0[0]*WH0[1]
    # transform angles to [-1,1]:
    a = -1.0 + ang1/(pi/4.0)
    b = -1.0 + ang2/(pi/4.0)
    # now [a,b]\subset [-1,1] and we want to
    samples = np.empty((2,n), dtype=WH0.dtype)
    normalized_samples = generate_normalized_samples(n, a, b)
    # first try should be sample closest to aspect ratio 1:
    for k in range(n):
        x = normalized_samples[k]
        ang = (x + 1.0)*pi/4.0
        if k < n/2:
            # first try should be sample close to aspect ratio 1
            # if it doesn't work, do more general sampling with the others
            if (ang1 > pi/4.0):
                # both angles > pi/4, select smaller:
                ang = ang1
            elif (ang2 < pi/4.0):
                # both angles < pi/4, select smaller:
                ang = ang2
            else:
                # ang1 < pi/4 < ang2, select pi/4
                ang = pi/4.0
            # but add a little randomness or we just compute same initial steps every time:
            ang = max(min(ang+0.1*(2.0*np.random.rand()-1.0), ang2), ang1)
        r = sqrt(A / (sin(ang)*cos(ang)))   # since r*cos(ang) * r*sin(ang) = A
        if np.issubdtype(WH0.dtype, np.integer):
            samples[:,k] = (round(r*cos(ang)), round(r*sin(ang)))
        else:
            samples[:,k] = (r*cos(ang), r*sin(ang))
    return samples

# testing multiple (W,H) to find a small atlas
def pack(wh_list):
    start_time = time.time()

    C1 = 1.0001  # error tolerance for A
    SN = 8     # number of samples to test until we give up on A

    best_packing = None
    best_A = None

    pack_count = 0

    WH0 = np.array((np.max(wh_list[0]), np.max(wh_list[1])))
    print(WH0, WH0.dtype)
    A0 = np.sum(wh_list[0]*wh_list[1])
    print(f'{WH0=}, {A0=}')

    maxA = 1.0e10    # ~infinity
    minA = max(A0, WH0[0]*WH0[1])
    while maxA > C1*minA:
        A = min(2.0*minA, 0.5*(minA+maxA))
        print(f'testing {A=:.3f} ({minA=:.3f}, {maxA=:.3f}):')
        samples = generate_samples(SN, A, WH0)
        #print(f'{   samples=}')
        for WH in samples.T:
            packing = maxrects_pack(WH[0], WH[1], wh_list)
            #packing = guillotine_pack_fast(WH[0], WH[1], wh_list)
            pack_count += 1
            if packing[0] is not None:
                # packing found:
                print(f'   success! efficiency={A0/A:.6f}')
                best_packing = packing
                best_A = WH[0]*WH[1]
                print(f"   {WH = }, {best_A = }")
                # caller.log_success(WH, packing)
                maxA = A
                break
            # caller.log_fail(WH)
        else:
            # no packing found in samples:
            print('   fail!')
            minA = A
            # more conservative, takes twice as long:
            #minA = 0.5*(minA+A)
    print(f'Pack done, smallest A found: {best_A}, packing efficiency: {A0/best_A:.6f}.')
    print(f'Packing took {time.time()-start_time:.1f} seconds and {pack_count} wh-configurations were tested.')
    draw_packing(best_packing)
    return best_packing

# First create n random rectangles with areas summing to 1,
# then scale them up with factor scale and round to integers.
def random_wh(n, scale):
    areas = np.power(np.random.rand(n), 2.0)    # 2.0
    areas = areas / np.sum(areas)

    wh_ratio = np.power(np.random.rand(n), 0.75)     # 0.5
    wh_ratio = np.where(np.random.rand(n) < 0.5, wh_ratio, 1.0/wh_ratio)

    wh_list = np.sqrt(areas) * np.sqrt(np.array([wh_ratio, 1.0/wh_ratio]))
    # Now wh_list is list of n random rectangles with areas summing to 1.

    return np.array(np.ceil(scale*wh_list), dtype=np.int32)
    # We need ceil here since we need w,h to be strictly positive integers.

def draw_packing(packing):
    fig, ax = plt.subplots()

    WH = (np.max(packing[0][0,:]+packing[0][2,:]), np.max(packing[0][1,:]+packing[0][3,:]))
    print(WH)

    # Plot the enclosing rectangle
    ax.add_patch(patches.Rectangle((0, 0), WH[0], WH[1], linewidth=1, edgecolor='black', facecolor='none'))
    ax.set_xlim(0, WH[0])
    ax.set_ylim(0, WH[1])

    for k in range(packing[0].shape[1]):
        rect = packing[0][:,k]
        xy = rect[0:2]
        wh = rect[2:]
        color = np.random.rand(3)
        ax.add_patch(patches.Rectangle(xy, wh[0], wh[1], linewidth=1, edgecolor='black', facecolor=color))

    # Set the aspect ratio of the plot to be equal
    ax.set_aspect('equal', 'box')
    plt.show()

def test_pack():
    n = 100
    wh_list = random_wh(n, 5000.0)
    A0 = np.sum(wh_list[0]*wh_list[1])
    WH0 = (np.max(wh_list[0]), np.max(wh_list[1]))
    print(wh_list.shape)
    pack(wh_list)

def test_cdf():
    print('Testing generate_normalized_samples:')

    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, tight_layout=True)

    x_list = np.linspace(-1.0, 1.0, 100)
    y_list = [cdf(x, False) for x in x_list]
    ax1.plot(x_list, y_list)
    ax1.set_title('$cdf$')
    ax1.set_aspect('equal')

    x_list = np.linspace(0.0, 1.0, 100)
    y_list = [cdf(x, True) for x in x_list]
    ax2.plot(x_list, y_list)
    ax2.set_title('${cdf}^{-1}$')
    ax2.set_aspect('equal')

    n = 1000000
    samples = generate_normalized_samples(n, -0.2, 0.5)
    ax3.hist(samples, bins=100)

    fig.set_size_inches(16.0, 6.0)
    plt.show(block=True)

    samples = generate_samples(20, 1000.0, (10.0, 10.0))
    print(samples)

if __name__ == '__main__':
    test_pack()