/**
 * Contains ResourceLoader and TableScene classes. TableScene holds three.js
 * objects of the table.
 */

export { TableScene };
import { closestPoint } from "../util.js";
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

console.log("tableScene.ts");

const RESOURCES_PATH = "./static/";
const SHADOW_MAP_SIZE = 1024*2;

/**
 * Handles async loading of models and textures.
 */
class ResourceLoader {
	public textureLoader: THREE.TextureLoader;
	public textures: { [key: string]: THREE.MeshStandardMaterial };	// loaded textures
	public objects: { [key: string]: THREE.Object3D };				// loaded objects
	public manager: THREE.LoadingManager;

	public constructor(manager: THREE.LoadingManager | null = null) {
		if (!manager)
			manager = new THREE.LoadingManager();
		this.manager = manager;
		this.textureLoader = new THREE.TextureLoader(manager);
		this.textures = {};
		this.objects = {};
	}

	public loadTexture(name: string, filePath: string): Promise<THREE.Texture> {
		return new Promise((resolve, reject) => {
			const material = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.2, metalness: 0.2 });
			this.textureLoader.load(filePath, (texture) => {
				material.color = new THREE.Color('white');
				material.map = texture;
				material.needsUpdate = true;
				resolve(material.map);
			}, undefined, (error) => {
				reject(error);
			});	
			this.textures[name] = material;
		});
	}

	/** Loads an .obj file and attaches a .mtl file or a material to it.
	 * Returns a promise that is resolved on load.
	 */
	public loadObjMtlPromise(name: string, objPath: string, mtlPath: string | null) {
		return new Promise((resolve, reject) => {
			const objLoader = new OBJLoader(this.manager);
			if (!!mtlPath) {
				const mtlLoader = new MTLLoader(this.manager);
				mtlLoader.load(mtlPath, (materials) => {
					materials.preload();
					objLoader.setMaterials(materials);

					objLoader.load(objPath, (object) => {
						this.objects[name] = object;
						resolve(object);
					}, undefined, error => {
						reject(error);
					});
				}, () => {}, error => {
					reject(error);
				});
			} else {
				// If no mtlPath given, apply basic material:
				const material = new THREE.MeshBasicMaterial();
				objLoader.load(objPath, (object) => {
					object.traverse((child) => {
						if (child instanceof THREE.Mesh) 
							child.material = material;
					});
					this.objects[name] = object;
					resolve(object);
				}, undefined, error => {
					reject(error);
				});
			}
		});
	}

	/** Returns a promise that is resolved after loading the .json file
	 */
	public loadJsonPromise(name: string, filePath: string): Promise<any> {
		return new Promise((resolve, reject) => {
			this.manager.itemStart(filePath);
			fetch(filePath)
				.then(response => {
					if (!response.ok)
						throw new Error("Network response not ok.");
					return response.json();
				})
				.then(data => {
					this.manager.itemEnd(filePath);
					this.objects[name] = data;
					resolve(data);
				})
				.catch(error => {
					this.manager.itemError(filePath);
					reject(error);
				});
		});
	}
}

/**
 * TableScene handles storing and rendering the three.js scene for the table.
 * Fires "tableSceneTexturesLoaded", "tableSceneModelsLoaded", "tableSceneLoaded" events
 * during load.
 */
class TableScene {
	public scene: THREE.Scene;
	public objectGroup: THREE.Group;
	public lightGroup: THREE.Group;
	public objects: { [key: string]: THREE.Object3D };
	public tableJson: any;
	public specs: any;
	public cushionEdgeCylinders: THREE.Object3D | undefined;
	public resourceLoader: ResourceLoader;

