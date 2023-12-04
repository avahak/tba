import { TableScene } from "./tableScene.js";
import { loadJSON } from "./util.js";
import * as THREE from 'three';
const VIEWER_SIZE = new THREE.Vector2(400, 200);
let widgets; // cannot use object but Map can use any kind of keys
let tableScene;
let camera;
let renderer;
init();
function init() {
    tableScene = new TableScene();
    camera = new THREE.OrthographicCamera(-1.0, 1.0, 1.0, -1.0, 0.1, 1000.0);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0.0, 0.0, 0.0);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // renderer.setPixelRatio(window.devicePixelRatio * 2);
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(VIEWER_SIZE.x, VIEWER_SIZE.y);
    // element.appendChild(renderer.domElement);        // NO!
    widgets = new Map();
    let elements = document.querySelectorAll(".widget-container");
    elements.forEach((element) => {
        const diagramURL = element.dataset["diagramUrl"];
        if (!diagramURL)
            return;
        loadJSON(diagramURL).then((diagram) => {
            initElement(element, diagram);
            renderElement(element);
        });
    });
}
function initElement(element, diagram) {
    widgets.set(element, diagram);
}
function renderElement(element) {
}
