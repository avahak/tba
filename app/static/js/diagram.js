/**
 * Represents the state of one pool diagram.
 *
 * TODO:
 * - add balls instead of having fixed 16
*/
export { initDiagram };
import { ObjectCollection, Arrow, Text } from "./diagramObjects.js";
import { Table } from "./table/table.js";
import { TableScene } from "./table/tableScene.js";
import { TableView } from "./table/tableView.js";
import { copyToClipboard, parseNumberBetween, clamp, loadJSON } from "./util.js";
import { pixelsToNDC, NDCToWorld2 } from "./transformation.js";
import * as THREE from 'three';
console.log("diagram.ts");
let mouseLast = {};
let table;
let tableView;
// Current 
let activeCamera = "orthographic";
let activeObject; // activeObject, activeObjectPart
let state = ""; // "", move, add_arrow_start, add_arrow_end, add_text
let collection;
let lastDrawTime = performance.now();
initDiagram();
function initDiagram() {
    const tableScene = new TableScene();
    const element = document.getElementById("three-box");
    document.addEventListener('tableSceneLoaded', () => {
        table = new Table(tableScene);
        tableView = new TableView(element, tableScene);
        tableView.setCamera(activeCamera);
        tableView.animate();
        collection = new ObjectCollection(table);
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
        const element = document.getElementById(inputName);
        element.addEventListener("input", () => {
            propagateOptionsToObject();
        });
        element.addEventListener("change", () => {
            checkActiveObjectValidity();
        });
    });
}
function addMouseListeners(element) {
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
}
function loadDiagram() {
    var _a;
    const diagramURL = (_a = document.getElementById("canvas-container")) === null || _a === void 0 ? void 0 : _a.dataset["diagramUrl"];
    console.log("url", diagramURL);
    if (!!diagramURL) {
        loadJSON(diagramURL).then((data) => {
            if (!!data) {
                console.log("data", data);
                collection.load(data);
                console.log("Initial values loaded.");
            }
        });
    }
}
function addButtonClickEventListeners() {
    var _a, _b, _c, _d, _e, _f;
    (_a = document.getElementById("buttonAddArrow")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
        addArrow();
    });
    (_b = document.getElementById("buttonAddText")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
        addText();
    });
    (_c = document.getElementById("buttonVelocity")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
        toggleBallVelocity();
    });
    (_d = document.getElementById("buttonReset")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => {
        reset();
    });
    (_e = document.getElementById("buttonCamera")) === null || _e === void 0 ? void 0 : _e.addEventListener("click", () => {
        changeCamera();
    });
    (_f = document.getElementById("buttonSave")) === null || _f === void 0 ? void 0 : _f.addEventListener("click", () => {
        save();
    });
}
function handleKeyDown(event) {
    // Do not handle events from tool-bar
    if (event.target.closest(".tool-bar"))
        return;
    if (event.key == "Delete") {
        if (!!activeObject[0])
            deleteObject(activeObject[0]);
        changeActiveObject("");
        changeState("");
    }
}
function handleMouseDown(event) {
    const p = new THREE.Vector2(event.clientX, event.clientY);
    mouseLast[event.button] = p;
    mouseAction({ action: "down", button: event.button, buttons: event.buttons, p: p });
}
function handleMouseMove(event) {
    const newX = event.clientX;
    const newY = event.clientY;
    const p = new THREE.Vector2(newX, newY);
    let dp = p;
    if (!!mouseLast[event.button])
        dp = new THREE.Vector2(newX - mouseLast[event.button].x, newY - mouseLast[event.button].y);
    mouseLast[event.button] = p;
    const movement = new THREE.Vector2(event.movementX, event.movementY);
    mouseAction({ action: "move", button: event.button, buttons: event.buttons, p: p, dp: dp, movement: movement });
}
function handleMouseUp(event) {
    mouseAction({ action: "up", button: event.button, buttons: event.buttons, p: new THREE.Vector2(event.clientX, event.clientY) });
}
function handleScroll(event) {
    event.preventDefault(); // Disable the default scroll behavior
    if (tableView.camera instanceof THREE.PerspectiveCamera) {
        cameraMoved();
        const factor = Math.exp(0.002 * event.deltaY);
        const p = tableView.camera.position.clone();
        const dir = tableView.camera.getWorldDirection(new THREE.Vector3()).normalize();
        const dist = -p.z / dir.z;
        const q = p.clone().add(dir.clone().multiplyScalar(dist)); // q.z = 0
        tableView.camera.position.copy(q.clone().add(dir.clone().multiplyScalar(-dist * factor)));
    }
}
// Custom mouse left click/drag handler:
function mouseAction(mouseAction) {
    const ndc = pixelsToNDC(mouseAction.p, tableView.element);
    // console.log("mouseAction", mouseAction);
    if ((mouseAction.action == "down") && (mouseAction.button == 0)) {
        if (state == "") {
            const obj = collection.getObject(ndc, tableView.camera, tableView.tableScene);
            changeState("move");
            changeActiveObject(obj[0], obj[1]);
        }
        else if (state == "move") {
            changeState("");
            changeActiveObject("");
        }
        else if (state == "add_text") {
            let text = collection.objects[activeObject[0]];
            text.p = NDCToWorld2(ndc, 0.0, tableView.camera);
            changeState("");
        }
        else if (state == "add_arrow_start") {
            let arrow = collection.objects[activeObject[0]];
            arrow.p1 = NDCToWorld2(ndc, 0.0, tableView.camera);
            arrow.p2 = arrow.p1;
            changeState("add_arrow_end");
        }
    }
    else if ((mouseAction.action == "up") && (mouseAction.button == 0)) {
        if (state == "move") {
            changeState("");
            checkActiveObjectValidity();
        }
        else if (state == "add_arrow_end") {
            let arrow = collection.objects[activeObject[0]];
            arrow.p2 = NDCToWorld2(ndc, 0.0, tableView.camera);
            changeState("");
            checkActiveObjectValidity();
        }
    }
    if (mouseAction.action == "move") {
        if (state == "add_arrow_end") {
            let arrow = collection.objects[activeObject[0]];
            arrow.p2 = NDCToWorld2(ndc, 0.0, tableView.camera);
        }
        else if (state == "add_text") {
            collection.move(activeObject, ndc, tableView.camera, tableView.tableScene);
        }
        if (mouseAction.buttons & 1) {
            // Left mouse button:
            if (state == "move") {
                collection.move(activeObject, ndc, tableView.camera, tableView.tableScene);
            }
            else if (state == "add_arrow_end") {
                let arrow = collection.objects[activeObject[0]];
                arrow.p2 = NDCToWorld2(ndc, 0.0, tableView.camera);
            }
        }
        if (mouseAction.buttons & 2) {
            // Right mouse button:
            if (tableView.camera instanceof THREE.PerspectiveCamera) {
                cameraMoved();
                tableView.cameraAnimates = false;
                function swizzle(p, inverse = false) {
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
                const r = tableView.camera.position.z / (-dir.z);
                const pivot = new THREE.Vector3(tableView.camera.position.x + r * dir.x, tableView.camera.position.y + r * dir.y, 0.0);
                const spherical = new THREE.Spherical().setFromVector3(swizzle(dir));
                const newPhi = clamp(spherical.phi + 0.005 * mouseAction.movement.y, Math.PI / 2 + 0.1, Math.PI - 0.05);
                const newTheta = spherical.theta - 0.005 * mouseAction.movement.x;
                const dirNew = swizzle(new THREE.Vector3().setFromSphericalCoords(1, newPhi, newTheta), true);
                tableView.camera.position.set(pivot.x - r * dirNew.x, pivot.y - r * dirNew.y, pivot.z - r * dirNew.z);
                tableView.camera.lookAt(pivot);
            }
        }
        if (mouseAction.buttons & 4) {
            // Middle mouse button:
            cameraMoved();
            tableView.cameraAnimates = false;
            const ndcLast = pixelsToNDC(mouseAction.p.clone().sub(mouseAction.dp), tableView.element);
            const p = NDCToWorld2(ndc, 0.0, tableView.camera);
            const pLast = NDCToWorld2(ndcLast, 0.0, tableView.camera);
            const dp3 = new THREE.Vector3(p.x - pLast.x, p.y - pLast.y, 0);
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
function toggleBallVelocity() {
    const ball = collection.objects[activeObject[0]];
    if (ball.v.length() > 0.01)
        ball.v.set(0, 0, 0);
    else
        ball.v.set(1, 0, 0);
}
function changeCamera() {
    cameraMoved();
    const cameraLoop = ["orthographic", "perspective", "back"];
    for (let k = 0; k < cameraLoop.length; k++) {
        if (activeCamera == cameraLoop[k]) {
            activeCamera = cameraLoop[(k + 1) % cameraLoop.length];
            break;
        }
    }
    tableView.setCamera(activeCamera);
}
function setDisplayToAll(elements, value) {
    elements.forEach((element) => {
        element.style.display = value;
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
    if (objectName.startsWith("ball")) {
        const ball = collection.objects[objectName];
        ball.reset();
        ball.updatePositionToScene();
    }
    else
        delete collection.objects[objectName];
    draw();
}
function changeState(newState) {
    state = newState;
    draw();
}
function cameraMoved() {
    const canvas = document.getElementById("overlay-canvas");
    collection.clear(canvas);
    // canvas.style.display = "none";
    draw();
}
function draw() {
    // Check that at least some time has elapsed from last draw:
    const time = performance.now();
    if (time - lastDrawTime < 50)
        return;
    lastDrawTime = time;
    const canvas = document.getElementById("overlay-canvas");
    collection.clear(canvas);
    // canvas.style.display = "block";
    if (activeCamera != "perspective") {
        collection.draw(tableView.camera, canvas); // TODO REMOVE!
        collection.drawDebug(activeObject, state, collection.objects, canvas);
    }
}
function changeActiveObject(newActiveObject, newActiveObjectPart = "", propagateToOptions = true) {
    // If we are in middle of adding arrow, delete it first:
    if ((state == "add_arrow_start") || (state == "add_arrow_end") || (state == "add_text"))
        deleteObject(activeObject[0]);
    activeObject = [newActiveObject, newActiveObjectPart];
    // 1) if activeObject is "", disable tool-bar
    setDisplayToAll(document.querySelectorAll('.tool-bar'), (activeObject[0] == "") ? "none" : "block");
    // 2) hide all "object-option":s
    setDisplayToAll(document.querySelectorAll('.object-option'), "none");
    // 3) show all "arrow-option" or "text-option"
    if (activeObject[0].startsWith("ball"))
        setDisplayToAll(document.querySelectorAll('.ball-option'), "flex");
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
        const arrow = collection.objects[activeObject[0]];
        // Width:
        let widthInput = document.getElementById("widthInput");
        widthInput.value = arrow.width.toString();
        // Color:
        let colorInput = document.getElementById("arrowColorInput");
        colorInput.value = arrow.color;
    }
    else if (activeObject[0].startsWith("text")) {
        const text = collection.objects[activeObject[0]];
        // Text:
        let textInput = document.getElementById("textInput");
        textInput.value = text.text;
        // Color:
        let colorInput = document.getElementById("textColorInput");
        colorInput.value = text.color;
        // Size:
        let sizeInput = document.getElementById("sizeInput");
        sizeInput.value = text.size.toString();
    }
}
/**
 * Sets activeObject properties to match html tool options.
 */
function propagateOptionsToObject() {
    if (activeObject[0].startsWith("arrow")) {
        const arrow = collection.objects[activeObject[0]];
        // Width:
        let widthValue = document.getElementById("widthInput").value;
        arrow.width = parseNumberBetween(widthValue, 1.0, 30.0, 10.0);
        // Color:
        let colorValue = document.getElementById("arrowColorInput").value;
        arrow.color = colorValue;
    }
    else if (activeObject[0].startsWith("text")) {
        const text = collection.objects[activeObject[0]];
        // Text:
        let textValue = document.getElementById("textInput").value;
        text.text = textValue;
        // Color:
        let colorValue = document.getElementById("textColorInput").value;
        text.color = colorValue;
        // Size:
        let sizeValue = document.getElementById("sizeInput").value;
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
            alert("Diagram saved. Link " + data.url + " copied to clipboard.");
        });
    })
        .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
    });
}
function onWindowResize() {
    // console.log("diagram: onWindowResize");
    const canvas = document.getElementById("overlay-canvas");
    canvas.width = tableView.element.offsetWidth;
    canvas.height = tableView.element.offsetHeight;
    draw();
}
