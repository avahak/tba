// TODO: change global variables to module-wide

export {};

// Load the three.js modules fully before doing anything:
let THREE: typeof import('three');
let OBJLoader: typeof import('three/examples/jsm/loaders/OBJLoader.js').OBJLoader;
let MTLLoader: typeof import('three/examples/jsm/loaders/MTLLoader.js').MTLLoader;
Promise.all([
    import('three'),
    import('three/examples/jsm/loaders/OBJLoader.js'),
    import('three/examples/jsm/loaders/MTLLoader.js'),
]).then(([module1, module2, module3]) => {
    THREE = module1;
    OBJLoader = module2.OBJLoader;
    MTLLoader = module3.MTLLoader;
    initGeneral();
});
// import * as THREE from 'three';
// import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
// import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

interface DesignSettings {
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

let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let time: number;
let mouse: any;
let designSettings: DesignSettings;

type MouseAction = {
    action: string;
    x: number;
    y: number;
	dx: number | null;
	dy: number | null;
};

// Initialization for everything, done after imports
function initGeneral() {
	designSettings = { 
		SHADOW_MAP_SIZE: 1024,
		RESOURCES_PATH: "./static/", 
		objects: [], 
		materials: [],
		animateCamera: false,
		draggingBall: null,
		defaultPositions: {},
	} as DesignSettings;
	console.log(designSettings);

	mouse = {
		lastX: null,
		lastY: null,
		isDragging: false
	}

	let ar = 1000.0 / 600.0

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(30, ar, 0.1, 1000);
	// const camera = new THREE.OrthographicCamera(-ar, ar, 1.0, -1.0, 0.1, 1000.0);
	camera.position.set(0, 0, 3.5);
	camera.lookAt(0.0, 0.0, 0.0);

	for (let k = -1; k <= 1; k++) {
		let light = new THREE.PointLight(0xffffff, 5, 10);
		light.position.set(k, 0, 2);
		light.castShadow = true;
		light.shadow.mapSize.copy(new THREE.Vector2(designSettings.SHADOW_MAP_SIZE, designSettings.SHADOW_MAP_SIZE));
		scene.add(light);
	}
	let light = new THREE.AmbientLight(0xffffff, 0.2);
	scene.add(light);

	designSettings.element = document.getElementById("three-box") as HTMLElement;
	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
	renderer.setClearColor(0x000000, 0);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	// renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setSize(designSettings.element.offsetWidth, designSettings.element.offsetHeight);
	designSettings.element.appendChild(renderer.domElement);
	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			if (entry.target == designSettings.element) {
				const newWidth = entry.contentRect.width;
				const newHeight = entry.contentRect.height;
				renderer.setSize(newWidth, newHeight);
				camera.aspect = newWidth / newHeight;
				// camera.fov = 30.0;
				camera.updateProjectionMatrix();
			}
		}
	}).observe(designSettings.element);

	time = 0.0;

	const textureLoader = new THREE.TextureLoader();
	for (let k = 0; k < 16; k++) {
		designSettings["materials"][`ball${k}`] = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.2, metalness: 0.2 });
		textureLoader.load(`${designSettings.RESOURCES_PATH}models/images/balls/ball${k}.png`, (texture) => {
			designSettings["materials"][`ball${k}`].color = undefined;
			designSettings["materials"][`ball${k}`].map = texture;
			designSettings["materials"][`ball${k}`].needsUpdate = true;
		});
	}
	
	const resourcePromises = [
		loadObjMtlPromise("cushions", `${designSettings.RESOURCES_PATH}models/cushions.obj`, new THREE.MeshStandardMaterial({ color: 0x35557c })),
		loadObjMtlPromise("table", `${designSettings.RESOURCES_PATH}models/table.obj`, `${designSettings.RESOURCES_PATH}models/table.mtl`),
		loadObjMtlPromise("ball", `${designSettings.RESOURCES_PATH}models/ball.obj`, null),
		loadJsonPromise(),
	];

	Promise.all(resourcePromises)
		.then(() => {
			let ball = designSettings.objects.ball;
			for (let k = 0; k < 16; k++) {
				const cball: THREE.Object3D = ball.clone();
				cball.traverse((child) => {
					if (child instanceof THREE.Mesh)
						child.material = designSettings.materials[`ball${k}`];
				});
				let r = designSettings.specs.BALL_RADIUS;
				cball.scale.set(r, r, r);
				designSettings.defaultPositions[`ball${k}`] = defaultPosition(k);
				cball.position.copy(designSettings.defaultPositions[`ball${k}`]);
				// if (INITIAL_VALUES) {
				// 	cball.position.x = INITIAL_VALUES[k][0];
				// 	cball.position.y = INITIAL_VALUES[k][1];
				// 	cball.position.z = INITIAL_VALUES[k][2];
				// }
				designSettings.objects[`ball${k}`] = cball;
			}

			scene.add(designSettings.objects.table);
			scene.add(designSettings.objects.cushions);
			setShadow(designSettings.objects.table, true, true);
			setShadow(designSettings.objects.cushions, true, true);
			for (let k = 0; k < 16; k++) {
				scene.add(designSettings.objects[`ball${k}`]);
				setShadow(designSettings.objects[`ball${k}`], true, true);
			}

			console.log(designSettings);
			animate();
		})
		.catch(error => {
			console.log("Error loading resources: ", error);
		});

	// document.getElementById('save')?.addEventListener('click', saveIt);
	document.addEventListener('contextmenu', (event) => {
		event.preventDefault(); // Disable the default context menu
		
		// Handle your custom logic for right-click here
		// dTime = (dTime) ? 0.0 : 0.001;
	
		mouseAction({ action: "contextmenu", x: event.clientX, y: event.clientY } as MouseAction);
	});
	
	document.addEventListener('wheel', handleScroll, {passive: false});	// {passive: true} is an indicator to browser that "Go ahead with scrolling without waiting for my code to execute, and you don't need to worry about me using event.preventDefault() to disable the default scrolling behavior. I guarantee that I won't block the scrolling, so you can optimize the scrolling performance."
	// document.addEventListener('touchmove', handleScroll, {passive: false}); // For mobile, needs to compute deltaX, deltaY by hand from event.touches[0].clintX, .clientY
	
	// Attach event listeners to the document
	document.addEventListener('mousedown', handleMouseDown);
	document.addEventListener('mousemove', handleMouseMove);
	document.addEventListener('mouseup', handleMouseUp);
}

