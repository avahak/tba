export { initPhysics, physicsLoop, reset, changeSpeed, testCollision };
import { Collision } from "./collision.js";
import * as THREE from 'three';
console.log("physics.ts");
let table;
let lastTime = null;
let speed = 1;
let stopped = false;
const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);
function initPhysics(t) {
    table = t;
    reset();
}
function changeSpeed(value) {
    const maxValue = 8;
    if (value == -maxValue)
        speed = 0;
    else
        speed = Math.exp(6 * value / maxValue);
}
function testCollision() {
    Collision.fromTable(table);
}
function reset() {
    table.resetBalls();
    // table.balls[0].p.set(-0.2, 0, 0.2);
    table.balls[0].p.x = -0.2;
    table.balls[0].p.y = -0.1;
    table.balls[0].v = new THREE.Vector3(2, 0.2, 0);
    table.balls[0].w.set(0, -20, 40);
    table.balls[1].p.set(0, 0, table.balls[0].r);
    table.balls[2].p.set(0, 2 * table.balls[0].r, table.balls[0].r);
    table.balls[3].p.set(0, -2 * table.balls[0].r, table.balls[0].r);
}
function physicsLoop() {
    if (stopped)
        return;
    const time = performance.now() / 1000;
    let dt = 0;
    if (!!lastTime)
        dt = speed * (time - lastTime);
    lastTime = time;
    for (let k = 0; k < 16; k++)
        table.balls[k].advanceTime(dt);
    for (let k = 0; k < 16; k++) {
        table.balls[k].obj.position.copy(table.balls[k].p);
        table.balls[k].obj.quaternion.copy(table.balls[k].q);
    }
    // console.log("collision?", Collision.detectCollision(table));
    if (Collision.detectCollision(table) !== null) {
        // TODO change if to while (to resolve multiple collisions)!
        const collision = Collision.fromTable(table);
        collision === null || collision === void 0 ? void 0 : collision.resolve();
        // stopped = true;
    }
}
