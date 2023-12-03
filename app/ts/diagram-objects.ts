/**
 * Handles states of movable objects of the diagram.
 */

export { Text, Arrow, Ball, ObjectCollection }
import { TableView } from "./tableView.js";
import { canvasTextBoundingBox, drawArrow, closestIntervalPoint, combineBboxes } from "./util.js";
import * as THREE from 'three';

console.log("diagram-objects.ts")

class Arrow {
    public static counter = 0;
    public p1: THREE.Vector2;
    public p2: THREE.Vector2;
    public width: number;
    public color: string;
    public name: string;

    constructor(p1: THREE.Vector2, p2: THREE.Vector2) {
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

    constructor(p: THREE.Vector2, text: string) {
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
    public static getBallNumber(name: string): number | null {
        const result = name.match(/\d+/);
		const ballNumber =  result ? parseInt(result[0]) : null;
        return ballNumber;
    }
}

class ObjectCollection {
    public tableView: TableView;
    public objects: { [key: string]: any };

    constructor(tableView: TableView) {
        this.onWindowResize = this.onWindowResize.bind(this); // Ensure the correct 'this' inside onWindowResize
        this.tableView = tableView;
        this.objects = {};
        window.addEventListener('resize', this.onWindowResize);
		this.onWindowResize();
    }

    public move(object: string[], ndc: THREE.Vector2) {
        const objectName = object[0];
        const objectPart = object[1];
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
                if (oob == "pocket") 
                    this.resetBall(objectName);
            }
        } else if (objectName.startsWith("text")) {
            let p = this.NDCToWorld2(ndc, 0.0);
            let text = this.objects[objectName] as Text;
            text.p = p;
        } else if (objectName.startsWith("arrow")) {
            let p = this.NDCToWorld2(ndc, 0.0);
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

    public resetBall(ballName: string) {
        const ball = this.tableView.tableScene.objects[ballName];
        let ballNumber = Ball.getBallNumber(ballName) as number;
        const defaultPos = this.tableView.tableScene.defaultBallPosition(ballNumber);
        ball.position.copy(defaultPos);
    }

    /**
     * Returns point on plane z=height where ray from camera to mouse intersects it.
     */
    public NDCToWorld3(ndc: THREE.Vector2, height: number): THREE.Vector3 {
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

    public NDCToWorld2(ndc: THREE.Vector2, height: number): THREE.Vector2 {
        let p = this.NDCToWorld3(ndc, height);
        return new THREE.Vector2(p.x, p.y);
    }

    public world2ToNDC(p: THREE.Vector2, height: number): THREE.Vector2 {
        let ndc = new THREE.Vector3(p.x, p.y, height).project(this.tableView.camera);
        return new THREE.Vector2(ndc.x, ndc.y);
    }

    public getObject(ndc: THREE.Vector2): string[] {
        let obj = this.tableView.tableScene.findObjectNameOnMouse(ndc, this.tableView.camera);
		if ((!!obj) && obj.startsWith("ball_"))
            return [obj, ""];

        let closest: [string, number] = ["", Infinity];
        const w = this.NDCToWorld2(ndc, 0);
        for (const key in this.objects) {
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

    public clear() {
        const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    public draw() {
        const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        this.clear();

        for (const key in this.objects) {
            let obj = this.objects[key];
            if (obj instanceof Arrow) {
                let q1 = this.tableView.NDCToPixels(this.world2ToNDC(obj.p1, 0));
                let q2 = this.tableView.NDCToPixels(this.world2ToNDC(obj.p2, 0));
                ctx.strokeStyle = obj.color;
                ctx.lineWidth = obj.width;
                if (obj.p1.distanceTo(obj.p2) >= 0.02)
                    drawArrow(ctx, q1, q2);
            } else if (obj instanceof Text) {
                ctx.font = `${obj.size}px ${obj.font}`;
                ctx.fillStyle = obj.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                let p = this.tableView.NDCToPixels(this.world2ToNDC(obj.p, 0));
                let text = obj.text;
                let lines = text.split("\n");
                let bboxes = [];
                for (let k = 0; k < lines.length; k++) {
                    ctx.fillText(lines[k], p.x, p.y+obj.size*k);
                    const bbox = canvasTextBoundingBox(ctx, lines[k], p.x, p.y+obj.size*k);
                    bboxes.push(bbox);
                }
                const bbox = combineBboxes(bboxes);
                const bbox1 = this.NDCToWorld2(this.tableView.pixelsToNDC(bbox[0]), 0);
                const bbox2 = this.NDCToWorld2(this.tableView.pixelsToNDC(bbox[1]), 0);
                obj.bbox = [bbox1, bbox2];
            }
        }
    }

    public drawDebug(activeObject: string[], state: string, objects: any) {
        // Just for debugging
        const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        ctx.font = `20px px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText("activeObject: " + activeObject[0] + ", " + activeObject[1], 10, canvas.height-10);
        ctx.fillText("state: " + state, 10, canvas.height-30);
        ctx.fillText("objects: " + Object.keys(objects), 10, canvas.height-50);
    }

    public onWindowResize() {
        // console.log("diagram-objects: onWindowResize");
        const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
        canvas.width = this.tableView.element.offsetWidth; 
        canvas.height = this.tableView.element.offsetHeight;
        this.draw();
    }

    public reset() {
        Object.keys(this.objects).forEach((key) => {
            delete this.objects[key];
        });
        Object.keys(this.tableView.tableScene.objects).forEach((key) => {
            if (key.startsWith("ball")) 
                this.resetBall(key);
        });
    }

    public serialize() {
        let data: { [key: string]: any } = {};
        for (let k = 0; k < 16; k++) {
            const ballName = `ball_${k}`;
            data[ballName] = this.tableView.tableScene.objects[ballName].position;
        }
        for (const objName in this.objects) {
            if (objName.startsWith("arrow")) {
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
        for (let k = 0; k < 16; k++) {
            const ballName = `ball_${k}`;
            const p = new THREE.Vector3(data[ballName].x, data[ballName].y, data[ballName].z);
            this.tableView.tableScene.objects[ballName].position.copy(p);
        }
        for (const objName in data) {
            if (objName.startsWith("arrow")) {
                const arrow = new Arrow(new THREE.Vector2(), new THREE.Vector2());
                arrow.load(data[objName]);
                this.objects[objName] = arrow;
            } else if (objName.startsWith("text")) {
                const text = new Text(new THREE.Vector2(), "");
                text.load(data[objName]);
                this.objects[objName] = text;
            }
        }
        return data;
    }
}