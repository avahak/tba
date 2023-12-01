/**
 * Handles states of movable objects of the diagram.
 */
export { Text, Arrow, Ball, ObjectCollection };
import { canvasTextBoundingBox, drawArrow, closestIntervalPoint } from "./util.js";
import * as THREE from 'three';
console.log("diagram-objects.ts");
class Arrow {
    constructor(p1, p2) {
        Arrow.counter++;
        this.p1 = p1;
        this.p2 = p2;
        this.width = 1.0;
        this.type = "";
        this.name = `arrow_${Arrow.counter}`;
    }
    closestPoint(p) {
        const line = new THREE.Line3(new THREE.Vector3(this.p1.x, this.p1.y, 0.0), new THREE.Vector3(this.p2.x, this.p2.y, 0.0));
        const q = line.closestPointToPoint(new THREE.Vector3(p.x, p.y, 0.0), true, new THREE.Vector3());
        return new THREE.Vector2(q.x, q.y);
    }
}
Arrow.counter = 0;
class Text {
    constructor(p, text) {
        Text.counter++;
        this.p = p;
        this.font = "30px Open Sans";
        this.text = text;
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
}
Text.counter = 0;
class Ball {
    static getBallNumber(name) {
        const result = name.match(/\d+/);
        const ballNumber = result ? parseInt(result[0]) : null;
        return ballNumber;
    }
}
class ObjectCollection {
    constructor(tableView) {
        this.onWindowResize = this.onWindowResize.bind(this); // Ensure the correct 'this' inside onWindowResize
        this.tableView = tableView;
        this.objects = {};
        window.addEventListener('resize', this.onWindowResize);
        this.onWindowResize();
    }
    move(objectName, ndc) {
        if (objectName.startsWith("ball")) {
            let intersect = this.NDCToWorld3(ndc, this.tableView.tableScene.specs.BALL_RADIUS);
            if (!!intersect) {
                const ball = this.tableView.tableScene.objects[objectName];
                const oldBallPosition = ball.position.clone();
                ball.position.x = intersect.x;
                ball.position.y = intersect.y;
                const resolved = this.tableView.tableScene.resolveIntersections(objectName, ball.position);
                let oob = this.tableView.tableScene.outOfBoundsString(resolved);
                if ((this.tableView.tableScene.intersections(objectName, resolved).length == 0) && (!oob))
                    ball.position.copy(resolved);
                else
                    ball.position.copy(oldBallPosition);
                if (oob == "pocket") {
                    let ballNumber = Ball.getBallNumber(objectName);
                    const defaultPos = this.tableView.tableScene.defaultBallPosition(ballNumber);
                    ball.position.copy(defaultPos);
                }
            }
        }
        else if (objectName.startsWith("text")) {
            let p = this.NDCToWorld2(ndc, 0.0);
            let text = this.objects[objectName];
            text.p = p;
        }
        else if (objectName.startsWith("arrow")) {
            let p = this.NDCToWorld2(ndc, 0.0);
            let arrow = this.objects[objectName];
            arrow.p1 = p;
        }
    }
    /**
     * Returns point on plane z=height where ray from camera to mouse intersects it.
     */
    NDCToWorld3(ndc, height) {
        const ndc1 = new THREE.Vector3(ndc.x, ndc.y, -1);
        const ndc2 = new THREE.Vector3(ndc.x, ndc.y, 1);
        let a1 = ndc1.unproject(this.tableView.camera);
        let a2 = ndc2.unproject(this.tableView.camera);
        let ray = new THREE.Ray(a1, a2);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -height);
        let intersect = new THREE.Vector3();
        ray.intersectPlane(plane, intersect);
        return intersect;
    }
    NDCToWorld2(ndc, height) {
        let p = this.NDCToWorld3(ndc, height);
        return new THREE.Vector2(p.x, p.y);
    }
    world2ToNDC(p, height) {
        let ndc = new THREE.Vector3(p.x, p.y, height).project(this.tableView.camera);
        return new THREE.Vector2(ndc.x, ndc.y);
    }
    getObject(ndc) {
        let obj = this.tableView.tableScene.findObjectNameOnMouse(ndc, this.tableView.camera);
        if ((!!obj) && obj.startsWith("ball_"))
            return obj;
        console.log("this.objects", this.objects);
        let closest = ["", Infinity];
        const w = this.NDCToWorld2(ndc, 0);
        for (const key in this.objects) {
            const obj = this.objects[key];
            const cp = obj.closestPoint(w);
            const dist = cp.distanceTo(w);
            if (dist < closest[1]) {
                closest[0] = key;
                closest[1] = dist;
            }
        }
        // console.log("closest", closest);
        if (closest[1] < 0.01)
            return closest[0];
        return "";
    }
    draw() {
        const canvas = document.getElementById("overlay-canvas");
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const key in this.objects) {
            let obj = this.objects[key];
            if (obj instanceof Arrow) {
                let q1 = this.tableView.NDCToPixels(this.world2ToNDC(obj.p1, 0));
                let q2 = this.tableView.NDCToPixels(this.world2ToNDC(obj.p2, 0));
                drawArrow(ctx, q1, q2);
            }
            else if (obj instanceof Text) {
                ctx.font = obj.font;
                ctx.fillStyle = '#ffff00';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let p = this.tableView.NDCToPixels(this.world2ToNDC(obj.p, 0));
                let text = obj.text;
                ctx.fillText(text, p.x, p.y);
                // Compute obj.bbox
                // A little awkward to do here but here we have all the info needed.
                const bbox = canvasTextBoundingBox(ctx, text, p.x, p.y);
                const bbox1 = this.NDCToWorld2(this.tableView.pixelsToNDC(bbox[0]), 0);
                const bbox2 = this.NDCToWorld2(this.tableView.pixelsToNDC(bbox[1]), 0);
                obj.bbox = [bbox1, bbox2];
            }
        }
    }
    drawDebug(activeObject, state) {
        // Just for debugging
        const canvas = document.getElementById("overlay-canvas");
        const ctx = canvas.getContext('2d');
        ctx.font = `20px px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText("activeObject: " + activeObject, 10, canvas.height - 10);
        ctx.fillText("state: " + state, 10, canvas.height - 30);
    }
    onWindowResize() {
        console.log("diagram-objects: onWindowResize");
        const canvas = document.getElementById("overlay-canvas");
        canvas.width = this.tableView.element.offsetWidth;
        canvas.height = this.tableView.element.offsetHeight;
        this.draw();
    }
}
