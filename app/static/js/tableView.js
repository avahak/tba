/**
 * Contains TableScene and TableView classes. TableScene holds three.js
 * objects of the table and TableView handles drawing the scene.
 */
export { TableScene, TableView };
import { closestPoint } from "./util.js";
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
console.log("tableView.ts");
const RESOURCES_PATH = "./static/";
const SHADOW_MAP_SIZE = 1024 * 2;
/**
 * Handles async loading of models and textures.
 */
class ResourceLoader {
    static loadTexture(name, filePath) {
        ResourceLoader.textures[name] = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.2, metalness: 0.2 });
        ResourceLoader.textureLoader.load(filePath, (texture) => {
            ResourceLoader.textures[name].color = new THREE.Color('white');
            ResourceLoader.textures[name].map = texture;
            ResourceLoader.textures[name].needsUpdate = true;
        });
    }
    /** Loads an .obj file and attaches a .mtl file or a material to it.
     * Returns a promise that is resolved on load.
     */
    static loadObjMtlPromise(name, objPath, material) {
        if (material == null)
            material = new THREE.MeshBasicMaterial({});
        return new Promise((resolve, reject) => {
            const objLoader = new OBJLoader();
            if (typeof material == "string") {
                // If material is string, treat it as path for .mtl file
                const mtlLoader = new MTLLoader();
                mtlLoader.load(material, (materials) => {
                    materials.preload();
                    objLoader.setMaterials(materials);
                    objLoader.load(objPath, (object) => {
                        ResourceLoader.objects[name] = object;
                        resolve(object);
                    }, undefined, error => {
                        reject(error);
                    });
                }, () => { }, error => {
                    reject(error);
                });
            }
            else {
                // If material is not string, treat it as material and apply it to the object:
                objLoader.load(objPath, (object) => {
                    object.traverse((child) => {
                        if (child instanceof THREE.Mesh)
                            child.material = material;
                        // child.material = getRandomColor(0.2, 0.2, 0.7);
                    });
                    ResourceLoader.objects[name] = object;
                    resolve(object);
                }, undefined, error => {
                    reject(error);
                });
            }
        });
    }
    /** Returns a promise that is resolved after loading the .json file
     */
    static loadJsonPromise(name, filePath) {
        return new Promise((resolve, reject) => {
            fetch(filePath)
                .then(response => {
                if (!response.ok)
                    throw new Error("Network response not ok.");
                return response.json();
            })
                .then(data => {
                ResourceLoader.objects[name] = data;
                resolve(data);
            })
                .catch(error => {
                reject(error);
            });
        });
    }
}
ResourceLoader.textureLoader = new THREE.TextureLoader();
ResourceLoader.textures = {}; // loaded textures
ResourceLoader.objects = {}; // loaded objects
/**
 * TableScene handles storing and rendering the three.js scene for the table.
 */
