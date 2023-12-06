/**
 * Testing physics.
 */

export {};

import { TableScene } from "./tableScene.js";
import { loadJSON, clamp } from "./util.js";
import * as THREE from 'three';

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

interface CameraPose {
    p: THREE.Vector3;       // near or on slate plane, camera looks at this
    r: number;
    theta: number;
    phi: number;
}

let tableScene: TableScene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let element: HTMLElement;
let cameraPose: CameraPose;

init();

function init() {
    tableScene = new TableScene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.up = E3;
    cameraPose = { p: new THREE.Vector3(), r: 2.55, theta: -Math.PI/2, phi: Math.PI/2-0.02 }

    element = document.getElementById("three-box") as HTMLElement;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio * 1.5);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);
    element.appendChild(renderer.domElement);

    document.addEventListener('tableSceneLoaded', () => {
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
        element.addEventListener('wheel', (event) => handleMouseWheel(event), {passive: false});

        window.addEventListener('resize', () => {
            resize();
        });
        resize();

        animate();
    });
}

function handleMouseWheel(event: WheelEvent) {
    event.preventDefault();
    cameraPose.r *= Math.exp(0.002*event.deltaY);
}

function handleMouseMove(event: MouseEvent) {
    if (event.buttons & 4) {
        // Left mouse button:
        const dir = new THREE.Vector3(cameraPose.r*Math.cos(cameraPose.phi)*Math.cos(cameraPose.theta), cameraPose.r*Math.cos(cameraPose.phi)*Math.sin(cameraPose.theta), 0).normalize();
        const dir2 = dir.clone().cross(E3).normalize();
        cameraPose.p.add(dir.multiplyScalar(-0.001*event.movementY*cameraPose.r));
        cameraPose.p.add(dir2.multiplyScalar(0.001*event.movementX*cameraPose.r));
    }
    if (event.buttons & 2) {
        // Right mouse button:
        cameraPose.phi = clamp(cameraPose.phi + 0.005*event.movementY, 0.1, Math.PI/2-0.02);
        cameraPose.theta = cameraPose.theta - 0.005*event.movementX;
    }
}

function poseCamera() {
    const dir = new THREE.Vector3(
        cameraPose.r*Math.cos(cameraPose.phi)*Math.cos(cameraPose.theta),
        cameraPose.r*Math.cos(cameraPose.phi)*Math.sin(cameraPose.theta),  
        cameraPose.r*Math.sin(cameraPose.phi));
    camera.position.copy(cameraPose.p.clone().add(dir));
    camera.lookAt(cameraPose.p);
}

function animate() {
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