// By creating a single THREE.WebGLRenderer instance and using separate 
// canvas elements for each element, you can render the 3D graphics to a 
// hidden render target, and then copy the rendered image to the relevant 
// canvas element's context when needed.
// Load the three.js modules fully before doing anything:
let THREE;
let OBJLoader;
let MTLLoader;
Promise.all([
    import('three'),
    import('three/examples/jsm/loaders/OBJLoader.js'),
    import('three/examples/jsm/loaders/MTLLoader.js'),
]).then(([module1, module2, module3]) => {
    THREE = module1;
    OBJLoader = module2.OBJLoader;
    MTLLoader = module3.MTLLoader;
    initGeneral();
});
let widgets; // cannot use object but Map can use any kind of keys
let camera;
function initElement(element, texture) {
    let scene = new THREE.Scene();
    let aspectRatio = texture.image.width / texture.image.height;
    let geometry = new THREE.PlaneGeometry(2 * aspectRatio, 2);
    let material = new THREE.MeshBasicMaterial({ map: texture });
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    let renderer = new THREE.WebGLRenderer();
    renderer.setSize(200, 100);
    element.appendChild(renderer.domElement);
    widgets.set(element, { mesh: mesh, scene: scene, renderer: renderer });
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
    camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 1000);
    camera.position.z = 1;
}
function render(element) {
    widgets.get(element).renderer.render(widgets.get(element).scene, camera);
}
// Function to handle mouse click
function onMouseClick(event) {
    const element = event.target.closest(".widget-container");
    const rect = element.getBoundingClientRect();
    // console.log(event.clientX, event.clientY);
    let x = ((event.clientX - rect.left) / 100) * 2 - 2;
    let y = -((event.clientY - rect.top) / 100) * 2 + 1;
    widgets.get(element).mesh.position.set(x, y, 0);
    // Render the scene after the click
    render(element);
}
export {};
