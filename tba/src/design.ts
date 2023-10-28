console.log("design.ts");

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

interface JSGlobals {
	SHADOW_MAP_SIZE: number;
	RESOURCES_PATH: string;
	objects: any; 
	materials: any;
	specs: any;
	element: HTMLElement;
	animateCamera: boolean;
	draggingBall: number | null;
	defaultPositions: { [key: string]: THREE.Vector3 };
}

declare global {
	var jsGlobals: JSGlobals;
	var mouse: any;
}

globalThis.jsGlobals = { 
	SHADOW_MAP_SIZE: 1024,
	RESOURCES_PATH: "./static/", 
	objects: [], 
	materials: [],
	animateCamera: false,
	draggingBall: null,
	defaultPositions: {},
} as JSGlobals;

console.log(jsGlobals);

type MouseAction = {
    action: string;
    x: number;
    y: number;
	dx: number | null;
	dy: number | null;
};

globalThis.mouse = {
	lastX: null,
	lastY: null,
	isDragging: false
}

// Returns a promise that is resolved after loading the .json file
function loadJsonPromise() {
	return new Promise((resolve, reject) => {
		fetch(`${jsGlobals.RESOURCES_PATH}models/pooltable.json`)
			.then(response => {
				if (!response.ok)
					throw new Error("Network response not ok.");
				return response.json();
			})
			.then(data => {
				jsGlobals.specs = data;
				resolve(data);
			})
			.catch(error => {
				reject(error);
			});
	});
}

// Loads an .obj file and attaches a .mtl file or a material to it.
// Returns a promise that is resolved on load.
function loadObjMtlPromise(name: string, objPath: string, material: THREE.Material | string | null) {
	if (material == null)
		material = new THREE.MeshBasicMaterial({ });
	return new Promise((resolve, reject) => {
		const loader = new OBJLoader();

		if (typeof material == "string") {
			// If material is string, treat it as path for .mtl file
			const mtlLoader = new MTLLoader();
		
			mtlLoader.load(material, (materials) => {
				materials.preload();
		
				loader.setMaterials(materials);
				loader.load(objPath, (object) => {
					jsGlobals.objects[name] = object;
					resolve(object);
				}, undefined, error => {
					reject(error);
				});
			}, () => {}, error => {
				reject(error);
			});
		} else {
			// If material is not string, treat it as material and apply it to the object:
			loader.load(objPath, (object) => {
				object.traverse((child) => {
					if (child instanceof THREE.Mesh) 
						child.material = material;
						// child.material = getRandomColor(0.2, 0.2, 0.7);
				});
				jsGlobals.objects[name] = object;
				resolve(object);
			}, undefined, error => {
				reject(error);
			});
		}
	});
}

function getRandomColor(r: number, g: number, b: number) {
	// Define a maximum variation you want from the input color
	const maxVariation = 0.5;
  
	// Calculate random variations for each color component
	const randomR = r + (Math.random() - 0.5) * maxVariation;
	const randomG = g + (Math.random() - 0.5) * maxVariation;
	const randomB = b + (Math.random() - 0.5) * maxVariation;
  
	// Ensure the random values are within the valid range [0, 1]
	const finalR = Math.min(1, Math.max(0, randomR));
	const finalG = Math.min(1, Math.max(0, randomG));
	const finalB = Math.min(1, Math.max(0, randomB));
  
	// Create a THREE.js material with the random color
	const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(finalR, finalG, finalB), side: THREE.FrontSide, });
  
	return material;
}

function defaultPosition(ballNumber: number): THREE.Vector3 {
	return new THREE.Vector3(-1.0+0.1*ballNumber, 0.84, jsGlobals.specs.BALL_RADIUS);
}

let ar = 1000.0 / 600.0

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, ar, 0.1, 1000);
// const camera = new THREE.OrthographicCamera(-ar, ar, 1.0, -1.0, 0.1, 1000.0);
camera.position.set(0, 0, 3.5);
camera.lookAt(0.0, 0.0, 0.0);

for (let k = -1; k <= 1; k++) {
	let light = new THREE.PointLight(0xffffff, 5, 10);
	light.position.set(k, 0, 2);
	light.castShadow = true;
	light.shadow.mapSize.copy(new THREE.Vector2(jsGlobals.SHADOW_MAP_SIZE, jsGlobals.SHADOW_MAP_SIZE));
	scene.add(light);
}
let light = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(light);

jsGlobals.element = document.getElementById("three-box") as HTMLElement;
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setSize(jsGlobals.element.offsetWidth, jsGlobals.element.offsetHeight);
jsGlobals.element.appendChild(renderer.domElement);
const observer = new ResizeObserver((entries) => {
	for (const entry of entries) {
		if (entry.target == jsGlobals.element) {
			const newWidth = entry.contentRect.width;
			const newHeight = entry.contentRect.height;
			renderer.setSize(newWidth, newHeight);
			camera.aspect = newWidth / newHeight;
    		// camera.fov = 30.0;
    		camera.updateProjectionMatrix();
		}
    }
}).observe(jsGlobals.element);

