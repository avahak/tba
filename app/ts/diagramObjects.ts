/**
 * Handles states of movable objects of the diagram.
 */

export { Text, Arrow, Ball, ObjectCollection }
import { TableScene } from "./tableScene.js";
import { canvasTextBoundingBox, drawArrow, closestIntervalPoint, combineBboxes } from "./util.js";
import { pixelsToNDC, NDCToPixels, NDCToWorld3, NDCToWorld2, world2ToNDC } from "./transformation.js"
import * as THREE from 'three';

console.log("diagram-objects.ts")
class Arrow {
    public static counter = 0;
    public p1: THREE.Vector2;
    public p2: THREE.Vector2;
    public width: number;
    public color: string;
    public name: string;

    public constructor(p1: THREE.Vector2, p2: THREE.Vector2) {
        Arrow.counter++;
        this.p1 = p1;
        this.p2 = p2;
        this.width = 5.0;
        this.color = "#ff0000";
        this.name = `arrow_${Arrow.counter}`;
    }

    public closestPoint(p: THREE.Vector2): THREE.Vector2 {
        const line = new THREE.Line3(new THREE.Vector3(this.p1.x, this.p1.y, 0.0), new THREE.Vector3(this.p2.x, this.p2.y, 0.0));
        const q = line.closestPointToPoint(new THREE.Vector3(p.x, p.y, 0.0), true, new THREE.Vector3());
        return new THREE.Vector2(q.x, q.y);
    }

    public serialize() {
        const data: { [key: string]: any } = {};
        ["p1", "p2", "width", "color", "name"].forEach((key) => {
            data[key] = (this as any)[key];
        });
        return data;
    }

    public load(source: any) {
        this.p1 = new THREE.Vector2(source.p1.x, source.p1.y);
        this.p2 = new THREE.Vector2(source.p2.x, source.p2.y);
        this.width = parseFloat(source.width);
        ["color", "name"].forEach((key) => {
            (this as any)[key] = source[key];
        });
    }
}

class Text {
    public static counter = 0;
    public p: THREE.Vector2;
    public font: string;
    public size: number;
    public text: string;
    public color: string;
    public name: string;
    public bbox: any;

    public constructor(p: THREE.Vector2, text: string) {
        Text.counter++;
        this.p = p;
        this.font = "Open Sans";
        this.size = 30;
        this.text = text;
        this.color = "#ffff00";
        this.bbox = [this.p, this.p];
        this.name = `text_${Text.counter}`;
    }

    public closestPoint(p: THREE.Vector2): THREE.Vector2 {
        if (!this.bbox)
            return this.p;
        const q1 = this.bbox[0];
        const q2 = this.bbox[1];
        const q = new THREE.Vector2(closestIntervalPoint(p.x, q1.x, q2.x), closestIntervalPoint(p.y, q1.y, q2.y))        
        return q;
    }

    public serialize() {
        const data: { [key: string]: any } = {};
        ["p", "font", "size", "text", "color", "name"].forEach((key) => {
            data[key] = (this as any)[key];
        });
        return data;
    }

    public load(source: any) {
        this.p = new THREE.Vector2(source.p.x, source.p.y);
        this.size = parseFloat(source.size);
        ["font", "text", "color", "name"].forEach((key) => {
            (this as any)[key] = source[key];
        });
    }
}

class Ball {
    public p: THREE.Vector3;
    public name: string;
    public tableScene: TableScene;

    public constructor(name: string, tableScene: TableScene) {
        this.name = name;
        this.tableScene = tableScene;
        const ballObject = this.tableScene.objects[this.name];
        this.p = ballObject.position.clone();
    }

    public move(ndc: THREE.Vector2, camera: THREE.Camera) {
        const ballObject = this.tableScene.objects[this.name];
        let intersect = NDCToWorld3(ndc, this.tableScene.specs.BALL_RADIUS, camera);
        if (!!intersect) {
            const oldBallPosition = ballObject.position.clone();
            ballObject.position.x = intersect.x;
            ballObject.position.y = intersect.y;
            const resolved = this.tableScene.resolveIntersections(this.name, ballObject.position);
            let oob = this.tableScene.outOfBoundsString(resolved);
            if ((this.tableScene.intersections(this.name, resolved).length == 0) && (!oob))
                ballObject.position.copy(resolved);
            else
                ballObject.position.copy(oldBallPosition);
            if (oob == "pocket") 
                this.resetBall();
        }
        this.updatePositionFromScene();
    }

    /**
     * Updates this.p taking value from ball position in scene.
     */
    public updatePositionFromScene() {
        const ballObject = this.tableScene.objects[this.name];
        this.p.copy(ballObject.position);
    }

    /**
     * Updates ball position in scene taking value from this.p.
     */
    public updatePositionToScene() {
        const ballObject = this.tableScene.objects[this.name];
        ballObject.position.copy(this.p);
    }

    public resetBall() {
        const ballObject = this.tableScene.objects[this.name];
        const defaultPos = this.tableScene.defaultBallPosition(this.name);
        ballObject.position.copy(defaultPos);
        this.updatePositionFromScene();
    }

    public serialize() {
        return { "p": this.p, "name": this.name };
    }

    public load(source: any) {
        this.p = new THREE.Vector3(source.p.x, source.p.y, source.p.z);
        this.name = source.name;
        this.updatePositionToScene()
    }
}

/**
 * Stores arrows, texts, and positions of balls and has methods to handle them.
 */
class ObjectCollection {
    public tableScene: TableScene;
    public objects: { [key: string]: any };

