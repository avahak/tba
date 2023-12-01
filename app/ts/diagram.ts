/** 
 * Represents the state of one pool diagram.
*/

export { initDiagram };
import { ObjectCollection, Arrow, Text, Ball } from "./diagram-objects.js"
import { TableScene, TableView } from "./tableView.js";
import * as THREE from 'three';

console.log("diagram.ts");

type MouseAction = {
    action: string;
    x: number;
    y: number;
	dx: number | null;
	dy: number | null;
};

let mouse: any = {
    lastX: null,
    lastY: null,
    isDragging: false,	// if true, dragging happens to activeObject
};

let tableScene: TableScene;
let tableView: TableView;

// Current 
let activeObject: string = "";
let collection: ObjectCollection;

function initDiagram() {
    tableScene = new TableScene();
    tableView = new TableView(document.getElementById("three-box") as HTMLElement, tableScene);
    tableView.setCamera("orthographic");
    tableView.animate();
	collection = new ObjectCollection(tableView);

	document.addEventListener('contextmenu', (event) => {
		event.preventDefault(); // Disable the default context menu
		mouseAction({ action: "contextmenu", x: event.clientX, y: event.clientY } as MouseAction);
	});
	
	document.addEventListener('wheel', handleScroll, {passive: false});	// {passive: true} is an indicator to browser that "Go ahead with scrolling without waiting for my code to execute, and you don't need to worry about me using event.preventDefault() to disable the default scrolling behavior. I guarantee that I won't block the scrolling, so you can optimize the scrolling performance."
	// document.addEventListener('touchmove', handleScroll, {passive: false}); // For mobile, needs to compute deltaX, deltaY by hand from event.touches[0].clintX, .clientY
	
	// Attach event listeners to the document
	document.addEventListener('mousedown', handleMouseDown);
	document.addEventListener('mousemove', handleMouseMove);
	document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseDown(event: MouseEvent) {
	collection.draw();
	if (event.button === 0) { // Left mouse button
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
	event.preventDefault(); // Disable the default scroll behavior
	if (event.deltaY > 0)
        tableView.setCamera("perspective");
	else 
        tableView.setCamera("orthographic");
}

// Custom mouse left click/drag handler:
function mouseAction(mouseAction: MouseAction) {
    const nMouse = tableView.normalizedMousePosition(mouseAction.x, mouseAction.y);
	if (mouseAction.action == "down") {
		let y = tableScene.findObjectNameOnMouse(nMouse, tableView.camera);
		if ((!!y) && y.startsWith("ball_")) {
            activeObject = y;
			mouse.isDragging = true;
		} 
	} else if (mouseAction.action == "up") {
		mouse.isDragging = false;
	} else if (mouseAction.action == "drag") {
		// dragging active object:
		let intersect = collection.mouseToWorld(nMouse, tableScene.specs.BALL_RADIUS);
		if (!!intersect) {
			if (!!activeObject) {
				const ball = tableScene.objects[activeObject];
				const oldBallPosition = ball.position.clone();
				ball.position.x = intersect.x;
				ball.position.y = intersect.y;
                const resolved = tableScene.resolveIntersections(activeObject, ball.position);
				let oob = tableScene.outOfBoundsString(resolved);
				if ((tableScene.intersections(activeObject, resolved).length == 0) && (!oob))
                	ball.position.copy(resolved);
				else
					ball.position.copy(oldBallPosition);
				if (oob == "pocket") {
					let ballNumber = Ball.getBallNumber(activeObject) as number;
					const defaultPos = tableScene.defaultBallPosition(ballNumber);
                	ball.position.copy(defaultPos);
				}
			}
		}
	} else if (mouseAction.action == "contextmenu") {
		mouse.isDragging = false;
		let y = tableScene.findObjectNameOnMouse(nMouse, tableView.camera);
		if ((!!y) && y.startsWith("ball_")) {
			const ballNumber = Ball.getBallNumber(y) as number;
			const defaultPos = tableScene.defaultBallPosition(ballNumber);
			tableScene.objects[y].position.copy(defaultPos);
		}
	}
}