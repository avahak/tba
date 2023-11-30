/**
 * Represents the state of one pool diagram.
*/
export { initDiagram };
import { TableScene, TableView } from "./tableView.js";
import * as THREE from 'three';
console.log("diagram.ts");
let mouse = {
    lastX: null,
    lastY: null,
    isDragging: false,
    mouseDragObject: null,
};
let tableScene;
let tableView;
function initDiagram() {
    tableScene = new TableScene();
    tableView = new TableView(document.getElementById("three-box"), tableScene);
    tableView.setCamera("orthographic");
    tableView.animate();
    document.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Disable the default context menu
        mouseAction({ action: "contextmenu", x: event.clientX, y: event.clientY });
    });
    document.addEventListener('wheel', handleScroll, { passive: false }); // {passive: true} is an indicator to browser that "Go ahead with scrolling without waiting for my code to execute, and you don't need to worry about me using event.preventDefault() to disable the default scrolling behavior. I guarantee that I won't block the scrolling, so you can optimize the scrolling performance."
    // document.addEventListener('touchmove', handleScroll, {passive: false}); // For mobile, needs to compute deltaX, deltaY by hand from event.touches[0].clintX, .clientY
    // Attach event listeners to the document
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}
function handleMouseDown(event) {
    if (event.button === 0) { // Left mouse button
        mouse.isDragging = true;
        mouse.lastX = event.clientX;
        mouse.lastY = event.clientY;
        mouseAction({ action: "down", x: mouse.lastX, y: mouse.lastY });
    }
}
function handleMouseMove(event) {
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
function handleMouseUp(event) {
    if (event.button === 0) {
        mouse.isDragging = false;
        mouseAction({ action: "up", x: event.clientX, y: event.clientY });
    }
}
function handleScroll(event) {
    event.preventDefault(); // Disable the default scroll behavior
    if (event.deltaY > 0)
        tableView.setCamera("perspective");
    else
        tableView.setCamera("orthographic");
}
// Custom mouse left click/drag handler:
function mouseAction(mouseAction) {
    const nMouse = tableView.normalizedMousePosition(mouseAction.x, mouseAction.y);
    if (mouseAction.action == "down") {
        let y = tableScene.findObjectNameOnMouse(nMouse, tableView.camera);
        if (y && y.startsWith("ball_")) {
            const result = y.match(/\d+/);
            // mouse.mouseDragObject = result ? parseInt(result[0]) : null;
            mouse.mouseDragObject = result ? y : null;
        }
    }
    else if (mouseAction.action == "up") {
        mouse.mouseDragObject = null;
    }
    else if (mouseAction.action == "drag") {
        const rect = tableView.element.getBoundingClientRect();
        const mouse3D = new THREE.Vector3(nMouse.x, nMouse.y, 0.0);
        let cameraDir = tableView.camera.getWorldDirection(new THREE.Vector3());
        let a = mouse3D.unproject(tableView.camera);
        if (tableView.camera instanceof THREE.OrthographicCamera)
            a = new THREE.Vector3(a.x, a.y, 2.0);
        else
            a = a.clone().sub(tableView.camera.position).normalize();
        let ray = new THREE.Ray(tableView.camera.position, a);
        if (tableView.camera instanceof THREE.OrthographicCamera)
            ray = new THREE.Ray(a, cameraDir);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -tableScene.specs.BALL_RADIUS);
        let intersect = new THREE.Vector3();
        ray.intersectPlane(plane, intersect);
        if (!!intersect) {
            if (!!mouse.mouseDragObject) {
                const ball = tableScene.objects[mouse.mouseDragObject];
                ball.position.x = intersect.x;
                ball.position.y = intersect.y;
                let is = tableScene.intersections(mouse.mouseDragObject, ball.position);
                const resolved = tableScene.resolveIntersections(mouse.mouseDragObject, ball.position);
                ball.position.copy(resolved);
            }
        }
    }
    else if (mouseAction.action == "contextmenu") {
        let y = tableScene.findObjectNameOnMouse(nMouse, tableView.camera);
        if (y && y.startsWith("ball_")) {
            mouse.mouseDragObject = null;
            const result = y.match(/\d+/);
            const ballNumber = result ? parseInt(result[0]) : null;
            if (ballNumber) {
                const defaultPos = tableScene.defaultBallPosition(ballNumber);
                tableScene.objects[y].position.copy(defaultPos);
            }
        }
    }
}
