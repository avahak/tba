export { canvasTextBoundingBox, closestPoint, drawArrow, closestIntervalPoint, parseNumberBetween, combineBboxes, copyToClipboard };
import * as THREE from 'three';
console.log("util.ts");
/**
 * Computes the closest point on the triangle a, b, c to p.
 */
function closestPoint(p, a, b, c) {
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
    const lambda_c = ab_ap * ac_bp - ab_bp * ac_ap; // = ab_ab*ac_ap - ab_ac*ab_ap
    if ((lambda_c <= 0.0) && (ab_ap >= 0.0) && (ab_bp <= 0.0)) {
        const v = ab_ap / (ab_ap - ab_bp);
        return ab.clone().multiplyScalar(v).add(a);
    }
    // Closest point on edge (a, c):
    const lambda_b = ab_cp * ac_ap - ab_ap * ac_cp; // = ac_ac*ab_ap - ab_ac*ac_ap
    if ((lambda_b <= 0.0) && (ac_ap >= 0.0) && (ac_cp <= 0.0)) {
        const v = ac_ap / (ac_ap - ac_cp);
        return ac.clone().multiplyScalar(v).add(a);
    }
    // Closest point on edge (b, c):
    const lambda_a = ab_bp * ac_cp - ab_cp * ac_bp; // = bc_bc*ba_bp - bc_ba*bc_bp
    if ((lambda_a <= 0.0) && (ac_bp >= ab_bp) && (ab_cp >= ac_cp)) {
        const v = (ac_bp - ab_bp) / ((ac_bp - ab_bp) + (ab_cp - ac_cp));
        return c.clone().sub(b).multiplyScalar(v).add(c);
    }
    // Closest point inside the triangle:
    const lambda_sum = lambda_a + lambda_b + lambda_c;
    const lambdas = new THREE.Vector3(lambda_a / lambda_sum, lambda_b / lambda_sum, lambda_c / lambda_sum);
    return a.clone().multiplyScalar(lambdas.x).add(b.clone().multiplyScalar(lambdas.y)).add(c.clone().multiplyScalar(lambdas.z));
}
/**
 * Returns bounding box for text drawn on canvas element.
 */
function canvasTextBoundingBox(ctx, text, x, y) {
    let textMetrics = ctx.measureText(text);
    let x1 = textMetrics.actualBoundingBoxLeft;
    let x2 = textMetrics.actualBoundingBoxRight;
    let y1 = textMetrics.actualBoundingBoxAscent;
    let y2 = textMetrics.actualBoundingBoxDescent;
    return [new THREE.Vector2(x - x1, y - y1), new THREE.Vector2(x + x2, y + y2)];
}
function drawArrow(ctx, p1, p2) {
    let dir = p2.clone().sub(p1).normalize();
    let dir2 = dir.clone().rotateAround(new THREE.Vector2(), 0.8 * Math.PI);
    let dir3 = dir.clone().rotateAround(new THREE.Vector2(), -0.8 * Math.PI);
    const hookLength = Math.min(0.15 * p1.distanceTo(p2), 20);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x + hookLength * dir2.x, p2.y + hookLength * dir2.y);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x + hookLength * dir3.x, p2.y + hookLength * dir3.y);
    // ctx.setLineDash([20, 10]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.closePath();
}
/**
 * Returns point closest to x on interval [min(a,b),max(a,b)].
 */
function closestIntervalPoint(x, a, b) {
    if (x < a && x < b)
        return Math.min(a, b);
    if (x > a && x > b)
        return Math.max(a, b);
    return x;
}
function parseNumberBetween(value, minValue, maxValue, defaultValue) {
    let x = parseFloat(value);
    if (isFinite(x))
        return Math.max(Math.min(x, maxValue), minValue);
    return defaultValue;
}
function combineBboxes(bboxes) {
    const bb = [+Infinity, +Infinity, -Infinity, -Infinity];
    bboxes.forEach((bbox) => {
        bb[0] = Math.min(bb[0], bbox[0].x);
        bb[1] = Math.min(bb[1], bbox[0].y);
        bb[2] = Math.max(bb[2], bbox[1].x);
        bb[3] = Math.max(bb[3], bbox[1].y);
    });
    return [new THREE.Vector2(bb[0], bb[1]), new THREE.Vector2(bb[2], bb[3])];
}
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        console.log('Text successfully copied to clipboard:', text);
    }
    catch (err) {
        console.error('Unable to copy text to clipboard:', err);
    }
}
