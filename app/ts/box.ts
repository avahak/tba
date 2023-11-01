import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// const geometry = new THREE.BoxGeometry(1, 1.5, 2);
// const colors = [0x990000, 0x009900, 0x000099, 0x999900, 0x990099, 0x009999];
// const materials = colors.map(color => new THREE.MeshBasicMaterial({ color }));
// const geometry = new THREE.DodecahedronGeometry(1.0);
const geometry = new THREE.TorusGeometry(1.0, 0.4, 30, 100);
const material = new THREE.MeshNormalMaterial();
// const material = new THREE.MeshDepthMaterial();
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.set(0, 0, 5);

// Load the cube texture
const cubeTextureLoader = new THREE.CubeTextureLoader();
const [folder, ext] = ["../static/images/stars/", ".jpg"];
// const [folder, ext] = ["../static/images/regions/", ".png"];
const cubeMapTexture = cubeTextureLoader.load([
	`${folder}posx${ext}`, `${folder}negx${ext}`, `${folder}posy${ext}`, 
	`${folder}negy${ext}`, `${folder}posz${ext}`, `${folder}negz${ext}`
]);
scene.background = cubeMapTexture; // Set the cube map as the background

// Create and configure OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enableDamping = true; // Add damping for smoother movement
controls.dampingFactor = 0.05;
controls.rotateSpeed = 1.0;

function animate() {
	requestAnimationFrame(animate);
	controls.update(); // Update orbit controls
	renderer.render(scene, camera);
}

animate();