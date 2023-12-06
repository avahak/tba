/** 
 * Represents the state of one pool diagram.
 * 
 * TODO:
 * - add balls instead of having fixed 16
*/

export { initDiagram };
import { ObjectCollection, Arrow, Text, Ball } from "./diagramObjects.js"
import { TableView } from "./tableView.js";
import { TableScene } from "./tableScene.js";
import { copyToClipboard, parseNumberBetween, clamp, loadJSON } from "./util.js";
import { pixelsToNDC, NDCToPixels, NDCToWorld3, NDCToWorld2, world2ToNDC } from "./transformation.js"
import * as THREE from 'three';

console.log("diagram.ts");

type MouseAction = {
    action: string;
	button: number;
	buttons: number;		// tracks state of all mouse buttons
	p: THREE.Vector2;
	dp: THREE.Vector2;
	movement: THREE.Vector2;
};

let mouseLast: { [key: number]: any } = {};
let tableScene: TableScene;
let tableView: TableView;

// Current 
let activeCamera: string = "orthographic";
let activeObject: string[];			// activeObject, activeObjectPart
let state: string = "";				// "", move, add_arrow_start, add_arrow_end, add_text
let collection: ObjectCollection;

let lastDrawTime: number = performance.now();

initDiagram();

function initDiagram() {
    tableScene = new TableScene();
	const element = document.getElementById("three-box") as HTMLElement;

	document.addEventListener('tableSceneLoaded', () => {
		tableView = new TableView(element, tableScene);
		tableView.setCamera(activeCamera);
		tableView.animate();
		
		collection = new ObjectCollection(tableScene);
		changeActiveObject("");
		tableView.renderCallback = () => draw();

		addMouseListeners(element);

		document.addEventListener("keydown", (event) => {
			handleKeyDown(event);
		});

		addButtonClickEventListeners();

		addInputListeners();

		loadDiagram();

		window.addEventListener('resize', onWindowResize);
		onWindowResize();
	});
}

function addInputListeners() {
	const inputs = ["arrowColorInput", "textColorInput", "widthInput", "textInput", "sizeInput"];
	inputs.forEach((inputName) => {
		const element = document.getElementById(inputName) as HTMLInputElement;
		element.addEventListener("input", () => {
			propagateOptionsToObject();
		});
		element.addEventListener("change", () => {
			checkActiveObjectValidity();
		});
	});
}

function addMouseListeners(element: HTMLElement) {
	element.addEventListener('contextmenu', (event) => {
		event.preventDefault(); // Disable the default context menu
		mouseAction({ action: "contextmenu", p: new THREE.Vector2(event.clientX, event.clientY) } as MouseAction);
	});
	
	element.addEventListener('wheel', handleScroll, {passive: false});	// {passive: true} is an indicator to browser that "Go ahead with scrolling without waiting for my code to execute, and you don't need to worry about me using event.preventDefault() to disable the default scrolling behavior. I guarantee that I won't block the scrolling, so you can optimize the scrolling performance."
	// document.addEventListener('touchmove', handleScroll, {passive: false}); // For mobile, needs to compute deltaX, deltaY by hand from event.touches[0].clintX, .clientY
	
	// Attach event listeners to the document
	element.addEventListener('mousedown', handleMouseDown);
	element.addEventListener('mousemove', handleMouseMove);
	element.addEventListener('mouseup', handleMouseUp);
}

function loadDiagram() {
	const diagramURL = document.getElementById("canvas-container")?.dataset["diagramUrl"];
	let initialValuesUsed = false;
	if (!!diagramURL) {
		loadJSON(diagramURL).then((data: any) => {
			if (!!data) {
				console.log("data", data);
				collection.load(data);
				initialValuesUsed = true;
			}
		});
	}
	if (initialValuesUsed)
		console.log("Initial values loaded.");
	else 
		console.log("No initial values.");
}

function addButtonClickEventListeners() {
	document.getElementById("buttonAddArrow")?.addEventListener("click", () => {
		addArrow();
	});
	document.getElementById("buttonAddText")?.addEventListener("click", () => {
		addText();
	});
	document.getElementById("buttonReset")?.addEventListener("click", () => {
		reset();
	});
	document.getElementById("buttonCamera")?.addEventListener("click", () => {
		changeCamera();
	});
	document.getElementById("buttonSave")?.addEventListener("click", () => {
		save();
	});
}

