/** 
 * Represents the state of one pool diagram.
 * 
 * TODO:
 * 1) function propagateOptionsToObject
 * 2) function propagateObjectToOptions (also called when new created)
 * 
 * later) move balls to "add ball" menu instead
*/

export { initDiagram };
import { ObjectCollection, Arrow, Text, Ball } from "./diagram-objects.js"
import { TableScene, TableView } from "./tableView.js";
import { parseNumberBetween } from "./util.js";
import * as THREE from 'three';

console.log("diagram.ts");

type MouseAction = {
    action: string;
	p: THREE.Vector2;
	dp: THREE.Vector2 | null;
};

let mouse: any = {
    last: null,
};

let tableScene: TableScene;
let tableView: TableView;

// Current 
let activeCamera: string = "orthographic";
let activeObject: string[];			// activeObject, activeObjectPart
let state: string = "";				// "", move, add_arrow_start, add_arrow_end, add_text
let collection: ObjectCollection;

function initDiagram() {
    tableScene = new TableScene();
	const element = document.getElementById("three-box") as HTMLElement;
    tableView = new TableView(element, tableScene);
    tableView.setCamera(activeCamera);
    tableView.animate();
	collection = new ObjectCollection(tableView);
	changeActiveObject("");

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

	document.addEventListener("keydown", (event) => {
		handleKeyDown(event);
	});

	addButtonClickEventHandlers();

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

function addButtonClickEventHandlers() {
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
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key == "Delete") {
		if (!!activeObject[0])
			deleteObject(activeObject[0]);
		changeActiveObject("");
		changeState("");
  	}
}

function handleMouseDown(event: MouseEvent) {
	if (event.button == 0) { // Left mouse button
		mouse.last = new THREE.Vector2(event.clientX, event.clientY);
		mouseAction({ action: "down", p: mouse.last } as MouseAction);
  	}
}

function handleMouseMove(event: MouseEvent) {
  	if (event.button == 0) {
	    const newX = event.clientX;
	    const newY = event.clientY;
	    let dp = new THREE.Vector2(newX - mouse.lastX, newY - mouse.lastY);
	    mouse.last = new THREE.Vector2(newX, newY);
		mouseAction({ action: "move", p: mouse.last, dp: dp });
  	}
}

function handleMouseUp(event: MouseEvent) {
  	if (event.button == 0) {
		mouseAction({ action: "up", p: new THREE.Vector2(event.clientX, event.clientY) } as MouseAction);
  	}
}

function handleScroll(event: WheelEvent) {
	event.preventDefault(); // Disable the default scroll behavior
	// if (event.deltaY > 0)
}

// Custom mouse left click/drag handler:
function mouseAction(mouseAction: MouseAction) {
    const ndc = tableView.pixelsToNDC(mouseAction.p);
	// console.log("mouseAction", mouseAction);
	if (mouseAction.action == "down") {
		if (state == "") {
			const obj = collection.getObject(ndc);
			changeState("move");
			changeActiveObject(obj[0], obj[1]);
			// if (!!obj[0]) {
			// 	changeState("move");
			// 	changeActiveObject(obj[0], obj[1]);
			// }
		} else if (state == "move") {
			changeState("");
			changeActiveObject("");
		} else if (state == "add_text") {
			let text = collection.objects[activeObject[0]] as Text;
			text.p = collection.NDCToWorld2(ndc, 0.0);
			changeState("");
		} else if (state == "add_arrow_start") {
			let arrow = collection.objects[activeObject[0]] as Arrow;
			arrow.p1 = collection.NDCToWorld2(ndc, 0.0);
			arrow.p2 = arrow.p1;
			changeState("add_arrow_end");
		} 
	} else if (mouseAction.action == "up") {
		if (state == "move") {
			changeState("");
			checkActiveObjectValidity();
		}
		else if (state == "add_arrow_end") {
			let arrow = collection.objects[activeObject[0]] as Arrow;
			arrow.p2 = collection.NDCToWorld2(ndc, 0.0);
			changeState("");
			checkActiveObjectValidity();
		}
	} else if (mouseAction.action == "move") {
		if (state == "move") {
			collection.move(activeObject, ndc);
		} else if (state == "add_arrow_end") {
			let arrow = collection.objects[activeObject[0]] as Arrow;
			arrow.p2 = collection.NDCToWorld2(ndc, 0.0);
		} else if (state == "add_text") {
			collection.move(activeObject, ndc);
		}
	} else if (mouseAction.action == "contextmenu") {
		changeState("");
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

	// Here we want to use current options:
	changeActiveObject(obj.name, "", false);
	propagateOptionsToObject();

	changeState("add_text");
}

function reset() {
	Object.keys(collection.objects).forEach((key) => {
		delete collection.objects[key];
	});
	Object.keys(tableScene.objects).forEach((key) => {
		if (key.startsWith("ball")) {
			const ball = tableScene.objects[key];
			let ballNumber = Ball.getBallNumber(key) as number;
            const defaultPos = tableScene.defaultBallPosition(ballNumber);
            ball.position.copy(defaultPos);
		}
	});
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
	delete collection.objects[objectName];
	draw();
}

function changeState(newState: string) {
	state = newState;
	draw();
}

function draw() {
	if (activeCamera != "perspective") {
		collection.draw();		// TODO REMOVE!
		collection.drawDebug(activeObject, state, collection.objects);
	} else {
		collection.clear();
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
		let textInput = document.getElementById("textInput") as HTMLInputElement;
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
		let textValue = (document.getElementById("textInput") as HTMLInputElement).value;
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