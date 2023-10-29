// Using just one Renderer, and copying the image from the renderer.domElement to 
// the canvas associated with the current widget.

export {};

import * as THREE from 'three';

interface WidgetInfo {
    mesh: THREE.Mesh;
    scene: THREE.Scene;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
}

let widgets: Map<Element, WidgetInfo>;   // cannot use object but Map can use any kind of keys
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;

initGeneral();

function initElement(element: Element, texture: THREE.Texture): void {
    let scene = new THREE.Scene();
    let aspectRatio = texture.image.width / texture.image.height;
    let geometry = new THREE.PlaneGeometry(2*aspectRatio, 2);
    let material = new THREE.MeshBasicMaterial({ map: texture });
    let mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);

    // Create and add a Canvas for the element:
    let canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    element.appendChild(canvas);
    let context = canvas.getContext("2d") as CanvasRenderingContext2D;

    widgets.set(element, { mesh: mesh, scene: scene, canvas: canvas, context: context });

    // Add a click event listener to the element
    (element as HTMLElement).addEventListener('click', onMouseClick, false);
}

function initGeneral() {
    let textureLoader = new THREE.TextureLoader();

    widgets = new Map();
    let elements = document.querySelectorAll(".widget-container");
    elements.forEach((element) => {
        textureLoader.load(`${(element as HTMLElement).dataset.image}`, (texture) => {
            initElement(element, texture);
            render(element);
        });
    });

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(200, 100);
    // element.appendChild(renderer.domElement);  // NO!

    camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 1000);
    camera.position.z = 1;
}

function render(element: Element) {
    let widgetInfo = widgets.get(element) as WidgetInfo;
    renderer.render(widgetInfo.scene, camera);
    widgetInfo.context.drawImage(renderer.domElement, 0, 0);
}

// Function to handle mouse click
function onMouseClick(event: MouseEvent) {
    const element = (event.target as HTMLElement).closest(".widget-container") as Element;
    const rect = element.getBoundingClientRect();
    // console.log(event.clientX, event.clientY);
    let x = ((event.clientX-rect.left) / 100) * 2 - 2;
    let y = -((event.clientY-rect.top) / 100) * 2 + 1;

    widgets.get(element)?.mesh.position.set(x, y, 0);

    // Render the scene after the click
    render(element);
}