class TableScene {
    constructor() {
        this.objects = {};
        this.objectGroup = new THREE.Group();
        this.scene = new THREE.Scene();
        this.lightGroup = new THREE.Group();
        this.scene.add(this.objectGroup);
        this.scene.add(this.lightGroup);
        for (let k = 0; k < 16; k++)
            ResourceLoader.loadTexture(`ball_${k}`, `${RESOURCES_PATH}models/images/balls/ball${k}.png`);
        const resourcePromises = [
            ResourceLoader.loadObjMtlPromise("cushions", `${RESOURCES_PATH}models/cushions.obj`, `${RESOURCES_PATH}models/pooltable.mtl`),
            ResourceLoader.loadObjMtlPromise("table", `${RESOURCES_PATH}models/pooltable.obj`, `${RESOURCES_PATH}models/pooltable.mtl`),
            ResourceLoader.loadObjMtlPromise("ball", `${RESOURCES_PATH}models/ball.obj`, null),
            ResourceLoader.loadJsonPromise("json_all", `${RESOURCES_PATH}models/pooltable.json`),
        ];
        Promise.all(resourcePromises)
            .then(() => {
            this.json_all = ResourceLoader.objects.json_all;
            this.specs = this.json_all.specs;
            this.objects.table = ResourceLoader.objects.table;
            this.objects.ball = ResourceLoader.objects.ball;
            this.objects.cushions = ResourceLoader.objects.cushions;
            let ball = this.objects.ball;
            for (let k = 0; k < 16; k++) {
                const cball = ball.clone();
                cball.traverse((child) => {
                    if (child instanceof THREE.Mesh)
                        child.material = ResourceLoader.textures[`ball_${k}`];
                });
                let r = this.specs.BALL_RADIUS;
                cball.scale.set(r, r, r);
                cball.position.copy(this.defaultBallPosition(k));
                cball.rotation.set(0.0, 3 * Math.PI / 2, 0.0);
                this.objects[`ball_${k}`] = cball;
            }
            this.objectGroup.add(this.objects.table);
            this.objectGroup.add(this.objects.cushions);
            // this.scene.add(edgesFrom(this.objects.cushions, 10));
            this.cushionEdgeCylinders = edgeCylindersFromMesh(this.objects.cushions, 15, 0.0015);
            this.scene.add(this.cushionEdgeCylinders);
            setShadow(this.objects.table, true, true);
            setShadow(this.objects.cushions, true, true);
            for (let k = 0; k < 16; k++) {
                this.objectGroup.add(this.objects[`ball_${k}`]);
                setShadow(this.objects[`ball_${k}`], true, true);
            }
        })
            .catch(error => {
            console.log("Error loading resources: ", error);
        });
    }
    /**
     * Sets up
     * @param name
     */
    setLights(name) {
        // Dispose old lights to avoid avoid memory leak:
        this.lightGroup.traverse((light) => {
            if (light instanceof THREE.Light)
                light.dispose();
        });
        this.lightGroup.clear();
        if (name == "square") {
            for (let k1 = -1; k1 <= 1; k1 += 2) {
                for (let k2 = -1; k2 <= 1; k2 += 2) {
                    let light = new THREE.PointLight(0xffffff, 20, 10);
                    light.position.set(k1, k2, 4.0);
                    light.castShadow = true;
                    light.shadow.mapSize.copy(new THREE.Vector2(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE));
                    this.lightGroup.add(light);
                }
            }
            let light = new THREE.AmbientLight(0xffffff, 0.2);
            this.lightGroup.add(light);
        }
        else if (name == "ambient") {
            let light = new THREE.AmbientLight(0xffffff, 4.0);
            this.lightGroup.add(light);
        }
    }
    defaultBallPosition(ballNumber) {
        return new THREE.Vector3(-1.0 + 0.1 * ballNumber, 0.86, this.specs.BALL_RADIUS);
    }
    /**
     * @param nMouse Normalized mouse position (-1..1, -1..1).
     * @returns Returns name for object on mouse position.
     */
    findObjectNameOnMouse(nMouse, camera) {
        function findNameForObject(object, objects) {
            // First find group for object:
            do {
                if (object instanceof THREE.Group)
                    break;
                object = object.parent;
            } while (object.parent);
            // Then find name for the group:
            for (const key in objects)
                if (objects[key] == object)
                    return key;
            return null;
        }
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(nMouse, camera);
        const intersects = raycaster.intersectObjects(this.objectGroup.children, true);
        if (intersects.length > 0) {
            const name = findNameForObject(intersects[0].object, this.objects);
            // console.log("intersects[0]:", name);
            return name;
        }
        return null;
    }
    /**
     * Returns out of bounds string or null p is not out of bounds.
     */
    outOfBoundsString(p) {
        const railbox = this.json_all.railbox;
        if (p.z < this.specs.BALL_RADIUS)
            return "slate";
        if ((Math.abs(p.x) > railbox[0]) || (Math.abs(p.y) > railbox[1]))
            return "box";
        for (let k = 1; k <= 6; k++) {
            const pc = this.json_all[`pocket_fall_center_${k}`];
            const pr = this.json_all[`pocket_fall_radius_${k}`];
            if (p.distanceTo(new THREE.Vector3(pc[0], pc[1], pc[2])) < pr)
                return "pocket";
        }
        return null;
    }
    /**
     * Returns list of intersections with the ball centered at p.
     * Considers other balls and the cushions.
     */
    intersections(ballName, p) {
        const BR = this.specs.BALL_RADIUS;
        const cushionsPos = this.objects.cushions.children[0].geometry.attributes.position;
        const closestCushion = ["cushion", null, Infinity];
        for (let k = 0; k < cushionsPos.count / 3; k++) {
            const cp = closestPoint(p, new THREE.Vector3().fromBufferAttribute(cushionsPos, 3 * k), new THREE.Vector3().fromBufferAttribute(cushionsPos, 3 * k + 1), new THREE.Vector3().fromBufferAttribute(cushionsPos, 3 * k + 2));
            const dist = p.distanceTo(cp) - BR;
            if (dist < closestCushion[1]) {
                closestCushion[1] = cp;
                closestCushion[2] = dist;
            }
        }
        let returns = [];
        if (closestCushion[2] < 0.0)
            returns.push(closestCushion);
        for (let name in this.objects) {
            if (name.startsWith("ball_") && (name != ballName)) {
                let cp = this.objects[name].position.clone().sub(p);
                const dist = cp.length();
                if (dist < 2 * BR) {
                    const d = Math.max(0.2 * BR, dist - BR);
                    let q = p.clone().add(cp.normalize().multiplyScalar(d));
                    returns.push([name, q, d - BR]);
                }
            }
        }
        return returns;
    }
    /**
     * Tries to resolve intersections by returning a closeby point instead.
     * NOTE might fail and return the original point.
     */
    resolveIntersections(ballName, originalPosition) {
        const EP = 1.0e-8;
        const BR = this.specs.BALL_RADIUS + EP;
        function resolve1(p, q) {
            // console.log("resolve1");
            let qp = p.clone().sub(q);
            let qp_xy = new THREE.Vector3(qp.x, qp.y, 0.0);
            let pushDistance = Math.sqrt(BR ** 2 - qp.z ** 2) - qp_xy.length();
            return qp_xy.normalize().multiplyScalar(pushDistance).add(p);
        }
        function resolve2(p, q1, q2) {
            // Solves new position for p such that it is at least r away from both q1 and q2.
            // Idea: look at the situation from above in the plane z=p.z. There the situation
            // is simple plane geometry reducing to finding intersections of two circles.
            // console.log("resolve2");
            const r1 = Math.sqrt(BR ** 2 - (q1.z - p.z) ** 2);
            const r2 = Math.sqrt(BR ** 2 - (q2.z - p.z) ** 2);
            const d = Math.sqrt((q1.x - q2.x) ** 2 + (q1.y - q2.y) ** 2);
            const x1 = d / 2 - (r2 ** 2 - r1 ** 2) / (2 * d);
            // const x2 = d/2 + (r2**2-r1**2)/(2*d);
            const h = Math.sqrt(r1 ** 2 - x1 ** 2); // plus or minus
            const e1 = new THREE.Vector2(q2.x - q1.x, q2.y - q1.y).normalize();
            const e2 = new THREE.Vector2(-e1.y, e1.x);
            const solutionPlus = new THREE.Vector2(q1.x + e1.x * x1 + e2.x * h, q1.y + e1.y * x1 + e2.y * h);
            const solutionMinus = new THREE.Vector2(q1.x + e1.x * x1 - e2.x * h, q1.y + e1.y * x1 - e2.y * h);
            if (solutionPlus.distanceTo(new THREE.Vector2(p.x, p.y)) <
                solutionMinus.distanceTo(new THREE.Vector2(p.x, p.y)))
                return new THREE.Vector3(solutionPlus.x, solutionPlus.y, p.z);
            return new THREE.Vector3(solutionMinus.x, solutionMinus.y, p.z);
        }
        let p = originalPosition.clone();
        const MAX_ITERATIONS = 100;
        let iterations = 0;
        while (iterations < MAX_ITERATIONS) {
            let is = this.intersections(ballName, p);
            if (is.length == 0)
                break;
            else if (is.length == 1)
                p = resolve1(p, is[0][1]);
            else
                p = resolve2(p, is[0][1], is[1][1]);
            iterations += 1;
        }
        // If we do not resolve the intersections, return original:
        if (iterations == MAX_ITERATIONS) {
            console.log("resolveIntersections reached MAX_ITERATIONS", iterations);
            p.copy(originalPosition);
        }
        return p;
    }
}
/**
 * Returns a group of edges from an object.
 * @param object Object that the edges are formed from.
 * @param angleLimit Edges with angles less than this are ignored.
 * @returns Group of edges.
 */