let time = 0.0;

function animate() {
	time += 0.002;

	if (jsGlobals.animateCamera) {
		camera.position.set(3*Math.cos(time), 3*Math.sin(time), 1.5);
		camera.up.set(0, 0, 1);
		camera.lookAt(0.0, 0.0, -0.25);
	} else {
		camera.position.set(0, 0, 3.5);
		camera.up.set(0, 1, 0);
		camera.lookAt(0.0, 0.0, -0.25);
	}

	renderer.render(scene, camera);

	requestAnimationFrame(animate);
}

function handleMouseDown(event: MouseEvent) {
	if (event.button === 0) { // Left mouse button
    	mouse.isDragging = true;
    	mouse.lastX = event.clientX;
    	mouse.lastY = event.clientY;
		mouseAction({ action: "down", x: mouse.lastX, y: mouse.lastY } as MouseAction);
  	}
}

function handleMouseMove(event: MouseEvent) {
  	if (mouse.isDragging) {
	    const newX = event.clientX;
	    const newY = event.clientY;
	    let dx = newX - mouse.lastX;
	    let dy = newY - mouse.lastY;
	    mouse.lastX = newX;
	    mouse.lastY = newY;

		// camera.position.x -= 0.01*dx;
		// camera.position.y += 0.01*dy;
		mouseAction({ action: "drag", x: mouse.lastX, y: mouse.lastY, dx: dx, dy: dy });
  	}
}

function handleMouseUp(event: MouseEvent) {
  	if (event.button === 0) {
	    mouse.isDragging = false;
		mouseAction({ action: "up", x: event.clientX, y: event.clientY } as MouseAction);
  	}
}

document.addEventListener('contextmenu', (event) => {
	event.preventDefault(); // Disable the default context menu
	
	// Handle your custom logic for right-click here
	// dTime = (dTime) ? 0.0 : 0.001;

	mouseAction({ action: "contextmenu", x: event.clientX, y: event.clientY } as MouseAction);
});

function handleScroll(event: WheelEvent) {
	// console.log(event);
	event.preventDefault(); // Disable the default scroll behavior

	// console.log(event);
	// camera.position.z *= Math.exp(0.005*event.deltaY);

	if (event.deltaY > 0)
		jsGlobals.animateCamera = true;
	else 
		jsGlobals.animateCamera = false;
}

document.addEventListener('wheel', handleScroll, {passive: false});	// {passive: true} is an indicator to browser that "Go ahead with scrolling without waiting for my code to execute, and you don't need to worry about me using event.preventDefault() to disable the default scrolling behavior. I guarantee that I won't block the scrolling, so you can optimize the scrolling performance."
// document.addEventListener('touchmove', handleScroll, {passive: false}); // For mobile, needs to compute deltaX, deltaY by hand from event.touches[0].clintX, .clientY

// Attach event listeners to the document
document.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

function findGroupForObject(object: any) {
	do {
		if (object instanceof THREE.Group)
			return object;
		object = object.parent;
	} while (object.parent);
	return object;
}

function findNameForObject(object: any) {
	for (const key in jsGlobals.objects) {
		if (jsGlobals.objects[key] == object)
			return key;
	}
	return null;
}

function findObjectNameOnMouse(mouseAction: MouseAction) {
	const rect = jsGlobals.element.getBoundingClientRect();
	const nMouse = new THREE.Vector2();
	nMouse.x = 2*((mouseAction.x-rect.left) / rect.width) - 1;
	nMouse.y = -2*((mouseAction.y-rect.top) / rect.height) + 1;

	const raycaster = new THREE.Raycaster();
	raycaster.setFromCamera(nMouse, camera);
	const intersects = raycaster.intersectObjects(scene.children, true);
	if (intersects.length > 0) {
		// console.log("intersects[0]:", intersects[0].object);
		let x = findGroupForObject(intersects[0].object);
		return findNameForObject(x);
	}
	return null;
}

