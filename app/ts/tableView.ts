/**
 * Contains TableView classe. TableView handles drawing the scene.
 */

export { TableView };
import { TableScene } from "./tableScene.js";
import * as THREE from 'three';
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
// import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
// import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

console.log("tableView.ts");

/**
 * TableView handles rendering of the TableScene.
 */
class TableView {
	public cameraPerspective: THREE.PerspectiveCamera;
	public cameraOrthographic: THREE.OrthographicCamera;
	public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
	public tableScene: TableScene;
	public renderer: THREE.WebGLRenderer;
	public element: HTMLElement;

	public cameraAnimates: boolean;
	public renderCallback: (() => void) | null;

	constructor(element: HTMLElement, tableScene: TableScene) {
		this.onWindowResize = this.onWindowResize.bind(this); // Ensure the correct 'this' inside onWindowResize
		this.animate = this.animate.bind(this);	// Ensure the correct 'this' inside animate

		this.element = element;
		this.tableScene = tableScene;
		this.cameraPerspective = new THREE.PerspectiveCamera(40, 1.0, 0.1, 1000);
		this.cameraOrthographic = new THREE.OrthographicCamera(-1.0, 1.0, 1.0, -1.0, 0.1, 1000.0);
		for (const cam of [this.cameraPerspective, this.cameraOrthographic]) {
			cam.position.set(0, 0, 3.5);
			cam.lookAt(0.0, 0.0, 0.0);
		}
		this.camera = this.cameraOrthographic;
		this.cameraAnimates = false;
		this.renderCallback = null;

		this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio * 2);
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.setSize(this.element.offsetWidth, this.element.offsetHeight);

		this.element.appendChild(this.renderer.domElement);

		window.addEventListener('resize', this.onWindowResize);
		this.onWindowResize();
	}

	public setCamera(name: string) {
		this.cameraAnimates = false;
		if (name == "orthographic") {
			this.camera = this.cameraOrthographic;
			this.camera.position.set(0, 0, 3.5);
			this.camera.up.set(0, 1, 0);
			this.camera.lookAt(0.0, 0.0, -0.25);
			this.tableScene.setLights("ambient");
			if (!!this.tableScene.cushionEdgeCylinders)
				this.tableScene.cushionEdgeCylinders.visible = true;
		} else if (name == "perspective") {
			this.camera = this.cameraPerspective;
			this.cameraAnimates = true;
			this.tableScene.setLights("square");
			if (!!this.tableScene.cushionEdgeCylinders)
				this.tableScene.cushionEdgeCylinders.visible = false;
		} else if (name == "back") {
			this.camera = this.cameraPerspective;
			this.camera.position.set(-2.2, 0.0, 1.1);
			this.camera.up.set(0, 0, 1);
			this.camera.lookAt(0.0, 0.0, -0.45);
			this.tableScene.setLights("square");
			if (!!this.tableScene.cushionEdgeCylinders)
				this.tableScene.cushionEdgeCylinders.visible = false;
		}
		this._render();
	}

	public _render() {
		this.renderer.render(this.tableScene.scene, this.camera);
	}

	public animate() {
		const time = performance.now()/1000;

		if (this.cameraAnimates) {
			this.camera.position.set(2.2*Math.cos(time/10), 2.2*Math.sin(time/10), 1.3);
			this.camera.up.set(0, 0, 1);
			this.camera.lookAt(0.0, 0.0, -0.2);
		}
	
		this._render();
		if (!!this.renderCallback)
			this.renderCallback();
		requestAnimationFrame(this.animate);
	}

	public onWindowResize() {
		const container = this.element;
		const aspect = container.offsetWidth / container.offsetHeight;

		this.cameraOrthographic.left = -aspect;
		this.cameraOrthographic.right = aspect;
		this.cameraOrthographic.updateProjectionMatrix();

		this.cameraPerspective.aspect = aspect;
		this.cameraPerspective.updateProjectionMatrix();

		this.renderer.setSize(container.offsetWidth, container.offsetHeight);
	}
}