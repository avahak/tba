export { canvasTextBoundingBox, closestPoint }
import * as THREE from 'three';

console.log("util.ts");

/**
 * Computes the closest point on the triangle a, b, c to p.
 */
function closestPoint(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    // Below lambda_a, lambda_b, lambda_c are barycentric coordinates for p*=proj_{abc plane}(p).
    // Lambda_c, lambda_b can be obtained requiring that a+lambda_b*(b-a)+lambda_c*(c-a) = p* 
    // and then testing this by taking inner product of both sides with b-a and c-a. 
    // After that \lambda_a=1-\lambda_b-\lambda_c. The formulas used are optimized forms
    // that avoid the need for intermediate calculations. I am not aware of the derivation 
    // of these formulas, only the proof that they work.
    // See https://github.com/embree/embree/blob/master/tutorials/common/math/closest_point.h
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);

    // Closest point a:
    const ap = p.clone().sub(a);
    const ab_ap = ab.dot(ap);
    const ac_ap = ac.dot(ap);
    if ((ab_ap <= 0.0) && (ac_ap <= 0.0))
        return a;

    // Closest point b:
    const bp = p.clone().sub(b);
    const ab_bp = ab.dot(bp);
    const ac_bp = ac.dot(bp);
    if ((ab_bp >= 0.0) && (ac_bp <= ab_bp))
        return b;

    // Closest point c:
    const cp = p.clone().sub(c);
    const ab_cp = ab.dot(cp);
    const ac_cp = ac.dot(cp);
    if ((ac_cp >= 0.0) && (ab_cp <= ac_cp))
        return c;
    
    // Closest point on edge (a, b): (lambda_c is barycentric coordinate coefficient for c)
    const lambda_c = ab_ap*ac_bp - ab_bp*ac_ap;    // = ab_ab*ac_ap - ab_ac*ab_ap
    if ((lambda_c <= 0.0) && (ab_ap >= 0.0) && (ab_bp <= 0.0)) {
        const v = ab_ap / (ab_ap - ab_bp);
        return ab.clone().multiplyScalar(v).add(a);
    }
    
    // Closest point on edge (a, c):
    const lambda_b = ab_cp*ac_ap - ab_ap*ac_cp;    // = ac_ac*ab_ap - ab_ac*ac_ap
    if ((lambda_b <= 0.0) && (ac_ap >= 0.0) && (ac_cp <= 0.0)) {
        const v = ac_ap / (ac_ap - ac_cp);
        return ac.clone().multiplyScalar(v).add(a);
    }
    
    // Closest point on edge (b, c):
    const lambda_a = ab_bp*ac_cp - ab_cp*ac_bp;    // = bc_bc*ba_bp - bc_ba*bc_bp
    if ((lambda_a <= 0.0) && (ac_bp >= ab_bp) && (ab_cp >= ac_cp)) {
        const v = (ac_bp-ab_bp) / ((ac_bp-ab_bp) + (ab_cp-ac_cp));
        return c.clone().sub(b).multiplyScalar(v).add(c);
    }
    
    // Closest point inside the triangle:
    const lambda_sum = lambda_a + lambda_b + lambda_c;
    const lambdas = new THREE.Vector3(lambda_a/lambda_sum, lambda_b/lambda_sum, lambda_c/lambda_sum);
    return a.clone().multiplyScalar(lambdas.x).add(b.clone().multiplyScalar(lambdas.y)).add(c.clone().multiplyScalar(lambdas.z));
}

/**
 * Returns bounding box for text drawn on canvas element.
 */
function canvasTextBoundingBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number[] {
    let textMetrics = ctx.measureText(text);
    let x1 = textMetrics.actualBoundingBoxLeft;
    let x2 = textMetrics.actualBoundingBoxRight;
    let y1 = textMetrics.actualBoundingBoxAscent;
    let y2 = textMetrics.actualBoundingBoxDescent;
    return [x-x1, y-y1, x1+x2, y1+y2];
}