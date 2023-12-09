export { Table };
import { Ball } from "./ball.js";
import { TableScene } from "../tableScene.js";
import * as THREE from 'three';

console.log("table.ts");

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

class Table {
    public balls: Ball[];
    public tableScene: TableScene;

    public constructor(tableScene: TableScene) {
        this.tableScene = tableScene;
        this.balls = [];
        for (let k = 0; k < 16; k++) {
            const name = `ball_${k}`;
            const obj = tableScene.objects[name];
            const ball = new Ball(obj.position.clone(), obj, name);
            this.balls.push(ball);
        }
        console.log(this.tableScene.jsonAll);
    }

    public getClosestSlatePoint(p: THREE.Vector3): THREE.Vector3 {
        return new THREE.Vector3();
    }

    public getClosestCushionPoint(p: THREE.Vector3): THREE.Vector3 {
        return new THREE.Vector3();
    }

    public resetBalls() {
        this.balls.forEach((ball) => {
            ball.p = this.tableScene.defaultBallPosition(ball.name).clone();
            ball.v.set(0, 0, 0);
            ball.a.set(0, 0, 0);
            ball.q.setFromAxisAngle(E2, -Math.PI/2);
            ball.w.set(0, 0, 0);
            ball.dw.set(0, 0, 0);
        });
    }
}