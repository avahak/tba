/**
 * Animation for the welcome page.
 */
console.log("welcomeAnimate.ts");
import { TableScene } from "./table/tableScene.js";
import { Table } from "./table/table.js";
import { clamp, loadJSON, weightedMean } from "./util.js";
import { PhysicsLoop } from "./table/physics.js";
import * as THREE from 'three';
const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);
const BACKGROUND = new THREE.Vector3(0.05, 0.10, 0.15);
let tableScene;
let renderer;
let element;
let physicsLoop;
let shotAnimator;
init();
function init() {
    setFade(0);
    tableScene = new TableScene();
    tableScene.scene.background = new THREE.Color().setRGB(BACKGROUND.x, BACKGROUND.y, BACKGROUND.z, THREE.SRGBColorSpace);
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
        shotAnimator = new ShotAnimator(table);
        tableScene.setLights("square");
        // Dim the lights a bit:
        tableScene.lightGroup.traverse((child) => {
            if (child instanceof THREE.Light)
                child.intensity = child.intensity * 0.2;
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
    });
}
function setFade(value) {
    value = clamp(value, 0, 1);
    const canvas = document.getElementById("overlay-canvas");
    canvas.style.backgroundColor = `rgba(${BACKGROUND.x * 255}, ${BACKGROUND.y * 255}, ${BACKGROUND.z * 255}, ${1 - value})`;
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
    constructor(p, r, theta, phi) {
        this.p = p;
        this.r = r;
        this.theta = theta;
        this.phi = phi;
    }
    clone() {
        return new CameraPose(this.p.clone(), this.r, this.theta, this.phi);
    }
    poseCamera(camera) {
        const dir = new THREE.Vector3(this.r * Math.cos(this.phi) * Math.cos(this.theta), this.r * Math.cos(this.phi) * Math.sin(this.theta), this.r * Math.sin(this.phi));
        camera.position.copy(this.p.clone().add(dir));
        camera.lookAt(this.p);
    }
    static interpolate(pose1, pose2, t) {
        t = clamp(0.5 - 0.5 * Math.cos(t * Math.PI), 0, 1);
        // To interpolate between pose1.theta and pose2.theta we should work modulo 2*PI:
        const theta1 = pose1.theta;
        const dTheta = ((pose2.theta - pose1.theta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        const theta = theta1 + t * dTheta;
        return new CameraPose(weightedMean([pose1.p, pose2.p], [1 - t, t]), t * pose2.r + (1 - t) * pose1.r, theta, t * pose2.phi + (1 - t) * pose1.phi);
    }
}
CameraPose.cameraPoseBack = new CameraPose(new THREE.Vector3(0, 0, -0.45), 2.5, -Math.PI, 0.6);
CameraPose.cameraPoseFront = new CameraPose(new THREE.Vector3(0, 0, -0.45), 2.5, 0, 0.6);
CameraPose.cameraPoseOverhead = new CameraPose(new THREE.Vector3(0.0, 0.0, -0.45), 3, -Math.PI / 2, 1.57);
CameraPose.cameraPosePocket3 = new CameraPose(new THREE.Vector3(0.7, 0, -0.2), 1.5, -0.8, 0.5);
class SceneController {
    constructor(table) {
        this.startTime = 0;
        this.endTime = 0;
        this.table = table;
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        this.camera.up = E3;
        this.firstCollisionDone = false;
        this.firstCollisionTime = 0;
        this.isUserInputPose = false;
        this.lastPoseChange = performance.now() / 1000;
        this.currentPoseNumber = 0;
        this.cameraPoseFollow = new CameraPose(new THREE.Vector3(0, 0, -0.2), 1, -Math.PI, 0.6);
        this.reset();
        this.cameraPose = CameraPose.cameraPoseOverhead.clone();
        this.cameraPoseLast = this.cameraPose.clone();
        document.addEventListener("Collision", (event) => {
            // console.log("collision event heard", (event as CustomEvent).detail);
            if (!this.firstCollisionDone) {
                this.firstCollisionDone = true;
                this.firstCollisionTime = performance.now() / 1000;
                this.endTime = Math.min(performance.now() / 1000 + SceneController.SHOT_MAX_DURATION_AFTER_COLLISION, this.endTime);
            }
        });
    }
    poseState() {
        const time = performance.now() / 1000;
        if (time - this.lastPoseChange < SceneController.POSE_TRANSITION)
            return "transition";
        if (time - this.lastPoseChange < SceneController.POSE_DURATION)
            return "constant";
        return "expired";
    }
    moveCamera(movementX, movementY) {
        const time = performance.now() / 1000;
        this.isUserInputPose = true;
        // if (this.poseState() == "constant") {
        this.cameraPose = this.cameraPose.clone();
        this.cameraPose.phi = clamp(this.cameraPose.phi + 0.005 * movementY, 0.1, Math.PI / 2 - 0.02);
        this.cameraPose.theta = this.cameraPose.theta - 0.005 * movementX;
        this.lastPoseChange = time - SceneController.POSE_TRANSITION;
        // }
    }
    /**
     * @returns true if it is time to load next shot.
     */
    animateLoop() {
        if (!this.firstCollisionDone)
            this.cameraPoseFollow.p.copy(this.table.balls[0].p);
        const time = performance.now() / 1000;
        // this.cameraPose.theta += 0.0003;
        this.controlFade();
        // Interpolate between poses on a timer:
        const poses = [CameraPose.cameraPoseOverhead, this.cameraPoseFollow, CameraPose.cameraPoseFront, CameraPose.cameraPosePocket3, this.cameraPoseFollow, CameraPose.cameraPoseBack];
        const state = this.poseState();
        if (state == "transition") {
            const t = clamp((time - this.lastPoseChange) / SceneController.POSE_TRANSITION, 0, 1);
            this.cameraPose = CameraPose.interpolate(this.cameraPoseLast, poses[this.currentPoseNumber], t);
            this.isUserInputPose = false;
        }
        if ((state == "constant") && (!this.isUserInputPose))
            this.cameraPose = poses[this.currentPoseNumber];
        if (state == "expired") {
            this.cameraPoseLast = this.cameraPose;
            this.currentPoseNumber = (this.currentPoseNumber + 1) % poses.length;
            this.lastPoseChange = time;
        }
        this.cameraPose.poseCamera(this.camera);
        if ((this.table.energy() < 1.0e-9) || (time > this.endTime)) {
            this.reset();
            return true;
        }
        return false;
    }
    controlFade() {
        const time = performance.now() / 1000;
        let fade = 1;
        if (time - this.startTime < SceneController.FADE_TRANSITION) {
            // fade up
            fade = Math.pow(clamp((time - this.startTime) / SceneController.FADE_TRANSITION, 0, 1), 3);
        }
        if (this.endTime - time < SceneController.FADE_TRANSITION) {
            // fade down
            fade = Math.pow(clamp((this.endTime - time) / SceneController.FADE_TRANSITION, 0, 1), 3);
        }
        setFade(fade);
    }
    reset() {
        this.firstCollisionDone = false;
        this.startTime = performance.now() / 1000;
        this.endTime = this.startTime + SceneController.SHOT_MAX_DURATION;
    }
}
SceneController.SHOT_MAX_DURATION_AFTER_COLLISION = 10;
SceneController.SHOT_MAX_DURATION = 15;
SceneController.FADE_TRANSITION = 0.5;
SceneController.POSE_TRANSITION = 4;
SceneController.POSE_DURATION = 4 + 5; // Has to be > POSE_TRANSITION
class ShotAnimator {
    constructor(table) {
        this.animate = this.animate.bind(this);
        this.table = table;
        this.diagrams = [];
        this.sceneController = new SceneController(table);
        this.iter = 0;
        const diagramURLs = [
            `https://vahakangasma.azurewebsites.net/api/050a6ca3d06e4698b1b3f9b6f7af259e`,
            `https://vahakangasma.azurewebsites.net/api/4979da7dcb3e4517b92a3f6a5bb8346d`,
            `https://vahakangasma.azurewebsites.net/api/b4b4a5344a924a48aae151817d7d4cdb`,
            `https://vahakangasma.azurewebsites.net/api/89d89c3a89d24dd5966ca096c34d80b9`,
        ];
        const diagramLoadPromises = [];
        diagramURLs.forEach((diagramURL) => diagramLoadPromises.push(loadJSON(diagramURL)));
        Promise.all(diagramLoadPromises).then((results) => {
            this.animate();
            this.diagrams = results;
            this.loadNext();
        });
    }
    animate() {
        physicsLoop.setSpeed(0.1);
        physicsLoop.simulate(30 / 1000);
        const loadNextNeeded = this.sceneController.animateLoop();
        renderer.render(tableScene.scene, this.sceneController.camera);
        requestAnimationFrame(this.animate);
        if (loadNextNeeded)
            this.loadNext();
    }
    loadNext() {
        this.table.load(this.diagrams[this.iter % this.diagrams.length]);
        // TODO get rid of these:
        for (let k = 0; k < 16; k++)
            this.table.balls[k].v.multiplyScalar([3, 8, 4, 8][this.iter % this.diagrams.length]);
        if (this.iter % this.diagrams.length == 1) {
            const v = this.table.balls[0].v;
            this.table.balls[0].w.copy(new THREE.Vector3(v.y, -v.x, 0).multiplyScalar(10));
        }
        if (this.iter % this.diagrams.length == 3) {
            this.table.balls[0].w.y = -20;
            this.table.balls[0].w.z = 20;
        }
        if (this.iter % this.diagrams.length == 2) {
            this.table.balls[0].v.z = 0.4 * this.table.balls[0].v.length();
            const v = this.table.balls[0].v;
            this.table.balls[0].w.copy(new THREE.Vector3(v.y, -v.x, 0).multiplyScalar(10));
        }
        this.iter++;
    }
}
