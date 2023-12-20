/**
 * Animation for the welcome page.
 */

console.log("welcomeAnimate.ts");

export {};
import { TableScene } from "./table/tableScene.js";
import { Table } from "./table/table.js";
import { clamp, loadJSON } from "./util.js";
import { PhysicsLoop } from "./table/physics.js";
import { Collision } from "./table/collision.js";
import * as THREE from 'three';

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

type CameraPose = {
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
let physicsLoop: PhysicsLoop;
let shotAnimator: ShotAnimator;

init();

function init() {
    tableScene = new TableScene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.up = E3;
    cameraPose = { p: new THREE.Vector3(0,0,-0.2), r: 1, theta: -Math.PI/2, phi: 0.85 }

    element = document.getElementById("three-box") as HTMLElement;

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
        // element.addEventListener('wheel', (event) => handleMouseWheel(event), {passive: false});

        window.addEventListener('resize', () => {
            resize();
        });
        resize();

        shotAnimator = new ShotAnimator(table);
    });
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

function resize() {
    const aspect = element.offsetWidth / element.offsetHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(element.offsetWidth, element.offsetHeight);
}

function poseCamera() {
    const dir = new THREE.Vector3(
        cameraPose.r*Math.cos(cameraPose.phi)*Math.cos(cameraPose.theta),
        cameraPose.r*Math.cos(cameraPose.phi)*Math.sin(cameraPose.theta),  
        cameraPose.r*Math.sin(cameraPose.phi));
    camera.position.copy(cameraPose.p.clone().add(dir));
    camera.lookAt(cameraPose.p);
}

class CameraController {
    public constructor() {
    }
}

class ShotAnimator {
    public table: Table;
    public diagrams: any[];
    public cameraController: CameraController;
    public firstCollisionDone: boolean;
    public iter: number;

    public constructor(table: Table) {
        this.animate = this.animate.bind(this);
        this.table = table;
        this.diagrams = [];
        this.cameraController = new CameraController();
        this.firstCollisionDone = false;
        const diagramURLs = [
            `http://localhost:5000/api/57c4f394a70e4a1fbe75b1bc67d70367`,
            `https://vahakangasma.azurewebsites.net/api/89d89c3a89d24dd5966ca096c34d80b9`,
            `https://vahakangasma.azurewebsites.net/api/050a6ca3d06e4698b1b3f9b6f7af259e`
        ];
        this.iter = 0;
        const diagramLoadPromises: Promise<any>[] = [];
        diagramURLs.forEach((diagramURL) => diagramLoadPromises.push(loadJSON(diagramURL)));
        Promise.all(diagramLoadPromises).then((results) => {
            this.diagrams = results;
            console.log("ShotAnimator loading done", results[1]);
            this.table.load(this.diagrams[this.iter%this.diagrams.length]);
            this.animate();
        });
        document.addEventListener("Collision", (event) => {
            // console.log("collision event heard", (event as CustomEvent).detail);
            if (!this.firstCollisionDone) {
                if (this.iter%2 == 1)
                    physicsLoop.setSpeed(0.01);
                this.firstCollisionDone = true;
            }
        });
    }

    public animate() {
        physicsLoop.setSpeed((physicsLoop.speed+0.001)/1.001);
        physicsLoop.simulate(30/1000);
        cameraPose.p.copy(this.table.balls[0].p);
        poseCamera();
        renderer.render(tableScene.scene, camera);
        requestAnimationFrame(this.animate);
        if (this.table.energy() < 1.0e-9) {
            this.iter++;
            this.table.load(this.diagrams[this.iter%this.diagrams.length]);
            this.firstCollisionDone = false;
        }
        cameraPose.theta += 0.0005;
    }
}