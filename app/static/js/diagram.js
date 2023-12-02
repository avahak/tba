/**
 * Represents the state of one pool diagram.
*/
export { initDiagram };
import { ObjectCollection, Arrow, Text, Ball } from "./diagram-objects.js";
import { TableScene, TableView } from "./tableView.js";
import * as THREE from 'three';
console.log("diagram.ts");
let mouse = {
    last: null,
};
let tableScene;
let tableView;
// Current 
let activeCamera = "orthographic";
let activeObject; // activeObject, activeObjectPart
let state = ""; // "", move, add_arrow_start, add_arrow_end, add_text
let collection;
function initDiagram() {
    tableScene = new TableScene();
    const element = document.getElementById("three-box");
    tableView = new TableView(element, tableScene);
    tableView.setCamera(activeCamera);
    tableView.animate();
    collection = new ObjectCollection(tableView);
    changeActiveObject("");
    element.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Disable the default context menu
        mouseAction({ action: "contextmenu", p: new THREE.Vector2(event.clientX, event.clientY) });
    });
    element.addEventListener('wheel', handleScroll, { passive: false }); // {passive: true} is an indicator to browser that "Go ahead with scrolling without waiting for my code to execute, and you don't need to worry about me using event.preventDefault() to disable the default scrolling behavior. I guarantee that I won't block the scrolling, so you can optimize the scrolling performance."
    // document.addEventListener('touchmove', handleScroll, {passive: false}); // For mobile, needs to compute deltaX, deltaY by hand from event.touches[0].clintX, .clientY
    // Attach event listeners to the document
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseup', handleMouseUp);
    document.addEventListener("keydown", (event) => {
        handleKeyDown(event);
    });
    addButtonClickEventHandlers();
}
function addButtonClickEventHandlers() {
    var _a, _b, _c, _d;
    (_a = document.getElementById("buttonAddArrow")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
        addArrow();
    });
    (_b = document.getElementById("buttonAddText")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
        addText();
    });
    (_c = document.getElementById("buttonReset")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
        reset();
    });
    (_d = document.getElementById("buttonCamera")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => {
        changeCamera();
    });
}
function handleKeyDown(event) {
    if (event.key == "Delete") {
        if (!!activeObject[0])
            deleteObject(activeObject[0]);
        changeActiveObject("");
        changeState("");
    }
}
function handleMouseDown(event) {
    if (event.button == 0) { // Left mouse button
        mouse.last = new THREE.Vector2(event.clientX, event.clientY);
        mouseAction({ action: "down", p: mouse.last });
    }
}
function handleMouseMove(event) {
    if (event.button == 0) {
        const newX = event.clientX;
        const newY = event.clientY;
        let dp = new THREE.Vector2(newX - mouse.lastX, newY - mouse.lastY);
        mouse.last = new THREE.Vector2(newX, newY);
        mouseAction({ action: "move", p: mouse.last, dp: dp });
    }
}
function handleMouseUp(event) {
    if (event.button == 0) {
        mouseAction({ action: "up", p: new THREE.Vector2(event.clientX, event.clientY) });
    }
}
function handleScroll(event) {
    event.preventDefault(); // Disable the default scroll behavior
    // if (event.deltaY > 0)
}
// Custom mouse left click/drag handler:
function mouseAction(mouseAction) {
    const ndc = tableView.pixelsToNDC(mouseAction.p);
    // console.log("mouseAction", mouseAction);
    if (mouseAction.action == "down") {
        if (state == "") {
            changeState("move");
            const obj = collection.getObject(ndc);
            changeActiveObject(obj[0], obj[1]);
        }
        else if (state == "move") {
            changeState("");
            changeActiveObject("");
        }
        else if (state == "add_text") {
            let text = collection.objects[activeObject[0]];
            text.p = collection.NDCToWorld2(ndc, 0.0);
            changeState("");
        }
        else if (state == "add_arrow_start") {
            let arrow = collection.objects[activeObject[0]];
            arrow.p1 = collection.NDCToWorld2(ndc, 0.0);
            arrow.p2 = arrow.p1;
            changeState("add_arrow_end");
        }
    }
    else if (mouseAction.action == "up") {
        if (state == "move") {
            changeState("");
            checkActiveObjectValidity();
        }
        else if (state == "add_arrow_end") {
            let arrow = collection.objects[activeObject[0]];
            arrow.p2 = collection.NDCToWorld2(ndc, 0.0);
            changeState("");
            checkActiveObjectValidity();
        }
    }
    else if (mouseAction.action == "move") {
        if (state == "move") {
            collection.move(activeObject, ndc);
        }
        else if (state == "add_arrow_end") {
            let arrow = collection.objects[activeObject[0]];
            arrow.p2 = collection.NDCToWorld2(ndc, 0.0);
        }
        else if (state == "add_text") {
            collection.move(activeObject, ndc);
        }
    }
    else if (mouseAction.action == "contextmenu") {
        changeState("");
    }
    draw();
}
function addArrow() {
    let obj = new Arrow(new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.0, 0.0));
    collection.objects[obj.name] = obj;
    changeActiveObject(obj.name);
    changeState("add_arrow_start");
}
function addText() {
    let obj = new Text(new THREE.Vector2(0.0, 0.0), "Text");
    collection.objects[obj.name] = obj;
    changeActiveObject(obj.name);
    changeState("add_text");
}
function reset() {
    Object.keys(collection.objects).forEach((key) => {
        delete collection.objects[key];
    });
    Object.keys(tableScene.objects).forEach((key) => {
        if (key.startsWith("ball")) {
            const ball = tableScene.objects[key];
            let ballNumber = Ball.getBallNumber(key);
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
            activeCamera = cameraLoop[(k + 1) % cameraLoop.length];
            break;
        }
    }
    tableView.setCamera(activeCamera);
    console.log("changeCamera", activeCamera);
    draw();
}
function setDisplayToAll(elements, value) {
    elements.forEach((element) => {
        element.style.display = value;
    });
}
function checkActiveObjectValidity() {
    if (activeObject[0].startsWith("arrow")) {
        const arrow = collection.objects[activeObject[0]];
        if (arrow.p1.distanceTo(arrow.p2) < 0.02) {
            // degenerate arrow - delete
            deleteObject(activeObject[0]);
            changeActiveObject("");
        }
    }
    else if (activeObject[0].startsWith("text")) {
        const text = collection.objects[activeObject[0]];
        if (!text.text) {
            // degenerate text - delete
            deleteObject(activeObject[0]);
            changeActiveObject("");
        }
    }
}
function deleteObject(objectName) {
    delete collection.objects[objectName];
    draw();
}
function changeState(newState) {
    state = newState;
    draw();
}
function draw() {
    console.log("draw", activeCamera);
    if (activeCamera != "perspective") {
        collection.draw(); // TODO REMOVE!
        collection.drawDebug(activeObject, state, collection.objects);
    }
    else {
        collection.clear();
    }
}
function changeActiveObject(newActiveObject, newActiveObjectPart = "") {
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
        setDisplayToAll(document.querySelectorAll('.arrow-option'), "block");
    if (activeObject[0].startsWith("text"))
        setDisplayToAll(document.querySelectorAll('.text-option'), "block");
    draw();
}
