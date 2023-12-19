"use strict";
/**
 * NOT IMPLEMENTED.
 *
 * NOTE! Web workers are limited with imports and can only communicate
 * with the main thread via serialized messages or SharedArrayBuffer:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.
 *
 * Importing three.js can be done with
 * `importScripts('/node_modules/three/build/three.js');`
 * and this allows `let p = new THREE.Vector3();`, etc.
 *
 * However, writing collision.js, ball.js, table.js in a way that they can be both be
 * imported in a web worker and used normally could be tricky.
 *
 * NOTE! The imports are loaded again (non-cached) every time a new web worker is created
 * so have to reuse the same worker to avoid reloading three.js every time.
 *
 * Possible alternative: write custom task handler/threading just for physics loop:
 *    - store the state of the execution using some structure
 *    - rewrite heavy computations (i.e. Collision.resolve) so that they can be
 *      executed in multiple consecutive calls.
 *    - Use `window.requestIdleCallback()`, see:
 *      https://discourse.threejs.org/t/web-workers-in-3d-web-applications/5674/4
 *      to advance the execution and track elapsed time using performance.now(),
 *      and stop execution after a small time period.
 */
console.log("webWorkerTest.ts");
importScripts('/node_modules/three/build/three.js');
let table;
function testAnimationBuilding(table) {
    const data = {};
    let startTime = performance.now() / 1000;
    let MAX_SIMULATION_TIME = 10;
    let simulationTime = 0;
    let allStopped = false;
    while ((!allStopped) && (simulationTime < MAX_SIMULATION_TIME)) {
        const dt = 0.1;
        let iterNum = Math.max(Math.floor(dt / 0.0001), 1);
        for (let iter = 0; iter < iterNum; iter++) {
            for (let k = 0; k < 16; k++)
                table.balls[k].advanceTime(dt / iterNum);
            let collision = table.handleCollisions();
            simulationTime += dt / iterNum;
            if ((collision) || (iter == 0))
                data[simulationTime] = table.ballPositions();
        }
        // Stop out of bounds balls:
        for (let k = 0; k < 16; k++) {
            if (table.balls[k].outOfBounds()) {
                table.balls[k].reset();
                table.balls[k].stop();
            }
        }
        // for (let k = 0; k < 16; k++) 
        //     table.balls[k].updatePositionToScene();
        // Check if all balls have stopped:
        allStopped = true;
        for (let k = 0; k < 16; k++)
            if (!table.balls[k].isStopped)
                allStopped = false;
    }
    const elapsed = performance.now() / 1000 - startTime;
    console.log("Elapsed:", elapsed);
    console.log("datapoints:", Object.keys(data).length);
    const jsonString = JSON.stringify(data);
    console.log("string length:", jsonString.length);
    console.log(Object.keys(data));
    console.log(data[parseFloat(Object.keys(data)[10])]);
}
self.addEventListener('message', (event) => {
    self.postMessage({ "message": "start" });
    console.log("webWorkerTest: message:", event.data.message);
    if (event.data.message == "init_table") {
        console.log("webWorkerTest: init_table");
        table = event.data.table;
        console.log("webWorkerTest: table", table);
        // const table2 = new Table(null, table.jsonAll);
        // console.log("table2", table2);
        console.log("webWorkerTest: ball_0", table.balls[0]);
        // @ts-ignore
        let p = new THREE.Vector3(3, 4, 5);
        console.log("p", p);
    }
    else if (event.data.message == "run") {
        testAnimationBuilding(table); // Does not work since table is not deserialized
        console.log("webWorkerTest: run done");
    }
});