// Custom mouse left click/drag handler:
function mouseAction(mouseAction: MouseAction) {
	if (mouseAction.action == "down") {
		let y = findObjectNameOnMouse(mouseAction);
		if (y && y.startsWith("ball")) {
			const result = y.match(/\d+/);
			jsGlobals.draggingBall = result ? parseInt(result[0]) : null;
		} 
	} else if (mouseAction.action == "up") {
		jsGlobals.draggingBall = null;
	} else if (mouseAction.action == "drag") {
		const rect = jsGlobals.element.getBoundingClientRect();
		const mouse = new THREE.Vector2();
		mouse.x = 2*((mouseAction.x-rect.left) / rect.width) - 1;
		mouse.y = -2*((mouseAction.y-rect.top) / rect.height) + 1;
		const mouse3D = new THREE.Vector3(mouse.x, mouse.y, 0.5);
		let a = mouse3D.unproject(camera);
		const ray = new THREE.Ray(camera.position, a.clone().sub(camera.position).normalize());
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -jsGlobals.specs.BALL_RADIUS);
		let intersect = new THREE.Vector3();
		ray.intersectPlane(plane, intersect);
		if (intersect) {
			if (jsGlobals.draggingBall != null) {
				const ball = jsGlobals.objects[`ball${jsGlobals.draggingBall}`];
				ball.position.x = intersect.x;
				ball.position.y = intersect.y;
			}
		}
	} else if (mouseAction.action == "contextmenu") {
		let y = findObjectNameOnMouse(mouseAction);
		if (y && y.startsWith("ball")) {
			jsGlobals.draggingBall = null;
			jsGlobals.objects[y].position.copy(jsGlobals.defaultPositions[y]);
		}
	}
}
  
function setShadow(object: THREE.Object3D, castShadow: boolean, receiveShadow: boolean) {
	object.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			child.castShadow = castShadow; 
			child.receiveShadow = receiveShadow;
		}
	});
}

for (let k = 0; k < 16; k++) {
	jsGlobals["materials"][`ball${k}`] = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.2, metalness: 0.2 });
	const textureLoader = new THREE.TextureLoader();
	textureLoader.load(`${jsGlobals.RESOURCES_PATH}models/images/balls/ball${k}.png`, (texture) => {
		jsGlobals["materials"][`ball${k}`].color = undefined;
		jsGlobals["materials"][`ball${k}`].map = texture;
		jsGlobals["materials"][`ball${k}`].needsUpdate = true;
	});
}

const resourcePromises = [
	loadObjMtlPromise("cushions", `${jsGlobals.RESOURCES_PATH}models/cushions.obj`, new THREE.MeshStandardMaterial({ color: 0x35557c })),
	loadObjMtlPromise("table", `${jsGlobals.RESOURCES_PATH}models/table.obj`, `${jsGlobals.RESOURCES_PATH}models/table.mtl`),
	loadObjMtlPromise("ball", `${jsGlobals.RESOURCES_PATH}models/ball.obj`, null),
	loadJsonPromise(),
];

Promise.all(resourcePromises)
	.then(() => {
		let ball = jsGlobals.objects.ball;
		for (let k = 0; k < 16; k++) {
			const cball: THREE.Object3D = ball.clone();
			cball.traverse((child) => {
				if (child instanceof THREE.Mesh)
					child.material = jsGlobals.materials[`ball${k}`];
			});
			let r = jsGlobals.specs.BALL_RADIUS;
			cball.scale.set(r, r, r);
			jsGlobals.defaultPositions[`ball${k}`] = defaultPosition(k);
			cball.position.copy(jsGlobals.defaultPositions[`ball${k}`]);
			// if (INITIAL_VALUES) {
			// 	cball.position.x = INITIAL_VALUES[k][0];
			// 	cball.position.y = INITIAL_VALUES[k][1];
			// 	cball.position.z = INITIAL_VALUES[k][2];
			// }
			jsGlobals.objects[`ball${k}`] = cball;
		}

		scene.add(jsGlobals.objects.table);
		scene.add(jsGlobals.objects.cushions);
		setShadow(jsGlobals.objects.table, true, true);
		setShadow(jsGlobals.objects.cushions, true, true);
		for (let k = 0; k < 16; k++) {
			scene.add(jsGlobals.objects[`ball${k}`]);
			setShadow(jsGlobals.objects[`ball${k}`], true, true);
		}

		console.log(jsGlobals);
		animate();
	})
	.catch(error => {
		console.log("Error loading resources: ", error);
	});

document.getElementById('save')?.addEventListener('click', saveIt);

function saveIt() {
	const currentURL = window.location.origin + window.location.pathname;
	const postData: any[] = [];
	for (let k = 0; k < 16; k++) {
		const bp = jsGlobals.objects[`ball${k}`].position;
		postData[k] = [bp.x, bp.y, bp.z];
	}
	const headers = new Headers({
		'Content-Type': 'application/json',
	});
	const requestOptions = {
		method: 'POST',
		headers: headers,
		body: JSON.stringify(postData),
	};
	fetch(currentURL, requestOptions)
		.then(response => {
			if (!response.ok)
				throw new Error('Network response was not ok');
			return response.json();
		})
		.then(data => {
			console.log("saveIt got data back:", data);
			alert(data.message);
		})
		.catch(error => {
			console.error('There was a problem with the fetch operation:', error);
		});
}