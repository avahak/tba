/**
 * Handles states of movable objects of the diagram.
 */
export { Text, Arrow, ObjectCollection };
import { Ball } from "./table/ball.js";
import { canvasTextBoundingBox, drawArrow, closestIntervalPoint, combineBboxes } from "./util.js";
import { pixelsToNDC, NDCToPixels, NDCToWorld2, world2ToNDC } from "./transformation.js";
import * as THREE from 'three';
console.log("diagram-objects.ts");
class Arrow {
    constructor(p1, p2) {
        Arrow.counter++;
        this.p1 = p1;
        this.p2 = p2;
        this.width = 5.0;
        this.color = "#ff0000";
        this.name = `arrow_${Arrow.counter}`;
    }
    closestPoint(p) {
        const line = new THREE.Line3(new THREE.Vector3(this.p1.x, this.p1.y, 0.0), new THREE.Vector3(this.p2.x, this.p2.y, 0.0));
        const q = line.closestPointToPoint(new THREE.Vector3(p.x, p.y, 0.0), true, new THREE.Vector3());
        return new THREE.Vector2(q.x, q.y);
    }
    serialize() {
        const data = {};
        ["p1", "p2", "width", "color", "name"].forEach((key) => {
            data[key] = this[key];
        });
        return data;
    }
    load(source) {
        this.p1 = new THREE.Vector2(source.p1.x, source.p1.y);
        this.p2 = new THREE.Vector2(source.p2.x, source.p2.y);
        this.width = parseFloat(source.width);
        ["color", "name"].forEach((key) => {
            this[key] = source[key];
        });
    }
}
Arrow.counter = 0;
class Text {
    constructor(p, text) {
        Text.counter++;
        this.p = p;
        this.font = "Open Sans";
        this.size = 30;
        this.text = text;
        this.color = "#ffff00";
        this.bbox = [this.p, this.p];
        this.name = `text_${Text.counter}`;
    }
    closestPoint(p) {
        if (!this.bbox)
            return this.p;
        const q1 = this.bbox[0];
        const q2 = this.bbox[1];
        const q = new THREE.Vector2(closestIntervalPoint(p.x, q1.x, q2.x), closestIntervalPoint(p.y, q1.y, q2.y));
        return q;
    }
    serialize() {
        const data = {};
        ["p", "font", "size", "text", "color", "name"].forEach((key) => {
            data[key] = this[key];
        });
        return data;
    }
    load(source) {
        this.p = new THREE.Vector2(source.p.x, source.p.y);
        this.size = parseFloat(source.size);
        ["font", "text", "color", "name"].forEach((key) => {
            this[key] = source[key];
        });
    }
}
Text.counter = 0;
/**
 * Stores arrows, texts, and positions of balls and has methods to handle them.
 */
