export { PhysicsLoop };
import * as THREE from 'three';
import { loadJSON } from "../util.js";
console.log("physics.ts");
const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);
class PhysicsLoop {
    constructor(table) {
        this.table = table;
        this.speed = 1;
        this.state = { internalTime: null, action: null };
    }
    reset() {
        this.table.resetBalls();
        const r = this.table.balls[0].r;
        // this.table.balls[0].p.set(-0.2, 0, 0.2);
        this.table.balls[0].p.x = -0.2;
        this.table.balls[0].p.y = -0.1;
        this.table.balls[0].v = new THREE.Vector3(5, 1, 1);
        this.table.balls[0].w.set(0, -200, 40);
        this.table.balls[1].p.set(0, 0, r);
        this.table.balls[2].p.set(0, 2 * r, r);
        this.table.balls[3].p.set(0, -2 * r, r);
        this.table.balls[4].p.set(2 * r, 0, r);
        this.table.balls[5].p.set(4 * r, 2 * r, r);
    }
    /**
     * Loads diagram data from URL or data provided.
     */
    loadDiagram(diagram) {
        if (typeof (diagram) == "string") {
            try {
                return loadJSON(diagram).then((data) => {
                    if (!!data) {
                        this.table.resetBalls();
                        this.table.load(data);
                        console.log("Diagram loaded.");
                    }
                });
            }
            catch (error) {
                console.error('Error loading diagram:', error);
            }
        }
        else {
            this.table.resetBalls();
            this.table.load(diagram);
            this.table.balls.forEach((ball) => {
                ball.v.multiplyScalar(3);
            });
        }
    }
    setSpeed(speed) {
        this.speed = speed;
    }
    simulate(maxTime) {
        const time = performance.now() / 1000;
        if ((this.speed < 1.0e-9) || (this.state.internalTime == null)) {
            this.table.updateToScene();
            this.state.internalTime = time;
            return;
        }
        // Advance maximum 0.1s:
        this.state.internalTime = Math.max(this.state.internalTime, time - 0.1 * this.speed);
        while ((performance.now() / 1000 < time + maxTime) && (time - this.state.internalTime > 1.0e-9)) {
            const dt = Math.min(0.001, (time - this.state.internalTime) * this.speed);
            for (let k = 0; k < 16; k++)
                this.table.balls[k].advanceTime(dt);
            this.table.handleCollisions();
            this.state.internalTime += dt / this.speed;
        }
        // console.log("time taken (ms): ", performance.now()-time*1000);
        this.table.stopOutOfBoundBalls();
        this.table.updateToScene();
        this.state.internalTime = time;
    }
}
