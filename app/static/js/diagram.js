/**
 * Represents the state of one pool diagram.
*/
export { initDiagram, addArrow, addText };
import { ObjectCollection, Arrow, Text } from "./diagram-objects.js";
import { TableScene, TableView } from "./tableView.js";
import * as THREE from 'three';
console.log("diagram.ts");
let mouse = {
    last: null,
};
let tableScene;
let tableView;
// Current 
let activeObject;
let state = ""; // "", move, add_arrow_start, add_arrow_end
let collection;
function initDiagram() {
    tableScene = new TableScene();
    tableView = new TableView(document.getElementById("three-box"), tableScene);
    tableView.setCamera("orthographic");
    tableView.animate();
    collection = new ObjectCollection(tableView);
    changeActiveObject("");
    document.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Disable the default context menu
        mouseAction({ action: "contextmenu", p: new THREE.Vector2(event.clientX, event.clientY) });
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
        mouse.last = new THREE.Vector2(event.clientX, event.clientY);
        mouseAction({ action: "down", p: mouse.last });
    }
}
function handleMouseMove(event) {
    if (event.button === 0) {
        const newX = event.clientX;
        const newY = event.clientY;
        let dp = new THREE.Vector2(newX - mouse.lastX, newY - mouse.lastY);
        mouse.last = new THREE.Vector2(newX, newY);
        mouseAction({ action: "move", p: mouse.last, dp: dp });
    }
}
function handleMouseUp(event) {
    if (event.button === 0) {
        mouseAction({ action: "up", p: new THREE.Vector2(event.clientX, event.clientY) });
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
    collection.draw(); // TODO REMOVE!
    collection.drawDebug(activeObject, state);
    const ndc = tableView.pixelsToNDC(mouseAction.p);
    // console.log("mouseAction", mouseAction);
    if (mouseAction.action == "down") {
        if (state == "") {
            state = "move";
            changeActiveObject(collection.getObject(ndc));
        }
        else if (state == "move") {
            state = "";
            changeActiveObject("");
        }
        else if (state == "add_text") {
            let text = collection.objects[activeObject];
            text.p = collection.NDCToWorld2(ndc, 0.0);
            state = "";
        }
        else if (state == "add_arrow_start") {
            let arrow = collection.objects[activeObject];
            arrow.p1 = collection.NDCToWorld2(ndc, 0.0);
            state = "add_arrow_end";
        }
        else if (state == "add_arrow_end") {
            let arrow = collection.objects[activeObject];
            arrow.p2 = collection.NDCToWorld2(ndc, 0.0);
            state = "";
        }
    }
    else if (mouseAction.action == "up") {
        if (state == "move")
            state = "";
    }
    else if (mouseAction.action == "move") {
        if (state == "move") {
            collection.move(activeObject, ndc);
        }
    }
    else if (mouseAction.action == "contextmenu") {
        state = "";
    }
}
function addArrow() {
    let obj = new Arrow(new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.0, 0.0));
    collection.objects[obj.name] = obj;
    changeActiveObject(obj.name);
    state = "add_arrow_start";
}
function addText() {
    let obj = new Text(new THREE.Vector2(0.0, 0.0), "Text");
    collection.objects[obj.name] = obj;
    changeActiveObject(obj.name);
    state = "move";
}
function setDisplayToAll(elements, value) {
    elements.forEach((element) => {
        element.style.display = value;
    });
}
function changeActiveObject(newActiveObject) {
    activeObject = newActiveObject;
    // 1) if activeObject is "", disable tool-bar
    setDisplayToAll(document.querySelectorAll('.tool-bar'), (activeObject == "" || activeObject.startsWith("ball")) ? "none" : "block");
    // 2) hide all "object-option":s
    setDisplayToAll(document.querySelectorAll('.object-option'), "none");
    // 3) show all "arrow-option" or "text-option"
    if (activeObject.startsWith("arrow"))
        setDisplayToAll(document.querySelectorAll('.arrow-option'), "block");
    if (activeObject.startsWith("text"))
        setDisplayToAll(document.querySelectorAll('.text-option'), "block");
}
