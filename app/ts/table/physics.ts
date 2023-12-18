export { initPhysics, physicsLoop, reset, changeSpeed };
import { Ball } from "./ball.js";
import { Table } from "./table.js";
import { TableScene } from "./tableScene.js";
import { Collision } from "./collision.js";
import * as THREE from 'three';

console.log("physics.ts");

let table: Table;
let lastTime: number | null = null;
let speed: number = 1;
let stopped: boolean = false;

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

function initPhysics(t: Table) {
    table = t;
    reset();
}

function changeSpeed(value: number) {
    const maxValue = 8;
    if (value == -maxValue)
        speed = 0;
    else
        speed = Math.exp(6*value/maxValue);
}

function reset() {
    table.resetBalls();
    const r = table.balls[0].r;
    // table.balls[0].p.set(-0.2, 0, 0.2);
    table.balls[0].p.x = -0.2;
    table.balls[0].p.y = -0.1;
    table.balls[0].v = new THREE.Vector3(5, 1, 1);
    table.balls[0].w.set(0, -200, 40);

    table.balls[1].p.set(0, 0, r);
    table.balls[2].p.set(0, 2*r, r);
    table.balls[3].p.set(0, -2*r, r);
    table.balls[4].p.set(2*r, 0, r);
    table.balls[5].p.set(4*r, 2*r, r);
}

function physicsLoop() {
    if (stopped)
        return;
    const time = performance.now()/1000;
    let dt = 0;
    if (!!lastTime)
        dt = speed*(time-lastTime);
    if (dt > 0.2)
        dt = 0.2;
    lastTime = time;

    // console.log("ball_0", {"p.z": table.balls[0].p.z, "v.z": table.balls[0].v.z});
    let iterNum = Math.max(Math.floor(dt/0.0001), 1);
    for (let iter = 0; iter < iterNum; iter++) {
        for (let k = 0; k < 16; k++)
            table.balls[k].advanceTime(dt/iterNum);

        if (Collision.detectCollision(table) !== null) {
            const collision = Collision.fromTable(table);
            collision?.resolve();
        }
    }

    // Stop out of bounds balls:
    for (let k = 0; k < 16; k++) {
        if (table.balls[k].outOfBounds()) {
            table.balls[k].reset();
            table.balls[k].stop();
        }
    }

    for (let k = 0; k < 16; k++) 
        table.balls[k].updatePositionToScene();
}