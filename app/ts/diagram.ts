/** 
 * Represents the state of one pool diagram.
*/

export { initDiagram };
import { TableScene, TableView } from "./tableView.js";

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
    isDragging: false
};

let tableScene: TableScene;
let tableView: TableView;

function initDiagram() {
    tableScene = new TableScene();
    tableView = new TableView(document.getElementById("three-box") as HTMLElement, tableScene);
    tableView.setCamera("perspective");
    tableView.animate();

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
	// if (mouseAction.action == "down") {
	// 	let y = findObjectNameOnMouse(mouseAction);
	// 	if (y && y.startsWith("ball")) {
	// 		const result = y.match(/\d+/);
	// 		designSettings.draggingBall = result ? parseInt(result[0]) : null;
	// 	} 
	// } else if (mouseAction.action == "up") {
	// 	designSettings.draggingBall = null;
	// } else if (mouseAction.action == "drag") {
	// 	const rect = designSettings.element.getBoundingClientRect();
	// 	const mouse = new THREE.Vector2();
	// 	mouse.x = 2*((mouseAction.x-rect.left) / rect.width) - 1;
	// 	mouse.y = -2*((mouseAction.y-rect.top) / rect.height) + 1;
	// 	const mouse3D = new THREE.Vector3(mouse.x, mouse.y, 0.5);
	// 	let a = mouse3D.unproject(camera);
	// 	const ray = new THREE.Ray(camera.position, a.clone().sub(camera.position).normalize());
	// 	const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -designSettings.specs.BALL_RADIUS);
	// 	let intersect = new THREE.Vector3();
	// 	ray.intersectPlane(plane, intersect);
	// 	if (intersect) {
	// 		if (designSettings.draggingBall != null) {
	// 			const ball = designSettings.objects[`ball${designSettings.draggingBall}`];
	// 			ball.position.x = intersect.x;
	// 			ball.position.y = intersect.y;
	// 		}
	// 	}
	// } else if (mouseAction.action == "contextmenu") {
	// 	let y = findObjectNameOnMouse(mouseAction);
	// 	if (y && y.startsWith("ball")) {
	// 		designSettings.draggingBall = null;
	// 		designSettings.objects[y].position.copy(designSettings.defaultPositions[y]);
	// 	}
	// }
}