    public constructor(tableScene: TableScene) {
        this.tableScene = tableScene;
        this.objects = {};
        for (let k = 0; k < 16; k++) {
            const name = `ball_${k}`;
            const ball = new Ball(name, this.tableScene);
            this.objects[name] = ball;
        }
    }

    public move(object: string[], ndc: THREE.Vector2, camera: THREE.Camera) {
        const objectName = object[0];
        const objectPart = object[1];
        if (objectName.startsWith("ball")) {
            const ball = this.objects[objectName] as Ball;
            ball.move(ndc, camera)
        } else if (objectName.startsWith("text")) {
            let p = NDCToWorld2(ndc, 0.0, camera);
            let text = this.objects[objectName] as Text;
            text.p = p;
        } else if (objectName.startsWith("arrow")) {
            let p = NDCToWorld2(ndc, 0.0, camera);
            let arrow = this.objects[objectName] as Arrow;
            if (objectPart == "p1")
                arrow.p1 = p;
            else if (objectPart == "p2")
                arrow.p2 = p;
            else {
                const dir = arrow.p2.clone().sub(arrow.p1).multiplyScalar(0.5);
                arrow.p1 = p.clone().sub(dir);
                arrow.p2 = p.clone().add(dir);
            }
        }
    }

    public getObject(ndc: THREE.Vector2, camera: THREE.Camera): string[] {
        let obj = this.tableScene.findObjectNameOnMouse(ndc, camera);
		if ((!!obj) && obj.startsWith("ball_"))
            return [obj, ""];

        let closest: [string, number] = ["", Infinity];
        const w = NDCToWorld2(ndc, 0, camera);
        for (const key in this.objects) {
            if (key.startsWith("ball"))
                continue;
            const obj = this.objects[key] as (Arrow | Text);
            const cp = obj.closestPoint(w);
            const dist = cp.distanceTo(w);
            if (dist < closest[1]) {
                closest[0] = key;
                closest[1] = dist;
            }
        }
        // console.log("closest", closest);
        if (closest[1] < 0.02) {
            let part = "";
            const obj = this.objects[closest[0]];
            if (obj instanceof Arrow) {
                if (w.distanceTo(obj.p1) < 0.05)
                    part = "p1";
                else if (w.distanceTo(obj.p2) < 0.05)
                    part = "p2";
            }
            return [closest[0], part];
        }
        return ["", ""];
    }

    public clear(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    public draw(camera: THREE.Camera, canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        for (const key in this.objects) {
            let obj = this.objects[key];
            if (obj instanceof Arrow) {
                let q1 = NDCToPixels(world2ToNDC(obj.p1, 0, camera), canvas);
                let q2 = NDCToPixels(world2ToNDC(obj.p2, 0, camera), canvas);
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = obj.width;
                if (obj.p1.distanceTo(obj.p2) >= 0.02)
                    drawArrow(ctx, q1, q2);
            } else if (obj instanceof Text) {
                ctx.font = `${obj.size}px ${obj.font}`;
                ctx.fillStyle = obj.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let p = NDCToPixels(world2ToNDC(obj.p, 0, camera), canvas);
                let text = obj.text;
                let lines = text.split("\n");
                let bboxes = [];
                for (let k = 0; k < lines.length; k++) {
                    ctx.fillText(lines[k], p.x, p.y+obj.size*k);
                    const bbox = canvasTextBoundingBox(ctx, lines[k], p.x, p.y+obj.size*k);
                    bboxes.push(bbox);
                }
                const bbox = combineBboxes(bboxes);
                const bbox1 = NDCToWorld2(pixelsToNDC(bbox[0], canvas), 0, camera);
                const bbox2 = NDCToWorld2(pixelsToNDC(bbox[1], canvas), 0, camera);
                obj.bbox = [bbox1, bbox2];
            }
        }
    }

    public drawDebug(activeObject: string[], state: string, objects: any, canvas: HTMLCanvasElement) {
        // Just for debugging
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        ctx.font = `20px px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText("activeObject: " + activeObject[0] + ", " + activeObject[1], 10, canvas.height-10);
        ctx.fillText("state: " + state, 10, canvas.height-30);
        const nonBallKeys = Object.keys(objects).filter((key) => !key.startsWith("ball"));
        ctx.fillText("objects: " + nonBallKeys, 10, canvas.height-50);
    }

    public reset() {
        Object.keys(this.objects).forEach((key) => {
            if (key.startsWith("ball")) 
                (this.objects[key] as Ball).resetBall();
            else 
                delete this.objects[key];
        });
    }

    public serialize() {
        let data: { [key: string]: any } = {};
        for (const objName in this.objects) {
            if (objName.startsWith("ball")) {
                const save = (this.objects[objName] as Ball).serialize();
                data[objName] = save;
            } else if (objName.startsWith("arrow")) {
                const save = (this.objects[objName] as Arrow).serialize();
                data[objName] = save;
            } else if (objName.startsWith("text")) {
                const save = (this.objects[objName] as Text).serialize();
                data[objName] = save;
            }
        }
        return data;
    }

    public load(data: any) {
        this.reset();
        for (const objName in data) {
            if (objName.startsWith("ball")) {
                const ball = this.objects[objName] as Ball;
                ball.load(data[objName]);
            } else if (objName.startsWith("arrow")) {
                const arrow = new Arrow(new THREE.Vector2(), new THREE.Vector2());
                arrow.load(data[objName]);
                this.objects[objName] = arrow;
            } else if (objName.startsWith("text")) {
                const text = new Text(new THREE.Vector2(), "");
                text.load(data[objName]);
                this.objects[objName] = text;
            }
        }
    }
}