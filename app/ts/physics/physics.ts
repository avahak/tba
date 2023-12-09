export { initPhysics, physicsLoop, reset, changeSpeed }
import { Ball } from "./ball.js";
import { Table } from "./table.js";
import { TableScene } from "../tableScene.js";
import * as THREE from 'three';

console.log("physics.ts");

let table: Table;
let lastTime: number | null = null;
let speed: number = 1;

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

function initPhysics(t: Table) {
    table = t;
    reset();
}

function changeSpeed(value: number) {
    speed = Math.exp(4*value/5);
}

function reset() {
    table.resetBalls();
    table.balls[0].p.x = -1;
    table.balls[0].p.y = 0;
    table.balls[0].v = new THREE.Vector3(1, 0, 0);
    table.balls[0].w.set(0, -20, 40);
}

function physicsLoop() {
    const time = performance.now()/1000;
    let dt = 0;
    if (!!lastTime)
        dt = speed*(time-lastTime);
    lastTime = time;

    for (let k = 0; k < 16; k++)
        table.balls[k].advanceTime(dt);

    for (let k = 0; k < 16; k++) {
        table.balls[k].obj.position.copy(table.balls[k].p);
        table.balls[k].obj.quaternion.copy(table.balls[k].q);
    }
}