// Returns a promise that is resolved after loading the .json file
function loadJsonPromise() {
	return new Promise((resolve, reject) => {
		fetch(`${designSettings.RESOURCES_PATH}models/pooltable.json`)
			.then(response => {
				if (!response.ok)
					throw new Error("Network response not ok.");
				return response.json();
			})
			.then(data => {
				designSettings.specs = data;
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
					designSettings.objects[name] = object;
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
				designSettings.objects[name] = object;
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
	return new THREE.Vector3(-1.0+0.1*ballNumber, 0.84, designSettings.specs.BALL_RADIUS);
}

function animate() {
	time += 0.002;

	if (designSettings.animateCamera) {
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

function handleScroll(event: WheelEvent) {
	// console.log(event);
	event.preventDefault(); // Disable the default scroll behavior

	// console.log(event);
	// camera.position.z *= Math.exp(0.005*event.deltaY);

	if (event.deltaY > 0)
		designSettings.animateCamera = true;
	else 
		designSettings.animateCamera = false;
}

function findGroupForObject(object: any) {
	do {
		if (object instanceof THREE.Group)
			return object;
		object = object.parent;
	} while (object.parent);
	return object;
}

function findNameForObject(object: any) {
	for (const key in designSettings.objects) {
		if (designSettings.objects[key] == object)
			return key;
	}
	return null;
}

function findObjectNameOnMouse(mouseAction: MouseAction) {
	const rect = designSettings.element.getBoundingClientRect();
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
			designSettings.draggingBall = result ? parseInt(result[0]) : null;
		} 
	} else if (mouseAction.action == "up") {
		designSettings.draggingBall = null;
	} else if (mouseAction.action == "drag") {
		const rect = designSettings.element.getBoundingClientRect();
		const mouse = new THREE.Vector2();
		mouse.x = 2*((mouseAction.x-rect.left) / rect.width) - 1;
		mouse.y = -2*((mouseAction.y-rect.top) / rect.height) + 1;
		const mouse3D = new THREE.Vector3(mouse.x, mouse.y, 0.5);
		let a = mouse3D.unproject(camera);
		const ray = new THREE.Ray(camera.position, a.clone().sub(camera.position).normalize());
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -designSettings.specs.BALL_RADIUS);
		let intersect = new THREE.Vector3();
		ray.intersectPlane(plane, intersect);
		if (intersect) {
			if (designSettings.draggingBall != null) {
				const ball = designSettings.objects[`ball${designSettings.draggingBall}`];
				ball.position.x = intersect.x;
				ball.position.y = intersect.y;
			}
		}
	} else if (mouseAction.action == "contextmenu") {
		let y = findObjectNameOnMouse(mouseAction);
		if (y && y.startsWith("ball")) {
			designSettings.draggingBall = null;
			designSettings.objects[y].position.copy(designSettings.defaultPositions[y]);
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

function saveIt() {
	const currentURL = window.location.origin + window.location.pathname;
	const postData: any[] = [];
	for (let k = 0; k < 16; k++) {
		const bp = designSettings.objects[`ball${k}`].position;
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