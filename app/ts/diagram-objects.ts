/**
 * Handles states of movable objects of the diagram.
 */

export { Text, Arrow, Ball, ObjectCollection }
import { TableScene, TableView } from "./tableView.js";
import { canvasTextBoundingBox } from "./util.js";
import * as THREE from 'three';

console.log("diagram-objects.ts")

class Arrow {
    public p1: THREE.Vector2;
    public p2: THREE.Vector2;
    public width: number;
    public type: string;

    constructor(p1: THREE.Vector2, p2: THREE.Vector2) {
        this.p1 = p1;
        this.p2 = p2;
        this.width = 1.0;
        this.type = "";
    }

    public closestPoint(p: THREE.Vector2): THREE.Vector2 {
        const line = new THREE.Line3(new THREE.Vector3(this.p1.x, this.p1.y, 0.0), new THREE.Vector3(this.p2.x, this.p2.y, 0.0));
        const q = line.closestPointToPoint(new THREE.Vector3(p.x, p.y, 0.0), true, new THREE.Vector3());
        return new THREE.Vector2(q.x, q.y);
    }
}

class Text {
    public p: THREE.Vector2;
    public size: number;
    public text: string;

    constructor(p: THREE.Vector2, text: string) {
        this.p = p;
        this.size = 1.0;
        this.text = text;
    }

    public closestPoint(p: THREE.Vector2): THREE.Vector2 {
        // should calculate from canvas element probably
        return new THREE.Vector2(0.0, 0.0);
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
    public objects: {};

    constructor(tableView: TableView) {
        this.onWindowResize = this.onWindowResize.bind(this); // Ensure the correct 'this' inside onWindowResize
        this.tableView = tableView;
        this.objects = {};
        window.addEventListener('resize', this.onWindowResize);
		this.onWindowResize();
    }

    /**
     * Returns point on plane z=height where ray from camera to mouse intersects it.
     */
    public mouseToWorld(nMouse: THREE.Vector2, height: number) {
        const rect = this.tableView.element.getBoundingClientRect();
		const mouse3D = new THREE.Vector3(nMouse.x, nMouse.y, 0.0);
        let cameraDir = this.tableView.camera.getWorldDirection(new THREE.Vector3());
		let a = mouse3D.unproject(this.tableView.camera);
        if (this.tableView.camera instanceof THREE.OrthographicCamera)
            a = new THREE.Vector3(a.x, a.y, 2.0);
        else 
            a = a.clone().sub(this.tableView.camera.position).normalize();
		let ray = new THREE.Ray(this.tableView.camera.position, a);
        if (this.tableView.camera instanceof THREE.OrthographicCamera)
            ray = new THREE.Ray(a, cameraDir);
		const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -height);
		let intersect = new THREE.Vector3();
		ray.intersectPlane(plane, intersect);
        return intersect;
    }

    public getObject(nMouse: THREE.Vector2): any {
        let obj = this.tableView.tableScene.findObjectNameOnMouse(nMouse, this.tableView.camera);
		if ((!!obj) && obj.startsWith("ball_"))
            return obj;
    }

    public draw() {
        const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Example: Draw an arrow on the overlay canvas
        let t = Math.random();
        ctx.beginPath();
        ctx.moveTo(250+100*t, 250);
        ctx.lineTo(350, 350);
        ctx.lineTo(300, 350);
        ctx.lineTo(350, 300);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.closePath();

        const fonts = [
            'Arial',
            'Helvetica',
            'Roboto',
            'Open Sans',
            'Lato',
            'Times New Roman',
            'Garamond',
            'Georgia',
            'Merriweather',
            'PT Serif'
        ];
        const randomIndex = Math.floor(Math.random() * fonts.length);
        const fontName = fonts[randomIndex];


        let size = Math.round(50+50*Math.random());
        ctx.font = `${size}px ${fontName}`;
        ctx.fillStyle = '#ffff00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let x = 800;
        let y = 350;
        let text = 'Hello, world! ' + fontName;
        ctx.fillText(text, x, y);
        let bbox = canvasTextBoundingBox(ctx, text, x, y);

        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(bbox[0], bbox[1], bbox[2], bbox[3]);
        ctx.stroke();
    }

    public onWindowResize() {
        console.log("diagram-objects: onWindowResize");
        const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
        canvas.width = this.tableView.element.offsetWidth; 
        canvas.height = this.tableView.element.offsetHeight;
        this.draw();
    }
}