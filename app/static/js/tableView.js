/* TODO:
1) make shadows toggleable `setShadow(designSettings.objects.table, false/true, true);`
(black edges+no shadows from table makes overhead view very crisp)
2) add html elements
*/
// camera, renderer, canvas, mouse stuff, 
export { TableScene, TableView };
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
        this.defaultPositions = {};
        this.scene = new THREE.Scene();
        this.lightGroup = new THREE.Group();
        this.scene.add(this.objectGroup);
        this.scene.add(this.lightGroup);
        for (let k = 0; k < 16; k++)
            ResourceLoader.loadTexture(`ball${k}`, `${RESOURCES_PATH}models/images/balls/ball${k}.png`);
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
                        child.material = ResourceLoader.textures[`ball${k}`];
                });
                let r = this.specs.BALL_RADIUS;
                cball.scale.set(r, r, r);
                cball.position.copy(this.defaultBallPosition(k));
                cball.rotation.set(0.0, 3 * Math.PI / 2, 0.0);
                this.objects[`ball${k}`] = cball;
            }
            this.objectGroup.add(this.objects.table);
            this.objectGroup.add(this.objects.cushions);
            this.scene.add(edgesFrom(this.objects.cushions, 10));
            setShadow(this.objects.table, true, true);
            setShadow(this.objects.cushions, true, true);
            for (let k = 0; k < 16; k++) {
                this.objectGroup.add(this.objects[`ball${k}`]);
                setShadow(this.objects[`ball${k}`], true, true);
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
        else if (name == "ambient only") {
            let light = new THREE.AmbientLight(0xffffff, 4.0);
            this.lightGroup.add(light);
        }
    }
    defaultBallPosition(ballNumber) {
        return new THREE.Vector3(-1.0 + 0.1 * ballNumber, 0.86, this.specs.BALL_RADIUS);
    }
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
            console.log("intersects[0]:", name);
            return name;
        }
        return null;
    }
}
/**
 * Returns a group of edges from an object. Only edges with both vertices having z>=0
 * are included.
 *
 * @param object Object that the edges are formed from.
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
        for (const camera of [this.cameraPerspective, this.cameraOrthographic]) {
            camera.position.set(0, 0, 3.5);
            camera.lookAt(0.0, 0.0, 0.0);
        }
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
    animate() {
        const time = performance.now() / 1000.0;
        // const camera = this.cameraPerspective;
        const camera = this.cameraOrthographic;
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.position.set(3 * Math.cos(time / 10), 3 * Math.sin(time / 10), 1.5);
            camera.up.set(0, 0, 1);
            camera.lookAt(0.0, 0.0, -0.25);
        }
        else {
            camera.position.set(0, 0, 3.5);
            camera.up.set(0, 1, 0);
            camera.lookAt(0.0, 0.0, -0.25);
        }
        this.renderer.render(this.tableScene.scene, camera);
        // composer.render();
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
}
