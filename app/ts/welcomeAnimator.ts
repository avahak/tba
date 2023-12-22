/**
 * Animation for the welcome page.
 */

console.log("welcomeAnimate.ts");

export {};
import { TableScene } from "./table/tableScene.js";
import { Table } from "./table/table.js";
import { clamp, loadJSON, weightedMean } from "./util.js";
import { PhysicsLoop } from "./table/physics.js";
import { Collision } from "./table/collision.js";
import * as THREE from 'three';

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

const BACKGROUND = new THREE.Vector3(0.05, 0.10, 0.15);

let tableScene: TableScene;
let renderer: THREE.WebGLRenderer;
let element: HTMLElement;
let physicsLoop: PhysicsLoop;
let shotAnimator: ShotAnimator;

init();

function init() {
    setFade(0);
    tableScene = new TableScene();
    tableScene.scene.background = new THREE.Color().setRGB(BACKGROUND.x, BACKGROUND.y, BACKGROUND.z, THREE.SRGBColorSpace);

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
        shotAnimator = new ShotAnimator(table);
        tableScene.setLights("square");
        // Dim the lights a bit:
        tableScene.lightGroup.traverse((child) => {
            if (child instanceof THREE.Light) 
                child.intensity = child.intensity*0.2;
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

        makeFeaturesButtons()
    });
}

function setFade(value: number) {
    value = clamp(value, 0, 1);
    const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
    canvas.style.backgroundColor = `rgba(${BACKGROUND.x*255}, ${BACKGROUND.y*255}, ${BACKGROUND.z*255}, ${1-value})`;
}

function makeFeaturesButtons() {
    console.log("makeFeaturesButtons");
    document.querySelectorAll(".div-feature").forEach((element) => {
        const url = (element as HTMLElement).dataset.url;
        if (!!url)
            element.addEventListener("click", (event) => { window.location.href = url });
    });
}

function handleMouseMove(event: MouseEvent) {
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
        shotAnimator.sceneController.moveCamera(event.movementX, event.movementY);
    }
}

function resize() {
    const aspect = element.offsetWidth / element.offsetHeight;
    shotAnimator.sceneController.camera.aspect = aspect;
    shotAnimator.sceneController.camera.updateProjectionMatrix();
    renderer.setSize(element.offsetWidth, element.offsetHeight);
}

class CameraPose {
    public p: THREE.Vector3;       // near or on slate plane, camera looks at this
    public r: number;
    public theta: number;
    public phi: number;

    public static cameraPoseBack = new CameraPose(new THREE.Vector3(0, 0, -0.45), 2.5, -Math.PI, 0.6);
    public static cameraPoseFront = new CameraPose(new THREE.Vector3(0, 0, -0.45), 2.5, Math.PI, 0.6);
    public static cameraPoseOverhead = new CameraPose(new THREE.Vector3(0.0, 0.0, -0.45), 3, -Math.PI/2, 1.57);
    public static cameraPosePocket3 = new CameraPose(new THREE.Vector3(0.7, 0, -0.2), 1.5, -0.8, 0.5);

    public constructor(p: THREE.Vector3, r: number, theta: number, phi: number) {
        this.p = p;
        this.r = r;
        this.theta = theta;
        this.phi = phi;
    }

    public clone(): CameraPose {
        return new CameraPose(this.p.clone(), this.r, this.theta, this.phi);
    }

    public poseCamera(camera: THREE.Camera): void {
        const dir = new THREE.Vector3(
            this.r*Math.cos(this.phi)*Math.cos(this.theta),
            this.r*Math.cos(this.phi)*Math.sin(this.theta),  
            this.r*Math.sin(this.phi));
        camera.position.copy(this.p.clone().add(dir));
        camera.lookAt(this.p);
    }

    public static interpolate(pose1: CameraPose, pose2: CameraPose, t: number) {
        t = clamp(t, 0, 1);
        return new CameraPose(weightedMean([pose1.p, pose2.p], [t, 1-t])!, t*pose2.r+(1-t)*pose1.r, t*pose2.theta+(1-t)*pose1.theta, t*pose2.phi+(1-t)*pose1.phi)
    }
}

class SceneController {
    public table: Table;
    public firstCollisionDone: boolean;
    public firstCollisionTime: number;
    public startTime: number = 0;
    public endTime: number = 0;
    public userInputTime: number; 

    public camera: THREE.PerspectiveCamera;
    public cameraPose: CameraPose;
    public cameraPoseFollow: CameraPose;        // follows ball_0

