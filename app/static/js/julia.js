var _a;
import * as THREE from 'three';
// Setup variables
let scene;
let camera;
let renderer;
let mouse = { x: 0, y: 0 };
let juliaShaderMaterial;
// Initialize scene
scene = new THREE.Scene();
// Create a camera
camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 1;
// Create a WebGL renderer
renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
(_a = document.getElementById("webgl-container")) === null || _a === void 0 ? void 0 : _a.appendChild(renderer.domElement);
// Create the Julia set shader
const juliaVertexShader = `
    void main() {
        gl_Position = vec4(position, 1.0);
    }
`;
const juliaFragmentShader = `
    uniform vec2 mouse;
    uniform vec2 resolution;
    void main() {
        vec2 c = vec2(mouse.x, mouse.y);
        vec2 z = 2.0*vec2(1.2, 1.0)*gl_FragCoord.xy / resolution - 1.0;
        int N = 4000;
        vec2 w = vec2(1.0, 0.0);
        int i;
        int w_overflow = 0;
        for (i = 0; i < N; i++) {
            w = 2.0*vec2(z.x*w.x-z.y*w.y, z.x*w.y+z.y*w.x);
            z = vec2(z.x*z.x-z.y*z.y, 2.0*z.x*z.y) + c;

            w_overflow = (dot(w, w) > 1.0e16 ? 1 : w_overflow);
            if (length(z) >= 10.0)
                break;
        }
        if (i == N) {
            // case 0 (inside)
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }
        if (w_overflow == 1) {
            // case -1 (overflow)
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
            return;
        }
        float dist = 2.0*length(z)/length(w)*log(length(z));
        float log_dist = log(dist);
        float threshold = -5.0;
        if (log_dist < threshold) {
            // case 1 (dist < DELTA)
            float col = (log_dist / (threshold + log_dist))*2.0 - 1.0;
            // col = 1.0/(exp(1.0/col)-1.0);
            col = pow(col, 0.5);
            gl_FragColor = vec4(col, col, col, 1.0);
            return;
        }
        // case 2 (outside)
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
`;
console.log(window.innerWidth, window.innerHeight);
juliaShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        mouse: { value: new THREE.Vector2() },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: juliaVertexShader,
    fragmentShader: juliaFragmentShader
});
// Create a quad to render the Julia set
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
// const vertices = new Float32Array([
//     -1, -1,
//     1, -1,
//     -1,  1,
//     1,  1
// ]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
const quad = new THREE.Mesh(geometry, juliaShaderMaterial);
scene.add(quad);
function move(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = -2.0 + 4.0 * (clientX - rect.left) / rect.width;
    mouse.y = 1.0 - 2.0 * (clientY - rect.top) / rect.height;
    juliaShaderMaterial.uniforms.mouse.value = new THREE.Vector2(mouse.x, mouse.y);
    requestAnimationFrame(animate);
}
// Handle mouse movement
document.addEventListener('mousemove', (event) => {
    move(event.clientX, event.clientY);
});
document.addEventListener('touchstart', (event) => {
    let firstTouch = event.touches[0];
    move(firstTouch.clientX, firstTouch.clientY);
});
document.addEventListener('touchmove', (event) => {
    let firstTouch = event.touches[0];
    move(firstTouch.clientX, firstTouch.clientY);
    event.preventDefault();
});
// Animate the scene
function animate() {
    renderer.render(scene, camera);
}
animate();
