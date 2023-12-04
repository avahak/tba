import { ObjectCollection } from "./diagramObjects.js";
import { TableScene } from "./tableScene.js";
import { loadJSON } from "./util.js";
import * as THREE from 'three';
const VIEWER_SIZE = new THREE.Vector2(400, 300);
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
    tableScene.setLights("ambient");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // renderer.setPixelRatio(window.devicePixelRatio * 2);
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(VIEWER_SIZE.x, VIEWER_SIZE.y);
    // element.appendChild(renderer.domElement);        // NO!
    document.addEventListener('tableSceneLoaded', () => {
        console.log('tableSceneLoaded');
        widgets = new Map();
        let elements = document.querySelectorAll(".widget-container");
        elements.forEach((element) => {
            if (!(element instanceof HTMLElement))
                return;
            const diagramURL = element.dataset["diagram"];
            if (!diagramURL)
                return;
            loadJSON(diagramURL).then((diagram) => {
                initElement(element, diagram);
                renderElement(element);
            });
        });
    });
}
function initElement(element, diagram) {
    // Create and add a Canvas for the element:
    let canvas = document.createElement('canvas');
    canvas.width = VIEWER_SIZE.x;
    canvas.height = VIEWER_SIZE.y;
    element.appendChild(canvas);
    let canvasContext = canvas.getContext("2d");
    const collection = new ObjectCollection(tableScene);
    collection.load(diagram);
    const widgetInfo = { collection: collection, canvas: canvas, canvasContext: canvasContext };
    widgets.set(element, widgetInfo);
}
function renderElement(element) {
    let widgetInfo = widgets.get(element);
    renderer.render(tableScene.scene, camera);
    widgetInfo.canvasContext.drawImage(renderer.domElement, 0, 0);
    widgetInfo.collection.draw(camera, widgetInfo.canvas);
}
