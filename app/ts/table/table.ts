export { Table };
import { Ball } from "./ball.js";
import { TableScene } from "./tableScene.js";
import { closestPoint, clamp } from "../util.js";
import * as THREE from 'three';

console.log("table.ts");

const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

class Table {
    public balls: Ball[];

    public static tableJson: any;
    public static pocketCenters: THREE.Vector2[];
    public static pocketRadii: number[];
    public static cushionVertices: THREE.Vector3[];

    public constructor(tableScene: TableScene | null, tableJson: any) {
        this.balls = [];
        for (let k = 0; k < 16; k++) {
            const name = `ball_${k}`;
            const obj = (!!tableScene) ? tableScene.objects[name] : null;
            const ball = new Ball(obj, name, this);
            this.balls.push(ball);
        }

        // Initialize pockets:
        Table.tableJson = tableJson;
        Table.pocketCenters = []
        Table.pocketRadii = []
        for (let k = 1; k <= 6; k++) {
            const center = Table.tableJson[`pocket_fall_center_${k}`];
            Table.pocketCenters.push(new THREE.Vector2(center[0], center[1]));
            Table.pocketRadii.push(Table.tableJson[`pocket_fall_radius_${k}`]);
        }

        if (!!tableScene)
            Table.assignCushionVertices(Table.extractCushionVertices(tableScene));
    }

    public static assignCushionVertices(cushionVertices: any) {
        Table.cushionVertices = cushionVertices;
    }

    public static extractCushionVertices(tableScene: TableScene) {
        Table.cushionVertices = [];
        const cushionsPos = (tableScene.objects.cushions.children[0] as THREE.Mesh).geometry.attributes.position;
        for (let k = 0; k < cushionsPos.count/3; k++) {
            Table.cushionVertices.push(new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k));
            Table.cushionVertices.push(new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k+1));
            Table.cushionVertices.push(new THREE.Vector3().fromBufferAttribute(cushionsPos, 3*k+2));
        }
        return Table.cushionVertices; 
    }

    /**
     * Finds closest point on the slate to p. Nontrivial because of the geometry.
     */
    public getClosestSlatePoint(p: THREE.Vector3): THREE.Vector3 {
        const p2 = new THREE.Vector2(p.x, p.y);
        const box = Table.tableJson.railbox;
        // 1) Clamp cp to box:
        let cp = new THREE.Vector2(clamp(p.x, -box[0], box[0]), clamp(p.y, -box[1], box[1]));
        // 2) If cp is inside pocket circles, project it to the circle:
        for (let k = 0; k < 6; k++) {
            const center = Table.pocketCenters[k];
            const radius = Table.pocketRadii[k];
            if (cp.distanceTo(center) < radius) 
                cp.copy(center.clone().add(cp.clone().sub(center).setLength(radius)));
        }
        // 3) If point is inside box, return it:
        if ((Math.abs(cp.x) <= box[0]) && (Math.abs(cp.y) <= box[1]))
            return new THREE.Vector3(cp.x, cp.y, 0);

        // 4) if point outside box, return closest point from pocket_fall_corners
        const corners = Table.tableJson[`pocket_fall_corners`];
        const closest: [number, THREE.Vector2 | null] = [Infinity, null];
        for (let k = 0; k < 12; k++) {
            const corner = new THREE.Vector2(corners[k][0], corners[k][1]);
            const dist = p2.distanceTo(corner);
            if (dist < closest[0]) {
                closest[0] = dist;
                closest[1] = corner;
            }
        }
        return new THREE.Vector3(closest[1]!.x, closest[1]!.y, 0);
    }

    public getClosestCushionPoint(p: THREE.Vector3): THREE.Vector3 {
		const closestCushion: [string, THREE.Vector3 | null, number] = ["cushion", null, Infinity];
		for (let k = 0; k < Table.cushionVertices.length/3; k++) {
			const cp = closestPoint(p, 
                Table.cushionVertices[3*k], Table.cushionVertices[3*k+1], Table.cushionVertices[3*k+2]);
			const dist = p.distanceTo(cp);
			if (dist < closestCushion[2]) {
				closestCushion[1] = cp;
				closestCushion[2] = dist;
			}
		}
        return closestCushion[1]!;
    }

    public resetBalls() {
        this.balls.forEach((ball) => ball.reset());
    }

    public load(data: any) {
        for (const objName in data) {
            if (objName.startsWith("ball")) {
                const result = objName.match(/\d+/);
			    const ballNumber = result ? parseInt(result[0]) : 0;
                if (ballNumber in this.balls) {
                    const ball = this.balls[ballNumber];
                    ball.load(data[objName]);
                }
            }
        }
    }

    public ballPositions() {
        const data: {[key: string]: any} = {};
        for (let k = 0; k < 16; k++) 
            data[`ball_${k}`] = { "p": this.balls[k].p, "q": this.balls[k].q };
        return data;
    }

    public defaultBallPosition(ball: number | string | null): THREE.Vector3 {
        let ballNumber = 0;
        if (typeof ball == "string") {
            const result = ball.match(/\d+/);
            ballNumber = result ? parseInt(result[0]) : 0;
        } else if (typeof ball == "number")
            ballNumber = ball;
        return new THREE.Vector3(-1.0+0.1*ballNumber, 0.86, Table.tableJson.specs.BALL_RADIUS);
    }
}