class ObjectCollection {
    constructor(table) {
        this.table = table;
        this.objects = {};
        for (let k = 0; k < 16; k++) {
            const name = `ball_${k}`;
            this.objects[name] = this.table.balls[k];
        }
    }
    move(object, ndc, camera) {
        const objectName = object[0];
        const objectPart = object[1];
        if (objectName.startsWith("ball")) {
            const ball = this.objects[objectName];
            if (objectPart == "velocity") {
                let pv = NDCToWorld2(ndc, 0.0, camera);
                let v = new THREE.Vector2(pv.x - ball.p.x, pv.y - ball.p.y);
                ball.v.set(v.x, v.y, 0);
            }
            else
                ball.move(ndc, camera);
        }
        else if (objectName.startsWith("text")) {
            let p = NDCToWorld2(ndc, 0.0, camera);
            let text = this.objects[objectName];
            text.p = p;
        }
        else if (objectName.startsWith("arrow")) {
            let p = NDCToWorld2(ndc, 0.0, camera);
            let arrow = this.objects[objectName];
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
    /**
     * TODO Rewrite this in a more scalable way - each object should offer
     * a list of geometry and control points and the closest object should be
     * selected based on these.
     */
    getObject(ndc, camera) {
        let obj = this.table.tableScene.findObjectNameOnMouse(ndc, camera);
        if ((!!obj) && obj.startsWith("ball_"))
            return [obj, ""];
        let closest = ["", Infinity];
        const w0 = NDCToWorld2(ndc, 0, camera);
        const wh = NDCToWorld2(ndc, this.table.tableScene.jsonAll.specs.BALL_RADIUS, camera);
        for (const key in this.objects) {
            if (key.startsWith("ball")) {
                // Check if user wants to change ball velocity:
                const ball = this.objects[key];
                const pv = new THREE.Vector2(ball.p.x + ball.v.x, ball.p.y + ball.v.y);
                if (pv.distanceTo(wh) < 0.02)
                    return [key, "velocity"];
                continue;
            }
            const obj = this.objects[key];
            const cp = obj.closestPoint(w0);
            const dist = cp.distanceTo(w0);
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
                if (w0.distanceTo(obj.p1) < 0.05)
                    part = "p1";
                else if (w0.distanceTo(obj.p2) < 0.05)
                    part = "p2";
            }
            return [closest[0], part];
        }
        return ["", ""];
    }
    clear(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    draw(camera, canvas) {
        const ctx = canvas.getContext('2d');
        for (const key in this.objects) {
            let obj = this.objects[key];
            if (obj instanceof Ball) {
                if (obj.v.length() > 0.01) {
                    const p = new THREE.Vector2(obj.p.x, obj.p.y);
                    const q1 = new THREE.Vector2(obj.p.x + obj.v.x, obj.p.y + obj.v.y);
                    const q2 = new THREE.Vector2(obj.p.x + obj.v.clone().setLength(2.5).x, obj.p.y + obj.v.clone().setLength(2.5).y);
                    let pixel1 = NDCToPixels(world2ToNDC(p, obj.r, camera), canvas);
                    let pixel2 = NDCToPixels(world2ToNDC(q1, obj.r, camera), canvas);
                    let pixel3 = NDCToPixels(world2ToNDC(q2, obj.r, camera), canvas);
                    ctx.strokeStyle = "#333";
                    ctx.lineWidth = 0.2;
                    drawArrow(ctx, pixel1, pixel3);
                    ctx.strokeStyle = "#333";
                    ctx.lineWidth = 2;
                    drawArrow(ctx, pixel1, pixel2);
                }
            }
            else if (obj instanceof Arrow) {
                let q1 = NDCToPixels(world2ToNDC(obj.p1, 0, camera), canvas);
                let q2 = NDCToPixels(world2ToNDC(obj.p2, 0, camera), canvas);
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = obj.width;
                if (obj.p1.distanceTo(obj.p2) >= 0.02)
                    drawArrow(ctx, q1, q2);
            }
            else if (obj instanceof Text) {
                ctx.font = `${obj.size}px ${obj.font}`;
                ctx.fillStyle = obj.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let p = NDCToPixels(world2ToNDC(obj.p, 0, camera), canvas);
                let text = obj.text;
                let lines = text.split("\n");
                let bboxes = [];
                for (let k = 0; k < lines.length; k++) {
                    ctx.fillText(lines[k], p.x, p.y + obj.size * k);
                    const bbox = canvasTextBoundingBox(ctx, lines[k], p.x, p.y + obj.size * k);
                    bboxes.push(bbox);
                }
                const bbox = combineBboxes(bboxes);
                const bbox1 = NDCToWorld2(pixelsToNDC(bbox[0], canvas), 0, camera);
                const bbox2 = NDCToWorld2(pixelsToNDC(bbox[1], canvas), 0, camera);
                obj.bbox = [bbox1, bbox2];
            }
        }
    }
    drawDebug(activeObject, state, objects, canvas) {
        // Just for debugging
        const ctx = canvas.getContext('2d');
        ctx.font = `20px px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText("activeObject: " + activeObject[0] + ", " + activeObject[1], 10, canvas.height - 10);
        ctx.fillText("state: " + state, 10, canvas.height - 30);
        const nonBallKeys = Object.keys(objects).filter((key) => !key.startsWith("ball"));
        ctx.fillText("objects: " + nonBallKeys, 10, canvas.height - 50);
    }
    reset() {
        Object.keys(this.objects).forEach((key) => {
            if (key.startsWith("ball")) {
                const ball = this.objects[key];
                ball.reset();
                ball.updatePositionToScene();
            }
            else
                delete this.objects[key];
        });
    }
    serialize() {
        let data = {};
        for (const objName in this.objects) {
            if (objName.startsWith("ball")) {
                const save = this.objects[objName].serialize();
                data[objName] = save;
            }
            else if (objName.startsWith("arrow")) {
                const save = this.objects[objName].serialize();
                data[objName] = save;
            }
            else if (objName.startsWith("text")) {
                const save = this.objects[objName].serialize();
                data[objName] = save;
            }
        }
        return data;
    }
    load(data) {
        this.reset();
        // Extract ball related data:
        this.table.load(data);
        for (const objName in data) {
            if (objName.startsWith("arrow")) {
                const arrow = new Arrow(new THREE.Vector2(), new THREE.Vector2());
                arrow.load(data[objName]);
                this.objects[objName] = arrow;
            }
            else if (objName.startsWith("text")) {
                const text = new Text(new THREE.Vector2(), "");
                text.load(data[objName]);
                this.objects[objName] = text;
            }
        }
    }
}
