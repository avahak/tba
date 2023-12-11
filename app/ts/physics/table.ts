export { Table };
import { Ball } from "./ball.js";
import { TableScene } from "../tableScene.js";
import { closestPoint, clamp } from "../util.js";
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
        const box = this.tableScene.jsonAll.railbox;
        let cp = new THREE.Vector2(clamp(p.x, -box[0], box[0]), clamp(p.y, -box[1], box[1]));
        for (let k = 1; k <= 6; k++) {
            const center = this.tableScene.jsonAll[`pocket_fall_center_${k}`];
            const pocketCenter = new THREE.Vector2(center[0], center[1]);
            const pocketRadius = this.tableScene.jsonAll[`pocket_fall_radius_${k}`];
            if (cp.distanceTo(pocketCenter) < pocketRadius) {
                // cp = pocketCenter + (cp-pocketCenter).normalize()*pocketRadius

            }
        }

        return new THREE.Vector3(cp.x, cp.y, 0);
    }

    public getClosestCushionPoint(p: THREE.Vector3): THREE.Vector3 {
		const cushionsPos = this.tableScene.objects.cushions.children[0].geometry.attributes.position;
		const closestCushion: [string, THREE.Vector3 | null, number] = ["cushion", null, Infinity];
		for (let k = 0; k < cushionsPos.count/3; k++) {
			const cp = closestPoint(p, 
				new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k), 
				new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k+1),
				new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k+2));
			const dist = p.distanceTo(cp);
			if (dist < closestCushion[2]) {
				closestCushion[1] = cp;
				closestCushion[2] = dist;
			}
		}
        return closestCushion[1] as THREE.Vector3;
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