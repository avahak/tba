// TODO Try Verlet integration

export { Ball }
import { clamp } from '../util.js';
import { Table } from './table.js';
import { TableScene } from './tableScene.js';
import { Collision } from './collision.js';
import { NDCToWorld3 } from "../transformation.js"
import * as THREE from 'three';

console.log("ball.ts");

const EPSILON = 1.0e-9;
const G = 9.81;
const THETA = 0.01;
const R = 0.028575;
const M = 0.163;
const FRICTION_KINETIC = 0.2;
const FRICTION_ROLL = 0.01;
const SPIN_DECELERATION = 10;           // deceleration of sidespin, ~ 10 m/s^2 (according to Dr Dave)
const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);

class Ball {
    p: THREE.Vector3;
    v: THREE.Vector3;
    a: THREE.Vector3;
    q: THREE.Quaternion;
    w: THREE.Vector3;           // angular velocity
    dw: THREE.Vector3;
    obj: THREE.Object3D | null;
    r: number;
    m: number;
    j: number;                  // momentum of inertia
    name: string;
    table: Table;
    continuingSlateContact: boolean;
    isStopped: boolean;

    public constructor(obj: THREE.Object3D | null, name: string, table: Table) {
        this.p = new THREE.Vector3();
        this.obj = obj;
        this.v = new THREE.Vector3();
        this.a = new THREE.Vector3();
        this.q = new THREE.Quaternion();
        this.w = new THREE.Vector3();
        this.dw = new THREE.Vector3();
        this.r = R;
        this.m = M;
        this.j = 2.0/5.0*this.m*this.r**2;
        this.name = name;
        this.table = table;
        this.continuingSlateContact = false;
        this.isStopped = false;
        this.reset();
    }

    public clone() {
        const clonedBall = new Ball(this.obj, this.name, this.table);
        clonedBall.p = this.p.clone();
        clonedBall.v = this.v.clone();
        clonedBall.a = this.a.clone();
        clonedBall.q = this.q.clone();
        clonedBall.w = this.w.clone();
        clonedBall.dw = this.dw.clone();
        clonedBall.r = this.r;
        clonedBall.m = this.m;
        clonedBall.j = this.j;
        clonedBall.continuingSlateContact = this.continuingSlateContact;
        clonedBall.isStopped = this.isStopped;
        return clonedBall;
    }

    public reset() {
        this.p = this.table.defaultBallPosition(this.name).clone();
        this.v.set(0, 0, 0);
        this.a.set(0, 0, 0);
        this.q.set(0, 0, 0, 1);
        this.w.set(0, 0, 0);
        this.dw.set(0, 0, 0);
        this.continuingSlateContact = false;
        this.isStopped = false;
    }

    public applyForce(pos: THREE.Vector3, dir: THREE.Vector3) {
        this.a.addScaledVector(dir, 1.0/this.m);

        const q = pos.clone().sub(this.p);
        const torque = q.clone().cross(dir);
        this.dw.addScaledVector(torque, 1.0/this.j);
    }

    public stop() {
        this.v.set(0, 0, 0);
        this.a.set(0, 0, 0);
        this.w.set(0, 0, 0);
        this.dw.set(0, 0, 0);
        this.isStopped = true;
    }

    public outOfBounds(): boolean {
        const h = Table.tableJson.specs.TABLE_CASING_HEIGHT - Table.tableJson.specs.TABLE_RAIL_HEIGHT - this.r;
        if (this.p.z < -h)
            return true;
        const cx = Table.tableJson.specs.TABLE_LENGTH/2 + Table.tableJson.specs.TABLE_RAIL_WIDTH + this.r;
        const cy = Table.tableJson.specs.TABLE_LENGTH/4 + Table.tableJson.specs.TABLE_RAIL_WIDTH + this.r;
        if ((Math.abs(this.p.x) > cx) || (Math.abs(this.p.y) > cy))
            return true;
        return false;
    }

    public enforceContinuingSlateContact() {
        this.a.z = 0;
        this.v.z = 0;
        this.p.z = this.r;
        // if (!this.continuingSlateContact)
        //     console.log(this.name, "enforceContinuingSlateContact");
        this.continuingSlateContact = true;
    }

    public advanceTime(dt0: number) {
        if (this.isStopped)
            return;
        // if ((this.v.length()+this.r*this.w.length() < 1.0e-2) && (Math.abs(this.p.z-this.r) < 1.0e-3)) {
        //     this.stop();
        //     return;
        // }
        let dt = dt0;
        while (dt >= EPSILON) {     // Not used atm
            // const ratio = Math.max(this.a.length()/this.v.length(), this.dw.length()/this.w.length());
            // let s = clamp(isNaN(ratio) ? 0.0 : 0.5/ratio, Math.min(0.1*dt0, dt), dt);
            let s = dt;
            // this.integrateEuler(s);
            this.integrateHeun(s);
            dt -= s;

            // console.log("v.z", Math.abs(this.table.balls[0].v.z));
            const slateDistance = this.table.getClosestSlatePoint(this.p).distanceTo(this.p);
            if (slateDistance > this.r+1.0e-3)
                this.continuingSlateContact = false;
            if (!this.continuingSlateContact)
                if (slateDistance < this.r+1.0e-3)
                    if (Math.abs(this.v.z) < 1.0e-1)
                        this.enforceContinuingSlateContact();
            if (slateDistance < this.r+1.0e-3) 
                if (this.v.length()+this.r*this.w.length() < 1.0e-2) 
                    this.stop();

            // if (this.name == "ball_0")
            //     console.log(this.p.z-this.r, this.v.z, this.slateDistance-this.r);
        }
    }