function edgesFrom(object, angleLimit) {
    let group = new THREE.Group();
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            const edgesGeometry = new THREE.EdgesGeometry(child.geometry, angleLimit);
            const outline = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ color: 0x000000 }));
            group.add(outline);
        }
    });
    return group;
}
/**
 * Returns a group of cylinders on the edges of the object.
 * @param object Source object.
 * @param angleLimit Edges with angles less than this are ignored.
 * @param radius Radius of the cylinders.
 * @returns Group of edge cylinders.
 */
function edgeCylindersFromMesh(object, angleLimit, radius) {
    let group = new THREE.Group();
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            const edgesGeometry = new THREE.EdgesGeometry(child.geometry, angleLimit);
            const edgesMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            for (let k = 0; k < edgesGeometry.attributes.position.count / 2; k++) {
                const start = new THREE.Vector3().fromBufferAttribute(edgesGeometry.attributes.position, k * 2);
                const end = new THREE.Vector3().fromBufferAttribute(edgesGeometry.attributes.position, k * 2 + 1);
                const mid = start.clone().add(end).multiplyScalar(0.5);
                const length = end.clone().sub(start).length();
                const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, 6);
                cylinderGeometry.rotateX(Math.PI / 2); // Needed because cylinder originally points at +y-axis
                const cylinder = new THREE.Mesh(cylinderGeometry, edgesMaterial);
                cylinder.position.set(mid.x, mid.y, mid.z);
                cylinder.lookAt(end);
                group.add(cylinder);
            }
        }
    });
    return group;
}
function setShadow(object, castShadow, receiveShadow) {
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.castShadow = castShadow;
            child.receiveShadow = receiveShadow;
        }
    });
}
/**
 * TableView handles rendering of the TableScene.
 */
