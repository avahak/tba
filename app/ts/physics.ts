export { initPhysics, fn }
import { TableScene } from "./tableScene.js";
import * as THREE from 'three';

console.log("physics.ts");

let tableScene: TableScene;

function initPhysics(ts: TableScene) {
    tableScene = ts;
    const ball0 = tableScene.objects[`ball_0`];
    ball0.position.x = 0.0;
    ball0.position.y = 0.0;
}

function fn() {
    const time = performance.now()/1000;

    const ball0 = tableScene.objects[`ball_0`];
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2*time);
    ball0.quaternion.copy(q);
}