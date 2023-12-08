export { initPhysics, fn, reset, changeSpeed }
import { Ball } from "./ball.js";
import { TableScene } from "../tableScene.js";
import * as THREE from 'three';

console.log("physics.ts");

let tableScene: TableScene;
let balls: Ball[] = [];
let lastTime: number | null = null;
let speed: number = 1;

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

function initPhysics(ts: TableScene) {
    tableScene = ts;
    for (let k = 0; k < 16; k++) {
        const name = `ball_${k}`;
        const obj = tableScene.objects[name];
        const ball = new Ball(obj.position.clone(), obj, name);
        balls.push(ball);
    }
    reset();
}

function changeSpeed(value: number) {
    speed = Math.exp(4*value/5);
}

function reset() {
    for (let k = 0; k < 16; k++) {
        balls[k].p = tableScene.defaultBallPosition(k).clone();
        balls[k].v.set(0, 0, 0);
        balls[k].a.set(0, 0, 0);
        balls[k].q.setFromAxisAngle(E2, -Math.PI/2);
        balls[k].w.set(0, 0, 0);
        balls[k].dw.set(0, 0, 0);
    }
    balls[0].p.x = -1;
    balls[0].p.y = 0;
    balls[0].v = new THREE.Vector3(0.8, 0, 0);
    balls[0].w.set(0, 0, 0);
}

function fn() {
    const time = performance.now()/1000;
    let dt = 0;
    if (!!lastTime)
        dt = speed*(time-lastTime);
    lastTime = time;

    for (let k = 0; k < 16; k++)
        balls[k].advanceTime(dt);

    for (let k = 0; k < 16; k++) {
        balls[k].obj.position.copy(balls[k].p);
        balls[k].obj.quaternion.copy(balls[k].q);
    }
}