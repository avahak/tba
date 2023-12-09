export {};
import { Ball } from './ball.js';
import { Table } from './table.js';
import * as THREE from 'three';

console.log("collision.ts");

/**
 * Ball, Slate, Cushion
 */
interface ContactObject {
    object: Ball | "slate" | "cushion";
    a: THREE.Vector3;
    dw: THREE.Vector3;
}

class ContactPoint {
    public object1: ContactObject;
    public object2: ContactObject;
    public p: THREE.Vector3;
    public n: THREE.Vector3;        // surface normal at p pointing from o1 to o2
    public depth: number;
}

class Collision {
    private constructor() {
    }

    public fromTable(table: Table): Collision | null {
        return null;
    }

    public computeAcceleration() {
        // compute a, dw for all balls
    }

    public integrate() {
    }
}