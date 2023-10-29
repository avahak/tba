// Using just one Renderer, and copying the image from the renderer.domElement to 
// the canvas associated with the current widget.
import * as THREE from 'three';
let widgets; // cannot use object but Map can use any kind of keys
let camera;
let renderer;
initGeneral();
function initElement(element, texture) {
    let scene = new THREE.Scene();
    let aspectRatio = texture.image.width / texture.image.height;
    let geometry = new THREE.PlaneGeometry(2 * aspectRatio, 2);
    let material = new THREE.MeshBasicMaterial({ map: texture });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    // Create and add a Canvas for the element:
    let canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    element.appendChild(canvas);
    let context = canvas.getContext("2d");
    widgets.set(element, { mesh: mesh, scene: scene, canvas: canvas, context: context });
    // Add a click event listener to the element
    element.addEventListener('click', onMouseClick, false);
}
function initGeneral() {
    let textureLoader = new THREE.TextureLoader();
    widgets = new Map();
    let elements = document.querySelectorAll(".widget-container");
    elements.forEach((element) => {
        textureLoader.load(`${element.dataset.image}`, (texture) => {
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
function render(element) {
    let widgetInfo = widgets.get(element);
    renderer.render(widgetInfo.scene, camera);
    widgetInfo.context.drawImage(renderer.domElement, 0, 0);
}
// Function to handle mouse click
function onMouseClick(event) {
    var _a;
    const element = event.target.closest(".widget-container");
    const rect = element.getBoundingClientRect();
    // console.log(event.clientX, event.clientY);
    let x = ((event.clientX - rect.left) / 100) * 2 - 2;
    let y = -((event.clientY - rect.top) / 100) * 2 + 1;
    (_a = widgets.get(element)) === null || _a === void 0 ? void 0 : _a.mesh.position.set(x, y, 0);
    // Render the scene after the click
    render(element);
}