	constructor() {
		this.objects = {};
		this.objectGroup = new THREE.Group();
		this.scene = new THREE.Scene();
		this.lightGroup = new THREE.Group();

		this.scene.add(this.objectGroup);
		this.scene.add(this.lightGroup);

		const manager = new THREE.LoadingManager(() => {
			console.log("tableSceneLoaded");
			const event = new Event('tableSceneLoaded');
			document.dispatchEvent(event);
		}, undefined, () => {
			console.log("LoadingManager error!");
		});
		this.resourceLoader = new ResourceLoader(manager);

		for (let k = 0; k < 16; k++) 
			this.resourceLoader.loadTexture(`ball_${k}`, `${RESOURCES_PATH}models/images/balls/ball${k}.png`);

		const resourcePromises = [
			this.resourceLoader.loadObjMtlPromise("cushions", `${RESOURCES_PATH}models/cushions.obj`, `${RESOURCES_PATH}models/pooltable.mtl`),
			this.resourceLoader.loadObjMtlPromise("table", `${RESOURCES_PATH}models/pooltable.obj`, `${RESOURCES_PATH}models/pooltable.mtl`),
			this.resourceLoader.loadJsonPromise("tableJson", `${RESOURCES_PATH}models/pooltable.json`),
		];

		const ballGeometry = new THREE.SphereGeometry(1, 40, 20);	// old was 1, 64, 32
		const ball = new THREE.Mesh(ballGeometry);
		const ballGroup = new THREE.Group();
		ballGroup.add(ball);
	
		Promise.all(resourcePromises)
			.then((resources) => {
				this.tableJson = this.resourceLoader.objects.tableJson;
				this.specs = this.tableJson.specs;
				this.objects.table = this.resourceLoader.objects.table;
				this.objects.ball = ballGroup;
				this.objects.cushions = this.resourceLoader.objects.cushions;

				for (let k = 0; k < 16; k++) {
					const cball: THREE.Object3D = ballGroup.clone();
					cball.traverse((child) => {
						if (child instanceof THREE.Mesh)
							child.material = this.resourceLoader.textures[`ball_${k}`];
					});
					let r = this.specs.BALL_RADIUS;
					cball.scale.set(r, r, r);
					cball.position.copy(this.defaultBallPosition(k));
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

				console.log("tableSceneModelsLoaded");
				const event = new Event('tableSceneModelsLoaded');
				document.dispatchEvent(event);
			})
			.catch(error => {
				console.log("Error loading resources: ", error);
			});
	}

	/**
	 * Sets up lights for the scene in the lightGroup.
	 * @param name Options are "square", "ambient".
	 */
	public setLights(name: string): void {
		// Dispose old lights to avoid avoid memory leak:
		const lightsRemoved: THREE.Light[] = [];
		this.lightGroup.traverse((light) => {
			if (light instanceof THREE.Light) 
				lightsRemoved.push(light);
		});
		this.lightGroup.clear();
		lightsRemoved.forEach((light) => {
			light.dispose();
		});

		if (name == "square") {
			for (let k1 = -1; k1 <= 1; k1 += 2) {
				for (let k2 = -1; k2 <= 1; k2 += 2) {
					let light = new THREE.SpotLight(0xffffff);
					light.position.set(k1, k2, 4.0);
					light.intensity = 5;
					light.decay = 1;
					light.angle = Math.PI/8;
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

	public defaultBallPosition(ball: number | string | null): THREE.Vector3 {
		let ballNumber = 0;
		if (typeof ball == "string") {
			const result = ball.match(/\d+/);
			ballNumber = result ? parseInt(result[0]) : 0;
		} else if (typeof ball == "number")
			ballNumber = ball;
		return new THREE.Vector3(-1.0+0.1*ballNumber, 0.86, this.specs.BALL_RADIUS);
	}

	/**
	 * @param ndc Normalized device coordinates.
	 * @returns Returns name for object on mouse position.
	 */
	public findObjectNameOnMouse(ndc: THREE.Vector2, camera: THREE.Camera): string | null {
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
		raycaster.setFromCamera(ndc, camera);
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
	public outOfBoundsString(p: THREE.Vector3): string | null {
		const railbox = this.tableJson.railbox;
		if (p.z < this.specs.BALL_RADIUS)
			return "slate";
		if ((Math.abs(p.x) > railbox[0]) || (Math.abs(p.y) > railbox[1]))
			return "box";
		for (let k = 1; k <= 6; k++) {
			const pc = this.tableJson[`pocket_fall_center_${k}`];
			const pr = this.tableJson[`pocket_fall_radius_${k}`];
			if (p.distanceTo(new THREE.Vector3(pc[0], pc[1], pc[2])) < pr)
				return "pocket";
		}
		return null;
	}

	/**
	 * Returns list of intersections with the ball centered at p.
	 * Considers other balls and the cushions.
	 */
	public intersections(ballName: string, p: THREE.Vector3): any[] {
		const BR = this.specs.BALL_RADIUS;
		const cushionsPos = (this.objects.cushions.children[0] as THREE.Mesh).geometry.attributes.position;
		const closestCushion: [string, THREE.Vector3 | null, number] = ["cushion", null, Infinity];
		for (let k = 0; k < cushionsPos.count/3; k++) {
			const cp = closestPoint(p, 
				new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k), 
				new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k+1),
				new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k+2));
			const dist = p.distanceTo(cp) - BR;
			if (dist < closestCushion[2]) {
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
				if (dist < 2*BR) {
					const d = Math.max(0.2*BR, dist-BR);
					let q = p.clone().add(cp.normalize().multiplyScalar(d))
					returns.push([name, q, d-BR]);
				}
			}
		}
		return returns;
	}

	/**
	 * Tries to resolve intersections by returning a closeby point instead.
	 * NOTE might fail and return the original point.
	 */
	public resolveIntersections(ballName: string, originalPosition: THREE.Vector3): THREE.Vector3 {
		const EP = 1.0e-8;
		const BR = this.specs.BALL_RADIUS + EP;

		function resolve1(p: any, q: any): any {
			// console.log("resolve1");
			let qp = p.clone().sub(q);
			let qp_xy = new THREE.Vector3(qp.x, qp.y, 0.0);
			let pushDistance = Math.sqrt(BR**2 - qp.z**2) - qp_xy.length();
			return qp_xy.normalize().multiplyScalar(pushDistance).add(p);
		}

		function resolve2(p: THREE.Vector3, q1: THREE.Vector3, q2: THREE.Vector3): THREE.Vector3 {
			// Solves new position for p such that it is at least r away from both q1 and q2.
			// Idea: look at the situation from above in the plane z=p.z. There the situation
			// is simple plane geometry reducing to finding intersections of two circles.
			// console.log("resolve2");
			const r1 = Math.sqrt(BR**2 - (q1.z-p.z)**2);
			const r2 = Math.sqrt(BR**2 - (q2.z-p.z)**2);
			const d = Math.sqrt((q1.x-q2.x)**2 + (q1.y-q2.y)**2);
			const x1 = d/2 - (r2**2-r1**2)/(2*d);
			// const x2 = d/2 + (r2**2-r1**2)/(2*d);
			const h = Math.sqrt(r1**2 - x1**2);		// plus or minus
			const e1 = new THREE.Vector2(q2.x-q1.x, q2.y-q1.y).normalize();
			const e2 = new THREE.Vector2(-e1.y, e1.x);
			const solutionPlus = new THREE.Vector2(q1.x+e1.x*x1+e2.x*h, q1.y+e1.y*x1+e2.y*h);
			const solutionMinus = new THREE.Vector2(q1.x+e1.x*x1-e2.x*h, q1.y+e1.y*x1-e2.y*h);
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
	
			for (let k = 0; k < edgesGeometry.attributes.position.count/2; k++) {
				const start = new THREE.Vector3().fromBufferAttribute(edgesGeometry.attributes.position, k*2);
				const end = new THREE.Vector3().fromBufferAttribute(edgesGeometry.attributes.position, k*2+1);
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