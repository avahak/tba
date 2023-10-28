"use strict";

import * as THREE from 'three';

function init_element(element) {
    // Create a scene
    jsGlobals.scene = new THREE.Scene();

    // Create a WebGL renderer
    jsGlobals.renderer = new THREE.WebGLRenderer();
    jsGlobals.renderer.setSize(200, 100);
    jsGlobals.element = document.getElementById('widget-container');
    jsGlobals.element.appendChild(jsGlobals.renderer.domElement);

    jsGlobals.plane = null;
    // Load the image as a texture
    let textureLoader = new THREE.TextureLoader();
    let texture = textureLoader.load(`static/images/${jsGlobals.element.dataset.jsImage}`, (tex) => {
        let aspect = tex.image.width/tex.image.height;
        jsGlobals.camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 1000);
        jsGlobals.camera.position.z = 1;

        // Create a plane geometry to display the image
        let geometry = new THREE.PlaneGeometry(2*aspect, 2);
        let material = new THREE.MeshBasicMaterial({ map: texture });
        jsGlobals.plane = new THREE.Mesh(geometry, material);
        jsGlobals.plane.position.x = 0.0;
        jsGlobals.plane.position.y = 0.0;
        jsGlobals.scene.add(jsGlobals.plane);

        jsGlobals.renderer.render(jsGlobals.scene, jsGlobals.camera);    
    });

    // Add a click event listener to the renderer
    jsGlobals.renderer.domElement.addEventListener('click', onMouseClick, false);
}

// Function to handle mouse click
function onMouseClick(event) {
    console.log(event.clientX, event.clientY);
    let x = (event.clientX / 100) * 2 - 2;
    let y = -(event.clientY / 100) * 2 + 1;

    if (jsGlobals.plane) {
        // Move the center of the image to the mouse position
        jsGlobals.plane.position.x = x;
        jsGlobals.plane.position.y = y;
    }

    // Render the scene after the click
    jsGlobals.renderer.render(jsGlobals.scene, jsGlobals.camera);
}

if (globalThis.hasOwnProperty("jsGlobals")) {
    console.log("jsGlobals IS defined");
} else {
    console.log("jsGlobals IS NOT defined");
    globalThis.jsGlobals = { elements: {} };
}

init_element();



/* EMBEDDING BEST PRACTICES:
<!DOCTYPE html>
<html>
<head>
    <title>Embedding Widgets</title>
</head>
<body>
    <!-- First instance of the widget -->
    <div id="widget-container1" data-js-image="cat1.jpg"></div>

    <!-- Second instance of the widget with a different image -->
    <div id="widget-container2" data-js-image="dog.jpg"></div>

    <!-- Include Three.js from a CDN with the async attribute -->
    <script async src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" onload="initializeWidget()"></script>

    <!-- Include your widget JavaScript file from your fictional website with the defer attribute -->
    <script defer type="module" src="https://www.mywidgetexample.com/static/js/widget.js"></script>
</body>
</html>

for TS change package.json:
"scripts": {
    "start": "npx npm-run-all -p compile-typescript minify-watch",
    "compile-typescript": "tsc -w -p src/tsconfig.json",
    "minify": "npx terser --compress --mangle --output static/js/[name].min.js src/[name].js",
    "minify-watch": "npx nodemon --watch src --ext js --exec \"npm run minify\"",
}

*/