function handleKeyDown(event: KeyboardEvent) {
	// Do not handle events from tool-bar
	if ((event.target as Element).closest(".tool-bar")) 
		return;

	if (event.key == "Delete") {
		if (!!activeObject[0])
			deleteObject(activeObject[0]);
		changeActiveObject("");
		changeState("");
  	}
}

function handleMouseDown(event: MouseEvent) {
	const p = new THREE.Vector2(event.clientX, event.clientY);
	mouseLast[event.button] = p;
	mouseAction({ action: "down", button: event.button, buttons: event.buttons, p: p } as MouseAction);
}

function handleMouseMove(event: MouseEvent) {
	const newX = event.clientX;
	const newY = event.clientY;
	const p = new THREE.Vector2(newX, newY);
	let dp = p;
	if (!!mouseLast[event.button])
		dp = new THREE.Vector2(newX-mouseLast[event.button].x, newY-mouseLast[event.button].y);
	mouseLast[event.button] = p;
	const movement = new THREE.Vector2(event.movementX, event.movementY);
	mouseAction({ action: "move", button: event.button, buttons: event.buttons, p: p, dp: dp, movement: movement });
}

function handleMouseUp(event: MouseEvent) {
	mouseAction({ action: "up", button: event.button, buttons: event.buttons, p: new THREE.Vector2(event.clientX, event.clientY) } as MouseAction);
}

function handleScroll(event: WheelEvent) {
	event.preventDefault(); // Disable the default scroll behavior

	if (tableView.camera instanceof THREE.PerspectiveCamera) {
		const factor = Math.exp(0.002*event.deltaY);

		const p = tableView.camera.position.clone();
		const dir = tableView.camera.getWorldDirection(new THREE.Vector3()).normalize();
		const dist = -p.z/dir.z;
		const q = p.clone().add(dir.clone().multiplyScalar(dist));	// q.z = 0
		tableView.camera.position.copy(q.clone().add(dir.clone().multiplyScalar(-dist*factor)));

		draw();
	}
}

// Custom mouse left click/drag handler:
function mouseAction(mouseAction: MouseAction) {
    const ndc = pixelsToNDC(mouseAction.p, tableView.element);
	// console.log("mouseAction", mouseAction);
	if ((mouseAction.action == "down") && (mouseAction.button == 0)) {
		if (state == "") {
			const obj = collection.getObject(ndc, tableView.camera);
			changeState("move");
			changeActiveObject(obj[0], obj[1]);
		} else if (state == "move") {
			changeState("");
			changeActiveObject("");
		} else if (state == "add_text") {
			let text = collection.objects[activeObject[0]] as Text;
			text.p = NDCToWorld2(ndc, 0.0, tableView.camera);
			changeState("");
		} else if (state == "add_arrow_start") {
			let arrow = collection.objects[activeObject[0]] as Arrow;
			arrow.p1 = NDCToWorld2(ndc, 0.0, tableView.camera);
			arrow.p2 = arrow.p1;
			changeState("add_arrow_end");
		} 
	} else if ((mouseAction.action == "up") && (mouseAction.button == 0)) {
		if (state == "move") {
			changeState("");
			checkActiveObjectValidity();
		}
		else if (state == "add_arrow_end") {
			let arrow = collection.objects[activeObject[0]] as Arrow;
			arrow.p2 = NDCToWorld2(ndc, 0.0, tableView.camera);
			changeState("");
			checkActiveObjectValidity();
		}
	} 

	if (mouseAction.action == "move") {
		if (state == "add_arrow_end") {
			let arrow = collection.objects[activeObject[0]] as Arrow;
			arrow.p2 = NDCToWorld2(ndc, 0.0, tableView.camera);
		} else if (state == "add_text") {
			collection.move(activeObject, ndc, tableView.camera);
		}
	
		if (mouseAction.buttons & 1) {
			// Left mouse button:
			if (state == "move") {
				collection.move(activeObject, ndc, tableView.camera);
			} else if (state == "add_arrow_end") {
				let arrow = collection.objects[activeObject[0]] as Arrow;
				arrow.p2 = NDCToWorld2(ndc, 0.0, tableView.camera);
			} 
		} 

		if (mouseAction.buttons & 2) {
			// Right mouse button:
			if (tableView.camera instanceof THREE.PerspectiveCamera) {
				tableView.cameraAnimates = false;

				function swizzle(p: THREE.Vector3, inverse: boolean = false): THREE.Vector3 {
					if (inverse)
						return new THREE.Vector3(p.z, p.x, p.y);
					return new THREE.Vector3(p.y, p.z, p.x);
				}
				/* The reason we swizzle is that three.js computes spherical coordinates with:
				this.theta = Math.atan2( x, z );
				this.phi = Math.acos( MathUtils.clamp( y / this.radius, - 1, 1 ) );
				instead of this.theta = Math.atan2(y, x);
				*/
				const dir = tableView.camera.getWorldDirection(new THREE.Vector3()).normalize();
				const r = tableView.camera.position.z/(-dir.z);
				const pivot = new THREE.Vector3(tableView.camera.position.x+r*dir.x, tableView.camera.position.y+r*dir.y, 0.0);
				const spherical = new THREE.Spherical().setFromVector3(swizzle(dir));
				const newPhi = clamp(spherical.phi + 0.005*mouseAction.movement.y, Math.PI/2+0.1, Math.PI-0.05);
				const newTheta = spherical.theta - 0.005*mouseAction.movement.x;
				const dirNew = swizzle(new THREE.Vector3().setFromSphericalCoords(1, newPhi, newTheta), true);
				tableView.camera.position.set(pivot.x-r*dirNew.x, pivot.y-r*dirNew.y, pivot.z-r*dirNew.z);
				tableView.camera.lookAt(pivot.clone().add(dirNew));
			}
		}

		if (mouseAction.buttons & 4) {
			// Middle mouse button:
			tableView.cameraAnimates = false;
			const ndcLast = pixelsToNDC(mouseAction.p.clone().sub(mouseAction.dp), tableView.element);
			const p = NDCToWorld2(ndc, 0.0, tableView.camera);
			const pLast = NDCToWorld2(ndcLast, 0.0, tableView.camera);
			const dp3 = new THREE.Vector3(p.x-pLast.x, p.y-pLast.y, 0);
			tableView.camera.position.sub(dp3);
		}
	}

	draw();
}