class TableView {
    constructor(element, tableScene) {
        this.onWindowResize = this.onWindowResize.bind(this); // Ensure the correct 'this' inside onWindowResize
        this.animate = this.animate.bind(this); // Ensure the correct 'this' inside animate
        this.element = element;
        this.tableScene = tableScene;
        this.cameraPerspective = new THREE.PerspectiveCamera(30, 1.0, 0.1, 1000);
        this.cameraOrthographic = new THREE.OrthographicCamera(-1.0, 1.0, 1.0, -1.0, 0.1, 1000.0);
        for (const cam of [this.cameraPerspective, this.cameraOrthographic]) {
            cam.position.set(0, 0, 3.5);
            cam.lookAt(0.0, 0.0, 0.0);
        }
        this.camera = this.cameraOrthographic;
        this.animateCamera = false;
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio * 2);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setSize(this.element.offsetWidth, this.element.offsetHeight);
        this.element.appendChild(this.renderer.domElement);
        window.addEventListener('resize', this.onWindowResize);
        this.onWindowResize();
    }
    setCamera(name) {
        this.animateCamera = false;
        if (name == "orthographic") {
            this.camera = this.cameraOrthographic;
            this.camera.position.set(0, 0, 3.5);
            this.camera.up.set(0, 1, 0);
            this.camera.lookAt(0.0, 0.0, -0.25);
            this.tableScene.setLights("ambient");
            if (!!this.tableScene.cushionEdgeCylinders)
                this.tableScene.cushionEdgeCylinders.visible = true;
        }
        else if (name == "perspective") {
            this.camera = this.cameraPerspective;
            this.animateCamera = true;
            this.tableScene.setLights("square");
            if (!!this.tableScene.cushionEdgeCylinders)
                this.tableScene.cushionEdgeCylinders.visible = false;
        }
        else if (name == "back") {
            this.camera = this.cameraPerspective;
            this.camera.position.set(-2.5, 0.0, 1);
            this.camera.up.set(0, 0, 1);
            this.camera.lookAt(0.0, 0.0, -0.3);
            this.tableScene.setLights("square");
            if (!!this.tableScene.cushionEdgeCylinders)
                this.tableScene.cushionEdgeCylinders.visible = false;
        }
        this._render();
    }
    _render() {
        this.renderer.render(this.tableScene.scene, this.camera);
    }
    animate() {
        const time = performance.now() / 1000;
        if (this.animateCamera) {
            this.camera.position.set(3.0 * Math.cos(time / 10), 3.0 * Math.sin(time / 10), 2.0);
            this.camera.up.set(0, 0, 1);
            this.camera.lookAt(0.0, 0.0, -0.25);
        }
        this._render();
        requestAnimationFrame(this.animate);
    }
    onWindowResize() {
        const container = this.element;
        const aspect = container.offsetWidth / container.offsetHeight;
        this.cameraOrthographic.left = -aspect;
        this.cameraOrthographic.right = aspect;
        this.cameraOrthographic.updateProjectionMatrix();
        this.cameraPerspective.aspect = aspect;
        this.cameraPerspective.updateProjectionMatrix();
        this.renderer.setSize(container.offsetWidth, container.offsetHeight);
    }
    /**
     * Converts p given in pixels to OpenGL normalized device coordinates.
     */
    pixelsToNDC(p) {
        const rect = this.element.getBoundingClientRect();
        const ndc = new THREE.Vector2();
        ndc.x = 2 * ((p.x - rect.left) / rect.width) - 1;
        ndc.y = -2 * ((p.y - rect.top) / rect.height) + 1;
        return ndc;
    }
    /**
     * Converts ndc given in OpenGL normalized device coordinates to pixels.
     */
    NDCToPixels(ndc) {
        const rect = this.element.getBoundingClientRect();
        const p = new THREE.Vector2();
        p.x = rect.left + rect.width * (ndc.x + 1) / 2;
        p.y = rect.top + rect.height * (1 - ndc.y) / 2;
        return p;
    }
}
