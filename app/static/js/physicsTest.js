/**
 * Testing physics.
 */
import { TableScene } from "./table/tableScene.js";
import { Table } from "./table/table.js";
import { clamp } from "./util.js";
import { PhysicsLoop } from "./table/physics.js";
import * as THREE from 'three';
const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);
let tableScene;
let camera;
let renderer;
let element;
let cameraPose;
let physicsLoop;
init();
function init() {
    tableScene = new TableScene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.up = E3;
    cameraPose = { p: new THREE.Vector3(0, -0.2, 0), r: 2.1, theta: -Math.PI / 2, phi: 1.0 };
    element = document.getElementById("three-box");
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio * 1.5);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);
    element.appendChild(renderer.domElement);
    document.addEventListener('tableSceneLoaded', () => {
        const table = new Table(tableScene);
        physicsLoop = new PhysicsLoop(table);
        tableScene.setLights("square");
        if (!!tableScene.cushionEdgeCylinders)
            tableScene.cushionEdgeCylinders.visible = false;
        element.addEventListener('mousemove', (event) => handleMouseMove(event));
        element.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        // element.addEventListener('mousedown', (event) => {
        //     if (event.button === 1)
        //         event.preventDefault(); // Prevent default browser behavior
        // });
        element.addEventListener('wheel', (event) => handleMouseWheel(event), { passive: false });
        window.addEventListener('resize', () => {
            resize();
        });
        resize();
        addToolListeners();
        animate();
    });
}
function addToolListeners() {
    var _a, _b, _c;
    (_a = document.getElementById("buttonReset")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", (event) => {
        physicsLoop.reset();
    });
    (_b = document.getElementById("buttonTest")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", (event) => {
        const diagrams = [
            `http://localhost:5000/api/57c4f394a70e4a1fbe75b1bc67d70367`,
            `https://vahakangasma.azurewebsites.net/api/89d89c3a89d24dd5966ca096c34d80b9`,
            `https://vahakangasma.azurewebsites.net/api/050a6ca3d06e4698b1b3f9b6f7af259e`
        ];
        let k = Math.floor(Math.random() * 3);
        physicsLoop.loadDiagram(diagrams[k]);
    });
    (_c = document.getElementById("inputSpeed")) === null || _c === void 0 ? void 0 : _c.addEventListener("input", (event) => {
        const t = parseFloat(event.target.value);
        const speed = Math.exp(-6 * t / 8);
        if (t == parseFloat(event.target.min))
            physicsLoop.setSpeed(0);
        else
            physicsLoop.setSpeed(speed);
    });
}
function handleMouseWheel(event) {
    event.preventDefault();
    cameraPose.r *= Math.exp(0.002 * event.deltaY);
}
function handleMouseMove(event) {
    if (event.buttons & 4) {
        // Left mouse button:
        const dir = new THREE.Vector3(cameraPose.r * Math.cos(cameraPose.phi) * Math.cos(cameraPose.theta), cameraPose.r * Math.cos(cameraPose.phi) * Math.sin(cameraPose.theta), 0).normalize();
        const dir2 = dir.clone().cross(E3).normalize();
        cameraPose.p.add(dir.multiplyScalar(-0.001 * event.movementY * cameraPose.r));
        cameraPose.p.add(dir2.multiplyScalar(0.001 * event.movementX * cameraPose.r));
    }
    if (event.buttons & 2) {
        // Right mouse button:
        cameraPose.phi = clamp(cameraPose.phi + 0.005 * event.movementY, 0.1, Math.PI / 2 - 0.02);
        cameraPose.theta = cameraPose.theta - 0.005 * event.movementX;
    }
}
function poseCamera() {
    const dir = new THREE.Vector3(cameraPose.r * Math.cos(cameraPose.phi) * Math.cos(cameraPose.theta), cameraPose.r * Math.cos(cameraPose.phi) * Math.sin(cameraPose.theta), cameraPose.r * Math.sin(cameraPose.phi));
    camera.position.copy(cameraPose.p.clone().add(dir));
    camera.lookAt(cameraPose.p);
}
function animate() {
    physicsLoop.simulate(30 / 1000);
    poseCamera();
    renderer.render(tableScene.scene, camera);
    requestAnimationFrame(animate);
}
function resize() {
    const aspect = element.offsetWidth / element.offsetHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(element.offsetWidth, element.offsetHeight);
}