function addArrow() {
	let obj = new Arrow(new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.0, 0.0));
	collection.objects[obj.name] = obj;

	// Here we want to use current options:
	changeActiveObject(obj.name, "", false);
	propagateOptionsToObject();

	changeState("add_arrow_start");
}

function addText() {
	let obj = new Text(new THREE.Vector2(0.0, 0.0), "Text");
	collection.objects[obj.name] = obj;

	// Here we want to use current options except for text itself:
	changeActiveObject(obj.name, "", false);
	propagateOptionsToObject();
	obj.text = "Text";
	propagateObjectToOptions();

	changeState("add_text");
}

function reset() {
	collection.reset();
	changeState("");
	changeActiveObject("");
}

function changeCamera() {
	const cameraLoop = ["orthographic", "perspective", "back"];
	for (let k = 0; k < cameraLoop.length; k++) {
		if (activeCamera == cameraLoop[k]) {
			activeCamera = cameraLoop[(k+1)%cameraLoop.length]
			break;
		}
	}
	tableView.setCamera(activeCamera);

	draw();
}

function setDisplayToAll(elements: NodeListOf<Element>, value: string) {
	elements.forEach((element) => {
		(element as HTMLElement).style.display = value;
	});
}

function checkActiveObjectValidity() {
	if (activeObject[0].startsWith("arrow")) {
		if ((state == "add_arrow_start") || (state == "add_arrow_end"))
			return;
		const arrow = collection.objects[activeObject[0]];
		if (arrow.p1.distanceTo(arrow.p2) < 0.02) {
			// degenerate arrow - delete
			deleteObject(activeObject[0]);
			changeActiveObject("");
		}
	} else if (activeObject[0].startsWith("text")) {
		const text = collection.objects[activeObject[0]];
		if (!text.text) {
			// degenerate text - delete
			deleteObject(activeObject[0]);
			changeActiveObject("");
		}
	}
}

function deleteObject(objectName: string) {
	if (objectName.startsWith("ball"))
		(collection.objects[objectName] as Ball).resetBall();
	else
		delete collection.objects[objectName];
	draw();
}

function changeState(newState: string) {
	state = newState;
	draw();
}

function draw() {
	// Check that at least some time has elapsed from last draw:
	const time = performance.now();
	if (time-lastDrawTime < 20) 
		return;
	lastDrawTime = time;

	const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
	collection.clear(canvas);
	if (activeCamera != "perspective") {
		collection.draw(tableView.camera, canvas);		// TODO REMOVE!
		collection.drawDebug(activeObject, state, collection.objects, canvas);
	}
}