    public constructor(table: Table) {
        this.table = table;
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        this.camera.up = E3;
        this.firstCollisionDone = false;
        this.firstCollisionTime = 0;
        this.userInputTime = 0;
        this.cameraPose = new CameraPose(new THREE.Vector3(0,0,-0.2), 1, -Math.PI/2, 0.85);
        this.cameraPoseFollow = new CameraPose(new THREE.Vector3(0,0,-0.2), 1, -Math.PI, 0.6);
        this.reset();

        document.addEventListener("Collision", (event) => {
            // console.log("collision event heard", (event as CustomEvent).detail);
            if (!this.firstCollisionDone) {
                // if (this.iter%2 == 1)
                //     physicsLoop.setSpeed(0.01);
                this.firstCollisionDone = true;
                this.firstCollisionTime = performance.now()/1000;
                this.endTime = Math.min(performance.now()/1000 + 5, this.endTime);
            }
        });
    }

    public moveCamera(movementX: number, movementY: number) {
        this.userInputTime = performance.now()/1000;
        this.cameraPose.phi = clamp(this.cameraPose.phi + 0.005*movementY, 0.1, Math.PI/2-0.02);
        this.cameraPose.theta = this.cameraPose.theta - 0.005*movementX;
    }

    /**
     * @returns true if it is time to load next shot.
     */
    public animateLoop() {
        if (!this.firstCollisionDone)
            this.cameraPoseFollow.p.copy(this.table.balls[0].p);
        const time = performance.now()/1000;
        // this.cameraPose.theta += 0.0003;
        this.controlFade();
        // this.poseCamera(this.cameraPoseBack);
        if (time > this.userInputTime+3)
            this.cameraPose = CameraPose.interpolate(CameraPose.cameraPoseBack, CameraPose.cameraPoseOverhead, Math.random());
        this.cameraPose = CameraPose.cameraPosePocket3;
        this.cameraPose.poseCamera(this.camera);
        // if (this.firstCollisionDone)
        //     this.poseCamera(this.cameraPose);
        // else 
        //     this.poseCamera(this.cameraPoseBack);

        if ((this.table.energy() < 1.0e-9) || (time > this.endTime)) {
            this.reset();
            return true;
        }
        return false;
    }

    public controlFade() {
        const time = performance.now()/1000;
        const transitionTime = 1;
        let fade = 1;
        if (time-this.startTime < transitionTime) {
            // fade up
            fade = Math.pow(clamp((time-this.startTime)/transitionTime, 0, 1), 3);
        }
        if (this.endTime-time < transitionTime) {
            // fade down
            fade = Math.pow(clamp((this.endTime-time)/transitionTime, 0, 1), 3);
        }
        setFade(fade);
    }

    public reset() {
        this.firstCollisionDone = false;
        this.startTime = performance.now()/1000;
        this.endTime = this.startTime + 10;
        this.cameraPose = CameraPose.cameraPoseOverhead.clone();
    }
}

class ShotAnimator {
    public table: Table;
    public diagrams: any[];
    public sceneController: SceneController;
    public iter: number;

    public constructor(table: Table) {
        this.animate = this.animate.bind(this);
        this.table = table;
        this.diagrams = [];
        this.sceneController = new SceneController(table);
        this.iter = 0;
        const diagramURLs = [
            `http://localhost:5000/api/57c4f394a70e4a1fbe75b1bc67d70367`,
            `https://vahakangasma.azurewebsites.net/api/89d89c3a89d24dd5966ca096c34d80b9`,
            `https://vahakangasma.azurewebsites.net/api/050a6ca3d06e4698b1b3f9b6f7af259e`
        ];
        const diagramLoadPromises: Promise<any>[] = [];
        diagramURLs.forEach((diagramURL) => diagramLoadPromises.push(loadJSON(diagramURL)));
        Promise.all(diagramLoadPromises).then((results) => {
            this.animate();
            this.diagrams = results;
            console.log("ShotAnimator loading done", results[1]);
            this.loadNext();
        });
    }

    public animate() {
        // physicsLoop.setSpeed((physicsLoop.speed+0.001)/1.001);
        const loadNextNeeded = this.sceneController.animateLoop();
        physicsLoop.setSpeed(0.1);
        physicsLoop.simulate(30/1000);
        renderer.render(tableScene.scene, this.sceneController.camera);
        requestAnimationFrame(this.animate);
        if (loadNextNeeded)
            this.loadNext();
    }

    public loadNext() {
        this.table.load(this.diagrams[this.iter%this.diagrams.length]);
        for (let k = 0; k < 16; k++)
            this.table.balls[k].v.multiplyScalar([10, 8, 3][this.iter%this.diagrams.length]);
        if (this.iter == 1) {
            this.table.balls[0].w.y = -20;
            this.table.balls[0].w.z = 20;
        }
        this.iter++;
    }
}