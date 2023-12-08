export { Ball }
import { clamp } from '../util.js';
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
    obj: THREE.Object3D;
    r: number;
    m: number;
    j: number;                  // momentum of inertia
    name: string;

    public constructor(p: THREE.Vector3, obj: THREE.Object3D, name: string) {
        this.p = p;
        this.obj = obj;
        this.v = new THREE.Vector3();
        this.a = new THREE.Vector3();
        this.q = new THREE.Quaternion().setFromAxisAngle(E2, 0.0);
        this.w = new THREE.Vector3();
        this.dw = new THREE.Vector3();
        this.r = R;
        this.m = M;
        this.j = 2.0/5.0*this.m*this.r**2;
        this.name = name;
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
    }

    public advanceTime(dt: number) {
        if (dt > 0.5)
            dt = 0.5;
        if (this.v.length()+this.r*this.w.length() < 1.0e-3) {
            this.stop();
            // if (this.name == "ball_0")
            //     console.log("stopped");
            return;
        }
        let dt0 = dt;
        let iter = 0;
        while (dt >= EPSILON) {
            const ratio = Math.max(this.a.length()/this.v.length(), this.dw.length()/this.w.length());
            let s = clamp(isNaN(ratio) ? 0.0 : 0.5/ratio, 0.001*dt0, dt);
            // this.integrateEuler(s);
            this.integrateHeun(s);
            dt -= s;
            iter += 1;
        }
        // if (this.name == "ball_0")
        //     console.log("iter", iter);
    }

    public computeForces() {
        this.a.set(0, 0, 0);
        this.dw.set(0, 0, 0);

        // Kinetic friction for sliding:
        const vu = this.v.clone().normalize();
        const c = 7.0/5.0*FRICTION_ROLL*this.r;
        const cp = new THREE.Vector3(c*vu.x, c*vu.y, -this.r).setLength(this.r);
        const cp_v = this.v.clone().add(this.w.clone().cross(cp));
        cp_v.sub(cp_v.clone().projectOnVector(cp));
        this.applyForce(this.p.clone().add(cp), cp_v.clone().multiplyScalar(-FRICTION_KINETIC*this.m*G));

        // Kinetic friction for spinning:
        let spin = this.w.clone().projectOnVector(cp);
        this.dw.sub(spin.setLength(SPIN_DECELERATION));
        // console.log(spin);

        // Rolling resistance:
        const s = FRICTION_ROLL*this.m*G;
        const pv = new THREE.Vector3(-vu.x*s, -vu.y*s, this.m*G);
        this.applyForce(this.p.clone().add(cp), pv);

        // Gravity:
        this.applyForce(this.p, E3.clone().multiplyScalar(-this.m*G));

        if (this.name == "ball_0") {
            // const theta = Math.atan2(cp.dot(vu), -cp.dot(E3));
            // console.log("cp", cp);
            // console.log("THETA", THETA);
            // console.log("theta (deg)", theta*180/Math.PI);
        }
    }

    /**
     * Basic Euler's (forward) method.
     */
    public integrateEuler(dt: number) {
        this.computeForces();

        this.a.z = 0;
        this.v.z = 0;

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
        this.computeForces();
        this.a.z = 0;

        const v1 = this.v.clone();
        const a1 = this.a.clone();
        const w1 = this.w.clone();
        const dw1 = this.dw.clone();

        // Advance position:
        this.p.addScaledVector(this.v, dt);
        this.v.addScaledVector(this.a, dt);
        this.w.addScaledVector(this.dw, dt);

        this.computeForces();
        this.a.z = 0;

        this.p.addScaledVector(this.v.clone().sub(v1), 0.5*dt);
        this.v.addScaledVector(this.a.clone().sub(a1), 0.5*dt);
        const w = this.w.clone().add(w1).multiplyScalar(0.5);
        const rot = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), dt*w.length());
        this.q.premultiply(rot);
        this.w.addScaledVector(this.dw.clone().sub(dw1), 0.5*dt);
    }

}