function changeActiveObject(newActiveObject: string, newActiveObjectPart: string = "", propagateToOptions: boolean = true) {
	// If we are in middle of adding arrow, delete it first:
	if ((state == "add_arrow_start") || (state == "add_arrow_end") || (state == "add_text"))
		deleteObject(activeObject[0]);

	activeObject = [newActiveObject, newActiveObjectPart];
	// 1) if activeObject is "", disable tool-bar
	setDisplayToAll(document.querySelectorAll('.tool-bar'), (activeObject[0] == "" || activeObject[0].startsWith("ball")) ? "none" : "block");
	// 2) hide all "object-option":s
	setDisplayToAll(document.querySelectorAll('.object-option'), "none");
	// 3) show all "arrow-option" or "text-option"
	if (activeObject[0].startsWith("arrow"))
		setDisplayToAll(document.querySelectorAll('.arrow-option'), "flex");
	if (activeObject[0].startsWith("text"))
		setDisplayToAll(document.querySelectorAll('.text-option'), "flex");

	if (propagateToOptions)
		propagateObjectToOptions();

	draw();
}

/**
 * Sets html tool options to match activeObject properties.
 */
function propagateObjectToOptions() {
	if (activeObject[0].startsWith("arrow")) {
		const arrow = collection.objects[activeObject[0]] as Arrow;
		// Width:
		let widthInput = document.getElementById("widthInput") as HTMLInputElement;
		widthInput.value = arrow.width.toString();
		// Color:
		let colorInput = document.getElementById("arrowColorInput") as HTMLInputElement;
		colorInput.value = arrow.color;
	} else if (activeObject[0].startsWith("text")) {
		const text = collection.objects[activeObject[0]] as Text;
		// Text:
		let textInput = document.getElementById("textInput") as HTMLTextAreaElement;
		textInput.value = text.text;
		// Color:
		let colorInput = document.getElementById("textColorInput") as HTMLInputElement;
		colorInput.value = text.color;
		// Size:
		let sizeInput = document.getElementById("sizeInput") as HTMLInputElement;
		sizeInput.value = text.size.toString();
	}
}

/**
 * Sets activeObject properties to match html tool options.
 */
function propagateOptionsToObject() {
	if (activeObject[0].startsWith("arrow")) {
		const arrow = collection.objects[activeObject[0]] as Arrow;
		// Width:
		let widthValue = (document.getElementById("widthInput") as HTMLInputElement).value;
		arrow.width = parseNumberBetween(widthValue, 1.0, 30.0, 10.0);
		// Color:
		let colorValue = (document.getElementById("arrowColorInput") as HTMLInputElement).value;
		arrow.color = colorValue;
	} else if (activeObject[0].startsWith("text")) {
		const text = collection.objects[activeObject[0]] as Text;
		// Text:
		let textValue = (document.getElementById("textInput") as HTMLTextAreaElement).value;
		text.text = textValue;
		// Color:
		let colorValue = (document.getElementById("textColorInput") as HTMLInputElement).value;
		text.color = colorValue;
		// Size:
		let sizeValue = (document.getElementById("sizeInput") as HTMLInputElement).value;
		text.size = Math.round(parseNumberBetween(sizeValue, 5.0, 50.0, 30.0));
	}
	draw();
}

function save() {
	const dataString = JSON.stringify(collection.serialize());
	// console.log("dataString", dataString);

	var currentOrigin = window.location.origin;
	var basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
	const apiURL = `${window.location.origin}${basePath}/api`;

	console.log(apiURL);

	const headers = new Headers({
		'Content-Type': 'application/json',
	});
	const requestOptions = {
		method: 'POST',
		headers: headers,
		body: dataString,
	};
	fetch(apiURL, requestOptions)
		.then(response => {
			if (!response.ok)
				throw new Error('Network response was not ok');
			return response.json();
		})
		.then(data => {
			console.log("save() got data back:", data);
			copyToClipboard(data.url).then(() => {
				alert("Diagram saved. Link " + data.url + " copied to clipboard.")
			});
		})
		.catch(error => {
			console.error('There was a problem with the fetch operation:', error);
		});
}

function onWindowResize() {
	// console.log("diagram: onWindowResize");
	const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
	canvas.width = tableView.element.offsetWidth; 
	canvas.height = tableView.element.offsetHeight;
	draw();
}