    public computeAcceleration() {
        const slateDistance = this.table.getClosestSlatePoint(this.p).distanceTo(this.p);
        this.a.set(0, 0, 0);
        this.dw.set(0, 0, 0);

        // Gravity:
        // if (this.slateDistance > this.r+EPSILON)
        this.applyForce(this.p, E3.clone().multiplyScalar(-this.m*G));

        // const dist = this.p.distanceTo(this.table.getClosestSlatePoint(this.p)) - this.r;
        // if (dist < EPSILON) {
        if (slateDistance < this.r+EPSILON) {
            // Kinetic friction for sliding:
            const vu = this.v.clone().normalize();
            const c = 7.0/5.0*FRICTION_ROLL*this.r;
            const cp = new THREE.Vector3(c*vu.x, c*vu.y, -this.r).setLength(this.r);
            const cp_v = this.v.clone().add(this.w.clone().cross(cp));
            cp_v.sub(cp_v.clone().projectOnVector(cp)).normalize();
            this.applyForce(this.p.clone().add(cp), cp_v.clone().multiplyScalar(-FRICTION_KINETIC*this.m*G));

            // Kinetic friction for spinning:
            let spin = this.w.clone().projectOnVector(cp);
            this.dw.sub(spin.setLength(SPIN_DECELERATION));
            // console.log(spin);

            // Rolling resistance:
            const s = FRICTION_ROLL*this.m*G;
            const pv = new THREE.Vector3(-vu.x*s, -vu.y*s, this.m*G);
            this.applyForce(this.p.clone().add(cp), pv);

            // this.enforceContinuingSlateContact();
        }

        if (this.continuingSlateContact)
            this.enforceContinuingSlateContact();
    }

    /**
     * Basic Euler's (forward) method.
     */
    public integrateEuler(dt: number) {
        this.computeAcceleration();

        // Advance position:
        this.p.addScaledVector(this.v, dt);
        this.v.addScaledVector(this.a, dt);

        // Advance rotation:
        const rot = new THREE.Quaternion().setFromAxisAngle(this.w.clone().normalize(), dt*this.w.length());
        this.q.premultiply(rot);
        this.w.addScaledVector(this.dw, dt);
    }

    /**
     * Heun's method, much better than Euler.
     */
    public integrateHeun(dt: number) {
        this.computeAcceleration();

        const v1 = this.v.clone();
        const a1 = this.a.clone();
        const w1 = this.w.clone();
        const dw1 = this.dw.clone();

        // Advance position:
        this.p.addScaledVector(this.v, dt);
        this.v.addScaledVector(this.a, dt);
        this.w.addScaledVector(this.dw, dt);

        this.computeAcceleration();

        this.p.addScaledVector(this.v.clone().sub(v1), 0.5*dt);
        this.v.addScaledVector(this.a.clone().sub(a1), 0.5*dt);
        const w = this.w.clone().add(w1).multiplyScalar(0.5);
        const rot = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), dt*w.length());
        this.q.premultiply(rot);
        this.w.addScaledVector(this.dw.clone().sub(dw1), 0.5*dt);
    }

    /* Methods from old diagramObjects.ts Ball: */

    public move(ndc: THREE.Vector2, camera: THREE.Camera, tableScene: TableScene) {
        const ballObject = tableScene.objects[this.name];
        let intersect = NDCToWorld3(ndc, tableScene.specs.BALL_RADIUS, camera);
        if (!!intersect) {
            const oldBallPosition = ballObject.position.clone();
            ballObject.position.x = intersect.x;
            ballObject.position.y = intersect.y;
            const resolved = tableScene.resolveIntersections(this.name, ballObject.position);
            let oob = tableScene.outOfBoundsString(resolved);
            if ((tableScene.intersections(this.name, resolved).length == 0) && (!oob))
                ballObject.position.copy(resolved);
            else
                ballObject.position.copy(oldBallPosition);
            if (oob == "pocket") {
                this.reset();
                this.updatePositionToScene();
            }
        }
        this.updatePositionFromScene();
    }

    /**
     * Updates this.p and this.q taking values from the scene.
     */
    public updatePositionFromScene() {
        if (this.obj != null) {
            this.p.copy(this.obj.position);
            this.q.copy(this.obj.quaternion);
        }
    }

    /**
     * Updates ball position and rotation in scene taking values from this.p and this.q.
     */
    public updatePositionToScene() {
        if (this.obj != null) {
            this.obj.position.copy(this.p);
            this.obj.quaternion.copy(this.q);
        }
    }

    public serialize() {
        let obj: { [key: string]: any };
        obj = { "p": this.p, "name": this.name };
        if (this.v.length() > 0.01)
            obj["v"] = this.v;
        return obj;
    }

    public load(source: any) {
        this.reset();
        this.p.set(source.p.x, source.p.y, source.p?.z ?? 0);
        if (source.hasOwnProperty("v")) {
            this.v.set(source.v.x, source.v.y, source.v?.z ?? 0);
        }
        this.updatePositionToScene()
    }

    public energy(): number {
        return (this.m*this.v.length()**2 + this.j*this.w.length()**2)/2;
    }
}