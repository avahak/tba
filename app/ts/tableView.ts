/**
 * Contains TableScene and TableView classes. TableScene holds three.js
 * objects of the table and TableView handles drawing the scene.
 */

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
const SHADOW_MAP_SIZE = 1024*2;

/**
 * Handles async loading of models and textures.
 */
class ResourceLoader {
	public static textureLoader = new THREE.TextureLoader();
	public static textures: { [key: string]: THREE.MeshStandardMaterial } = {};	// loaded textures
	public static objects: { [key: string]: any } = {};	// loaded objects

	public static loadTexture(name: string, filePath: string): void {
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
	public static loadObjMtlPromise(name: string, objPath: string, material: THREE.Material | string | null) {
		if (material == null)
			material = new THREE.MeshBasicMaterial({ });
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
				}, () => {}, error => {
					reject(error);
				});
			} else {
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
	public static loadJsonPromise(name: string, filePath: string): Promise<any> {
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

/**
 * TableScene handles storing and rendering the three.js scene for the table.
 */
class TableScene {
	public scene: THREE.Scene;
	public objectGroup: THREE.Group;
	public lightGroup: THREE.Group;
	public objects: any;
	public json_all: any;
	public specs: any;
	public cushionEdgeCylinders: THREE.Object3D | undefined;

	constructor() {
		this.objects = {};
		this.objectGroup = new THREE.Group();
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
					const cball: THREE.Object3D = ball.clone();
					cball.traverse((child) => {
						if (child instanceof THREE.Mesh)
							child.material = ResourceLoader.textures[`ball${k}`];
					});
					let r = this.specs.BALL_RADIUS;
					cball.scale.set(r, r, r);
					cball.position.copy(this.defaultBallPosition(k));
					cball.rotation.set(0.0, 3*Math.PI/2, 0.0);
					this.objects[`ball${k}`] = cball;
				}
	
				this.objectGroup.add(this.objects.table);
				this.objectGroup.add(this.objects.cushions);
				// this.scene.add(edgesFrom(this.objects.cushions, 10));
				this.cushionEdgeCylinders = edgeCylindersFromMesh(this.objects.cushions, 15, 0.0015);
				this.scene.add(this.cushionEdgeCylinders);
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
	public setLights(name: string): void {
		this.lightGroup.traverse((light) => {
			if (light instanceof THREE.Light)
				light.dispose();	// Needed to avoid memory leak.
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
		} else if (name == "ambient") {
			let light = new THREE.AmbientLight(0xffffff, 4.0);
			this.lightGroup.add(light);
		}
	}

	public defaultBallPosition(ballNumber: number): THREE.Vector3 {
		return new THREE.Vector3(-1.0+0.1*ballNumber, 0.86, this.specs.BALL_RADIUS);
	}

	/**
	 * @param nMouse Normalized mouse position (-1..1, -1..1).
	 * @returns Returns name for object on mouse position.
	 */
	public findObjectNameOnMouse(nMouse: THREE.Vector2, camera: THREE.Camera): string | null {
		function findNameForObject(object: any, objects: any): string | null {
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
			return null
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
 * Returns a group of edges from an object. 
 * @param object Object that the edges are formed from.
 * @param angleLimit Edges with angles less than this are ignored.
 * @returns Group of edges.
 */
function edgesFrom(object: THREE.Object3D, angleLimit: number): THREE.Object3D {
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
function edgeCylindersFromMesh(object: THREE.Object3D, angleLimit: number, radius: number): THREE.Group {
	let group = new THREE.Group();
	object.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			const edgesGeometry = new THREE.EdgesGeometry(child.geometry, angleLimit);
			const edgesMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
	
			for (let i = 0; i < edgesGeometry.attributes.position.count / 2; i++) {
				const start = new THREE.Vector3().fromBufferAttribute(edgesGeometry.attributes.position, i * 2);
				const end = new THREE.Vector3().fromBufferAttribute(edgesGeometry.attributes.position, i * 2 + 1);
				const mid = start.clone().add(end).multiplyScalar(0.5);
				const length = end.clone().sub(start).length();
		
				const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, 6);
				cylinderGeometry.rotateX(Math.PI/2);	// Needed because cylinder originally points at +y-axis
				const cylinder = new THREE.Mesh(cylinderGeometry, edgesMaterial);
				cylinder.position.set(mid.x, mid.y, mid.z);
				cylinder.lookAt(end);
		
				group.add(cylinder);
			}
		}
	});
	return group;
}

function setShadow(object: THREE.Object3D, castShadow: boolean, receiveShadow: boolean) {
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
	public cameraPerspective: THREE.PerspectiveCamera;
	public cameraOrthographic: THREE.OrthographicCamera;
	public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
	public tableScene: TableScene;
	public renderer: THREE.WebGLRenderer;
	public element: HTMLElement;

	constructor(element: HTMLElement, tableScene: TableScene) {
		this.onWindowResize = this.onWindowResize.bind(this); // Ensure the correct 'this' inside onWindowResize
		this.animate = this.animate.bind(this);	// Ensure the correct 'this' inside animate

		this.element = element;
		this.tableScene = tableScene;
		this.cameraPerspective = new THREE.PerspectiveCamera(30, 1.0, 0.1, 1000);
		this.cameraOrthographic = new THREE.OrthographicCamera(-1.0, 1.0, 1.0, -1.0, 0.1, 1000.0);
		for (const cam of [this.cameraPerspective, this.cameraOrthographic]) {
			cam.position.set(0, 0, 3.5);
			cam.lookAt(0.0, 0.0, 0.0);
		}
		this.camera = this.cameraOrthographic;

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

	public setCamera(name: string) {
		if (name == "orthographic") {
			this.camera = this.cameraOrthographic;
			this.tableScene.setLights("ambient");
			if (!!this.tableScene.cushionEdgeCylinders)
				this.tableScene.cushionEdgeCylinders.visible = true;
		} else if (name == "perspective") {
			this.camera = this.cameraPerspective;
			this.tableScene.setLights("square");
			if (!!this.tableScene.cushionEdgeCylinders)
				this.tableScene.cushionEdgeCylinders.visible = false;
		}
	}

	public animate() {
		const time = performance.now()/1000.0;

		if (this.camera instanceof THREE.PerspectiveCamera) {
			this.camera.position.set(3*Math.cos(time/10), 3*Math.sin(time/10), 1.5);
			this.camera.up.set(0, 0, 1);
			this.camera.lookAt(0.0, 0.0, -0.25);
		} else if (this.camera instanceof THREE.OrthographicCamera) {
			this.camera.position.set(0, 0, 3.5);
			this.camera.up.set(0, 1, 0);
			this.camera.lookAt(0.0, 0.0, -0.25);
		}
	
		this.renderer.render(this.tableScene.scene, this.camera);
		requestAnimationFrame(this.animate);
	}

	public onWindowResize() {
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
	 * Converts x, y given in pixels to OpenGL normalized device coordinates.
	 */
	public normalizedMousePosition(x: number, y: number) {
		const rect = this.element.getBoundingClientRect();
		const nMouse = new THREE.Vector2();
		nMouse.x = 2*((x-rect.left) / rect.width) - 1;
		nMouse.y = -2*((y-rect.top) / rect.height) + 1;
		return nMouse;
	}
}