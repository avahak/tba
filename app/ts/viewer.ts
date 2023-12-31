/**
 * TODO 
 * - handle zoom and window.devicePixelRatio.
 */

export {};

import { ObjectCollection } from "./diagramObjects.js";
import { TableScene } from "./table/tableScene.js";
import { loadJSON, clamp } from "./util.js";
import { Ball } from "./table/ball.js";
import { Table } from "./table/table.js";
import * as THREE from 'three';

interface CameraPose {
    p: THREE.Vector3;       // near or on slate plane, camera looks at this
    r: number;
    theta: number;
    phi: number;
}
interface WidgetInfo {
    collection: ObjectCollection;
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    cameraPose: CameraPose;
}

const E3 = new THREE.Vector3(0, 0, 1);
const VIEWER_SIZE = new THREE.Vector2(650, 400);

let widgets: Map<Element, WidgetInfo>;   // cannot use object but Map can use any kind of keys

let tableScene: TableScene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

let renderCounter = 0;

init();

function init() {
    tableScene = new TableScene();
    camera = new THREE.PerspectiveCamera(40, VIEWER_SIZE.x / VIEWER_SIZE.y, 0.01, 100);
    camera.position.set(0, -0.2, 2.55);
    camera.lookAt(0.0, 0.0, 0.0);
    camera.up = E3;

    tableScene.setLights("ambient");

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    // renderer.setPixelRatio(2*window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(VIEWER_SIZE.x, VIEWER_SIZE.y);
    // element.appendChild(renderer.domElement);        // NO!

    document.addEventListener('tableSceneLoaded', () => {
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
                element.addEventListener('mousemove', (event) => handleMouseMove(element, event));
                element.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                });
                // element.addEventListener('mousedown', (event) => {
                //     if (event.button === 1)
                //         event.preventDefault(); // Prevent default browser behavior
                // });
                element.addEventListener('wheel', (event) => handleMouseWheel(element, event), {passive: false});
            });
        });
    });
    window.addEventListener('resize', () => {
        resize();
    });
}

function initElement(element: HTMLElement, diagram: any) {
    // Create and add a canvas for the element:
    let canvas = document.createElement('canvas');
    canvas.width = VIEWER_SIZE.x;
    canvas.height = VIEWER_SIZE.y;
    element.appendChild(canvas);
    let canvasContext = canvas.getContext("2d") as CanvasRenderingContext2D;

    const table = new Table(tableScene);
    const collection = new ObjectCollection(table);
    collection.load(diagram);

    const cameraPose = { p: new THREE.Vector3(), r: 2.55, theta: -Math.PI/2, phi: Math.PI/2-0.02 }
    const widgetInfo = { collection: collection, canvas: canvas, canvasContext: canvasContext, cameraPose: cameraPose };
    widgets.set(element, widgetInfo);
}

function handleMouseWheel(element: HTMLElement, event: WheelEvent) {
    let widgetInfo = widgets.get(element) as WidgetInfo;
    const cp = widgetInfo.cameraPose;
    event.preventDefault();
    cp.r *= Math.exp(0.002*event.deltaY);
    renderElement(element);
}

function handleMouseMove(element: HTMLElement, event: MouseEvent) {
    let widgetInfo = widgets.get(element) as WidgetInfo;
    const cp = widgetInfo.cameraPose;
    let renderNeeded = false;
    if (event.buttons & 1) {
        // Left mouse button:
        const dir = new THREE.Vector3(cp.r*Math.cos(cp.phi)*Math.cos(cp.theta), cp.r*Math.cos(cp.phi)*Math.sin(cp.theta), 0).normalize();
        const dir2 = dir.clone().cross(E3).normalize();
        cp.p.add(dir.multiplyScalar(-0.001*event.movementY*cp.r));
        cp.p.add(dir2.multiplyScalar(0.001*event.movementX*cp.r));
        renderNeeded = true;
    }
    if (event.buttons & 2) {
        // Right mouse button:
        cp.phi = clamp(cp.phi + 0.01*event.movementY, 0.1, Math.PI/2-0.02);
        cp.theta = cp.theta - 0.01*event.movementX;
        renderNeeded = true;
    }
    if (renderNeeded)
        renderElement(element);
}

function poseCamera(cp: CameraPose) {
    const dir = new THREE.Vector3(
        cp.r*Math.cos(cp.phi)*Math.cos(cp.theta),
        cp.r*Math.cos(cp.phi)*Math.sin(cp.theta),  
        cp.r*Math.sin(cp.phi));
    camera.position.copy(cp.p.clone().add(dir));
    camera.lookAt(cp.p);
}

function renderElement(element: HTMLElement) {
    let widgetInfo = widgets.get(element) as WidgetInfo;
    // Restore ball positions to the scene in case they were messed up by another widget:
    for (let k = 0; k < 16; k++) {
        const ball = widgetInfo.collection.objects[`ball_${k}`] as Ball;
        ball.updatePositionToScene();
    }
    poseCamera(widgetInfo.cameraPose);
    renderer.render(tableScene.scene, camera);
    widgetInfo.collection.clear(widgetInfo.canvas);
    widgetInfo.canvasContext.drawImage(renderer.domElement, 0, 0);
    widgetInfo.collection.draw(camera, widgetInfo.canvas);

    renderCounter++;
    // console.log("renderElement calls:", renderCounter);
}

function resize() {
    // renderer.setPixelRatio(window.devicePixelRatio);
    // renderer.setSize(VIEWER_SIZE.x, VIEWER_SIZE.y);
    // camera.updateProjectionMatrix();
    // widgets.forEach((widget, element) => {
    //     const canvas = widget.canvas;
    //     canvas.width = VIEWER_SIZE.x;
    //     canvas.height = VIEWER_SIZE.y;
    //     renderElement(element as HTMLElement);
    // });
}