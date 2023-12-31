// TODO compute actual "hardness" multipliers from formulas in
// https://en.wikipedia.org/wiki/Contact_mechanics
// This page also contains the force-displacement relation F = c*\delta^(3/2)
export { Collision };
import { Ball } from './ball.js';
import { Graph, weightedMean } from '../util.js';
import * as THREE from 'three';
console.log("collision.ts");
const EPSILON = 1.0e-9;
const COR_BALL = 0.85;
const COR_CUSHION = 0.8;
const COR_SLATE = 0.5;
const FRICTION_BALL_BALL = 0.2;
const FRICTION_BALL_CUSHION = 0.2;
const FRICTION_BALL_SLATE = 0.2;
// TODO assign hardness values if we implement adaptive timesteps, ignore until then:
const HARDNESS_BALL = 1.0;
const HARDNESS_CUSHION = 0.5;
const HARDNESS_SLATE = 1.0;
/**
 * Ball, Slate, Cushion
 */
class ContactObject {
    constructor(object) {
        this.object = object;
        this.a = new THREE.Vector3();
        this.dw = new THREE.Vector3();
    }
}
class ContactPoint {
    constructor(object1, object2, p, n) {
        this.object1 = object1;
        this.object2 = object2;
        this.p = p;
        this.n = n;
        this.depth = 0;
    }
    computeRelativeVelocity() {
        const ball1 = this.object1.object;
        if (this.object2.object instanceof Ball) {
            const ball2 = this.object2.object;
            const b1v = ball1.v.clone().add(ball1.w.clone().cross(this.n).multiplyScalar(ball1.r));
            const b2v = ball2.v.clone().add(ball2.w.clone().cross(this.n).multiplyScalar(-ball2.r));
            const v = b1v.clone().sub(b2v);
            const vn = v.clone().projectOnVector(this.n);
            const vt = v.clone().sub(vn);
            // Check if balls are moving towards each other:
            return [v, vn, vt];
        }
        // this.object2 is "cushion" or "slate":
        const v = ball1.v.clone().add(ball1.w.clone().cross(this.n).multiplyScalar(ball1.r));
        const vn = v.clone().projectOnVector(this.n);
        const vt = v.clone().sub(vn);
        return [v, vn, vt];
    }
    applyForces(dir) {
        const ball1 = this.object1.object;
        this.object1.a.addScaledVector(dir, 1.0 / ball1.m);
        const q = this.p.clone().sub(ball1.p); // should we add: .setLength(ball1.r) ? 
        const torque = q.clone().cross(dir);
        this.object1.dw.addScaledVector(torque, 1.0 / ball1.j);
        // then do same for ball2 if Ball:
        if (this.object2.object instanceof Ball) {
            const ball2 = this.object2.object;
            this.object2.a.addScaledVector(dir, -1.0 / ball2.m);
            const q = this.p.clone().sub(ball2.p);
            const torque = q.clone().cross(dir);
            this.object2.dw.addScaledVector(torque, -1.0 / ball2.j);
        }
    }
    computeDepthDerivative() {
        const ball1 = this.object1.object;
        let d = this.n.dot(ball1.v);
        if (this.object2.object instanceof Ball) {
            const ball2 = this.object2.object;
            d -= this.n.dot(ball2.v);
        }
        return d;
    }
}
class Collision {
    constructor(table, cps, cos) {
        this.table = table;
        this.contactPoints = cps;
        this.contactObjects = cos;
    }
    /**
     * This method assumes that the balls are touching and returns information about
     * the relative motion of the balls at contact poin.
     * Returns [n, vn, vt], where n is unit direction from ball1 center to ball2 center,
     * vn is normal component of the relative motion, and vt is tangential component.
     *
    public static ballBallContactPointInfo(ball1: Ball, ball2: Ball): THREE.Vector3[] {
        const n = ball2.p.clone().sub(ball1.p).normalize();
        const b1v = ball1.v.clone().add(ball1.w.clone().cross(n).multiplyScalar(ball1.r));
        const b2v = ball2.v.clone().add(ball2.w.clone().cross(n).multiplyScalar(-ball2.r));
        const v = b2v.clone().sub(b1v);
        const vn = v.clone().projectOnVector(n);
        const vt = v.clone().sub(vn);
        return [n, vn, vt];
    }*/
    static ballBallCollisionInfo(ball1, ball2) {
        const dist = ball1.p.distanceTo(ball2.p) - ball1.r - ball2.r;
        // Check if balls are close to each other:
        if (dist < EPSILON) {
            const n = ball2.p.clone().sub(ball1.p).normalize();
            const b1v = ball1.v.clone().add(ball1.w.clone().cross(n).multiplyScalar(ball1.r));
            const b2v = ball2.v.clone().add(ball2.w.clone().cross(n).multiplyScalar(-ball2.r));
            const v = b1v.clone().sub(b2v);
            const vn = v.clone().projectOnVector(n);
            const vt = v.clone().sub(vn);
            // Check if balls are moving towards each other:
            if (vn.dot(n) > EPSILON)
                return [n, vn, vt];
        }
        return null;
    }
    /**
     * Similar to ballBallContactPointInfo but with a stationary point instead of a second ball.
     *
    public static ballStaticContactPointInfo(ball: Ball, p: THREE.Vector3): THREE.Vector3[] {
        const n = p.clone().sub(ball.p).normalize();
        const v = ball.v.clone().add(ball.w.clone().cross(n).multiplyScalar(-ball.r));
        const vn = v.clone().projectOnVector(n);
        const vt = v.clone().sub(vn);
        return [n, vn, vt];
    }*/
    static ballStaticCollisionInfo(ball, p) {
        if (ball.p.distanceTo(p) - ball.r < EPSILON) {
            const n = p.clone().sub(ball.p).normalize();
            const v = ball.v.clone().add(ball.w.clone().cross(n).multiplyScalar(ball.r));
            const vn = v.clone().projectOnVector(n);
            const vt = v.clone().sub(vn);
            if (vn.dot(n) > EPSILON)
                return [n, vn, vt];
        }
        return null;
    }
    static detectSlateCollision(ball, table) {
        // Check collisions with slate:
        if (ball.isStopped)
            return false;
        const slate = table.getClosestSlatePoint(ball.p);
        const info = Collision.ballStaticCollisionInfo(ball, slate);
        return (info !== null);
    }
    static detectCushionCollision(ball, table) {
        // Check collisions with cushion:
        if (ball.isStopped)
            return false;
        if ((Math.abs(ball.p.x) + ball.r < table.tableLength / 2) && (Math.abs(ball.p.y) + ball.r < table.tableLength / 4))
            return false;
        const cushion = table.getClosestCushionPoint(ball.p);
        const info = Collision.ballStaticCollisionInfo(ball, cushion);
        return (info !== null);
    }
    /**
     * Returns true if ball is involved in a collision.
     */
    static detectCollisionForBall(ball, table) {
        // Check collisions with other balls:
        for (let k = 0; k < table.balls.length; k++) {
            const ball2 = table.balls[k];
            if (ball2 === ball)
                continue;
            const info = Collision.ballBallCollisionInfo(ball, ball2);
            if (info !== null)
                return true;
        }
        if (Collision.detectSlateCollision(ball, table))
            return true;
        if (Collision.detectCushionCollision(ball, table))
            return true;
        return false;
    }
    static detectCollision(table) {
        for (let k1 = 0; k1 < table.balls.length; k1++) {
            const ball1 = table.balls[k1];
            for (let k2 = k1 + 1; k2 < table.balls.length; k2++) {
                const ball2 = table.balls[k2];
                const info = Collision.ballBallCollisionInfo(ball1, ball2);
                if (info !== null)
                    return k1;
            }
            if (Collision.detectSlateCollision(ball1, table))
                return k1;
            if (Collision.detectCushionCollision(ball1, table))
                return k1;
        }
        return null;
    }
    static fromTable(table) {
        let k0 = Collision.detectCollision(table);
        if (k0 === null)
            return null;
        // const ball0 = table.balls[k0];
        // k1 is part of some collision group - we want to construct it.
        const touchingGraph = new Graph(true);
        for (let k1 = 0; k1 < table.balls.length; k1++) {
            const ball1 = table.balls[k1];
            for (let k2 = k1 + 1; k2 < table.balls.length; k2++) {
                const ball2 = table.balls[k2];
                if (ball1.p.distanceTo(ball2.p) - ball1.r - ball2.r < EPSILON)
                    touchingGraph.addEdge(k1, k2);
            }
        }
        const component = touchingGraph.connectedComponent(k0);
        const cps = [];
        const contactObjectMap = new Map();
        contactObjectMap.set("slate", new ContactObject("slate"));
        contactObjectMap.set("cushion", new ContactObject("cushion"));
        component.forEach((k) => {
            const ball = table.balls[k];
            const cObject = new ContactObject(ball);
            contactObjectMap.set(ball.name, cObject);
        });
        component.forEach((k1) => {
            const ball1 = table.balls[k1];
            // Contact points between balls:
            component.forEach((k2) => {
                if (k1 >= k2)
                    return;
                const ball2 = table.balls[k2];
                if (touchingGraph.hasEdge(k1, k2)) {
                    const p = weightedMean([ball1.p, ball2.p], [ball2.r, ball1.r]);
                    const n = ball2.p.clone().sub(ball1.p).normalize();
                    const cp = new ContactPoint(contactObjectMap.get(ball1.name), contactObjectMap.get(ball2.name), p, n);
                    cps.push(cp);
                }
            });
            // Contact point with cushion:
            const cushion = table.getClosestCushionPoint(ball1.p);
            if (ball1.p.distanceTo(cushion) - ball1.r < EPSILON) {
                const n = cushion.clone().sub(ball1.p).normalize();
                const cp = new ContactPoint(contactObjectMap.get(ball1.name), contactObjectMap.get("cushion"), cushion, n);
                cps.push(cp);
            }
            // Contact point with slate:
            const slate = table.getClosestSlatePoint(ball1.p);
            if (ball1.p.distanceTo(slate) - ball1.r < EPSILON) {
                const n = slate.clone().sub(ball1.p).normalize();
                const cp = new ContactPoint(contactObjectMap.get(ball1.name), contactObjectMap.get("slate"), slate, n);
                cps.push(cp);
            }
        });
        const cos = Array.from(contactObjectMap.values());
        // console.log("touchinGraph", touchingGraph.getAdjacentPairs());
        // console.log("connected to k1:", component);
        // console.log("cps:", cps);
        // console.log("cos:", cos);
        // console.log("cps p:s:", cps.map((cp) => cp.p));
        return new Collision(table, cps, cos);
    }
    /**
     * Computes a, dw for all balls.
     */
    computeAcceleration() {
        this.contactObjects.forEach((co) => {
            co.a.set(0, 0, 0);
            co.dw.set(0, 0, 0);
        });
        this.contactPoints.forEach((cp) => {
            const ball1 = cp.object1.object;
            // Note: cp.object1.object is always a Ball.
            if (cp.depth > 0) {
                const [v, vn, vt] = cp.computeRelativeVelocity();
                // Apply compression force:
                const cor = (cp.object2.object instanceof Ball ? COR_BALL :
                    cp.object2.object === "cushion" ? COR_CUSHION : COR_SLATE);
                const hardness = (cp.object2.object instanceof Ball ? HARDNESS_BALL :
                    cp.object2.object === "cushion" ? HARDNESS_CUSHION : HARDNESS_SLATE);
                // cor*cor is correct below because of scaling:
                const force = hardness * cp.depth * Math.sqrt(cp.depth) * (vn.dot(cp.n) > 0 ? 1.0 : cor * cor);
                cp.applyForces(cp.n.clone().multiplyScalar(-force));
                // Apply kinetic friction force:
                const frictionCoeff = (cp.object2.object instanceof Ball ? FRICTION_BALL_BALL :
                    cp.object2.object === "cushion" ? FRICTION_BALL_CUSHION :
                        FRICTION_BALL_SLATE);
                cp.applyForces(vt.clone().normalize().multiplyScalar(-frictionCoeff * force));
            }
        });
    }
    integrate(dt) {
        this.contactObjects.forEach((co) => {
            if (co.object instanceof Ball) {
                const ball = co.object;
                ball.v.add(co.a.clone().multiplyScalar(dt));
                ball.w.add(co.dw.clone().multiplyScalar(dt));
            }
        });
        this.contactPoints.forEach((cp) => {
            cp.depth += dt * cp.computeDepthDerivative();
        });
    }
    isResolved() {
        for (let k = 0; k < this.contactPoints.length; k++) {
            const cp = this.contactPoints[k];
            if ((cp.depth > EPSILON) || (cp.computeDepthDerivative() > EPSILON))
                return false;
        }
        return true;
    }
    resolve() {
        let iter = 0;
        const MAX_ITER = 10000;
        // console.log("isResolved():", this.isResolved());
        // console.log("ball_0 v.z", this.table.balls[0].v.z);
        // console.log("before", this.table.balls[0].v.length());
        let v0 = this.table.balls[0].v.z;
        while ((iter < MAX_ITER) && (!this.isResolved())) {
            // console.log("resolve() iter", iter);
            // check that cp.computeDepthDerivative() is same as..
            // const [v, vn, vt] = cp.computeRelativeVelocity();
            // vn.dot(cp.n)
            this.contactPoints.forEach((cp) => {
                const [v, vn, vt] = cp.computeRelativeVelocity();
                const result1 = cp.computeDepthDerivative();
                const result2 = vn.dot(cp.n);
                // console.log("result1:", result1, "result2:", result2);
                // console.log(cp);
                // console.log("cp.computeDepthDerivative()", cp.computeDepthDerivative());
            });
            this.computeAcceleration();
            this.integrate(0.02);
            iter++;
        }
        // console.log("ball_0 v.z", this.table.balls[0].v.z);
        // console.log("after", this.table.balls[0].v.length());
        // console.log("ratio", this.table.balls[0].v.length()/v0);
        console.log("resolve()", { "iter": iter, "cor(0)": Math.abs(this.table.balls[0].v.z / v0) });
        this.contactObjects.forEach((co) => {
            if (co.object instanceof Ball) {
                co.object.continuingSlateContact = false;
                co.object.isStopped = false;
            }
        });
    }
}
