/**
 * Animation for the welcome page.
 */
console.log("welcomeAnimate.ts");
import { TableScene } from "./table/tableScene.js";
import { Table } from "./table/table.js";
import { clamp, loadJSON } from "./util.js";
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
let shotAnimator;
init();
function init() {
    tableScene = new TableScene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.up = E3;
    cameraPose = { p: new THREE.Vector3(0, 0, -0.2), r: 1, theta: -Math.PI / 2, phi: 0.85 };
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
        // Dim the lights a bit:
        tableScene.lightGroup.traverse((child) => {
            if (child instanceof THREE.Light)
                child.intensity = child.intensity * 0.1;
        });
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
        // element.addEventListener('wheel', (event) => handleMouseWheel(event), {passive: false});
        window.addEventListener('resize', () => {
            resize();
        });
        resize();
        makeFeaturesButtons();
        shotAnimator = new ShotAnimator(table);
    });
}
function makeFeaturesButtons() {
    console.log("makeFeaturesButtons");
    document.querySelectorAll(".div-feature").forEach((element) => {
        const url = element.dataset.url;
        if (!!url)
            element.addEventListener("click", (event) => { window.location.href = url; });
    });
}
function handleMouseMove(event) {
    // if (event.buttons & 4) {
    //     // Left mouse button:
    //     const dir = new THREE.Vector3(cameraPose.r*Math.cos(cameraPose.phi)*Math.cos(cameraPose.theta), cameraPose.r*Math.cos(cameraPose.phi)*Math.sin(cameraPose.theta), 0).normalize();
    //     const dir2 = dir.clone().cross(E3).normalize();
    //     cameraPose.p.add(dir.multiplyScalar(-0.001*event.movementY*cameraPose.r));
    //     cameraPose.p.add(dir2.multiplyScalar(0.001*event.movementX*cameraPose.r));
    // }
    // if (event.buttons & 2) { // Right mouse button:
    // }
    if (event.buttons) {
        // Any button:
        cameraPose.phi = clamp(cameraPose.phi + 0.005 * event.movementY, 0.1, Math.PI / 2 - 0.02);
        cameraPose.theta = cameraPose.theta - 0.005 * event.movementX;
    }
}
function resize() {
    const aspect = element.offsetWidth / element.offsetHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(element.offsetWidth, element.offsetHeight);
}
function poseCamera() {
    const dir = new THREE.Vector3(cameraPose.r * Math.cos(cameraPose.phi) * Math.cos(cameraPose.theta), cameraPose.r * Math.cos(cameraPose.phi) * Math.sin(cameraPose.theta), cameraPose.r * Math.sin(cameraPose.phi));
    camera.position.copy(cameraPose.p.clone().add(dir));
    camera.lookAt(cameraPose.p);
}
class CameraController {
    constructor() {
    }
}
class ShotAnimator {
    constructor(table) {
        this.animate = this.animate.bind(this);
        this.table = table;
        this.diagrams = [];
        this.cameraController = new CameraController();
        this.firstCollisionDone = false;
        this.firstCollisionTime = 0;
        const diagramURLs = [
            `http://localhost:5000/api/57c4f394a70e4a1fbe75b1bc67d70367`,
            `https://vahakangasma.azurewebsites.net/api/89d89c3a89d24dd5966ca096c34d80b9`,
            `https://vahakangasma.azurewebsites.net/api/050a6ca3d06e4698b1b3f9b6f7af259e`
        ];
        this.iter = 0;
        const diagramLoadPromises = [];
        diagramURLs.forEach((diagramURL) => diagramLoadPromises.push(loadJSON(diagramURL)));
        document.addEventListener("Collision", (event) => {
            // console.log("collision event heard", (event as CustomEvent).detail);
            if (!this.firstCollisionDone) {
                // if (this.iter%2 == 1)
                //     physicsLoop.setSpeed(0.01);
                this.firstCollisionDone = true;
                this.firstCollisionTime = performance.now() / 1000;
            }
        });
        Promise.all(diagramLoadPromises).then((results) => {
            this.diagrams = results;
            console.log("ShotAnimator loading done", results[1]);
            this.table.load(this.diagrams[this.iter % this.diagrams.length]);
            for (let k = 0; k < 16; k++)
                this.table.balls[k].v.multiplyScalar(10);
            this.animate();
        });
    }
    animate() {
        // physicsLoop.setSpeed((physicsLoop.speed+0.001)/1.001);
        if (!this.firstCollisionDone)
            cameraPose.p.copy(this.table.balls[0].p);
        poseCamera();
        physicsLoop.setSpeed(0.2);
        physicsLoop.simulate(30 / 1000);
        renderer.render(tableScene.scene, camera);
        requestAnimationFrame(this.animate);
        if ((this.table.energy() < 1.0e-9) || ((this.firstCollisionDone) && (performance.now() / 1000 - this.firstCollisionTime > 12))) {
            this.iter++;
            this.table.load(this.diagrams[this.iter % this.diagrams.length]);
            this.firstCollisionDone = false;
            for (let k = 0; k < 16; k++)
                this.table.balls[k].v.multiplyScalar([10, 8, 3][this.iter % this.diagrams.length]);
        }
        cameraPose.theta += 0.0003;
    }
}
