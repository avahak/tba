/**
 * Misc coordinate transformations.
 */

export { pixelsToNDC, NDCToPixels, NDCToWorld3, NDCToWorld2, world2ToNDC }
import * as THREE from 'three';

console.log("transformation.ts");

/**
	 * Converts p given in pixels to OpenGL normalized device coordinates.
	 */
function pixelsToNDC(p: THREE.Vector2, element: Element): THREE.Vector2 {
    const rect = element.getBoundingClientRect();
    const ndc = new THREE.Vector2();
    ndc.x = 2*(p.x / rect.width) - 1;
    ndc.y = -2*(p.y / rect.height) + 1;
    return ndc;
}

/**
 * Converts ndc given in OpenGL normalized device coordinates to pixels.
 */
function NDCToPixels(ndc: THREE.Vector2, element: Element): THREE.Vector2 {
    const rect = element.getBoundingClientRect();
    const p = new THREE.Vector2();
    p.x = rect.width*(ndc.x+1)/2;
    p.y = rect.height*(1-ndc.y)/2;
    return p;
}

/**
 * Returns point on plane z=height where ray from camera to mouse intersects it.
 */
function NDCToWorld3(ndc: THREE.Vector2, height: number, camera: THREE.Camera): THREE.Vector3 {
    const ndc1 = new THREE.Vector3(ndc.x, ndc.y, -1);
    const ndc2 = new THREE.Vector3(ndc.x, ndc.y, 1);
    let a1 = ndc1.unproject(camera);
    let a2 = ndc2.unproject(camera);
    let ray = new THREE.Ray(a1, a2);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -height);
    let intersect = new THREE.Vector3();
    ray.intersectPlane(plane, intersect);
    return intersect;
}

function NDCToWorld2(ndc: THREE.Vector2, height: number, camera: THREE.Camera): THREE.Vector2 {
    let p = NDCToWorld3(ndc, height, camera);
    return new THREE.Vector2(p.x, p.y);
}

function world2ToNDC(p: THREE.Vector2, height: number, camera: THREE.Camera): THREE.Vector2 {
    let ndc = new THREE.Vector3(p.x, p.y, height).project(camera);
    return new THREE.Vector2(ndc.x, ndc.y);
}