/**
 * Web worker to build keyframes for animation.
 * PROBLEM: data passed to web worker needs to be serializable, but table is not...
 * TODO Kinda should separate table from tableScene...
 */
import { Table } from "./table/table.js";
import { loadJSON } from "./util.js";
import { Collision } from "./table/collision.js";
import * as THREE from 'three';
const E1 = new THREE.Vector3(1, 0, 0);
const E2 = new THREE.Vector3(0, 1, 0);
const E3 = new THREE.Vector3(0, 0, 1);
let table;
async function loadDiagram() {
    // http://localhost:5000/diagram?id=dd852d320ef3404b92759d9644b1ded7
    // const diagramURL = `http://localhost:5000/api/57c4f394a70e4a1fbe75b1bc67d70367`;
    const diagramURL = `https://vahakangasma.azurewebsites.net/diagram?id=a4aaed1b4ee344b08979f469ea74fcad`;
    try {
        loadJSON(diagramURL).then((data) => {
            if (!!data) {
                console.log("data", data);
                table.resetBalls();
                table.load(data);
                table.balls.forEach((ball) => {
                    ball.v.multiplyScalar(10);
                });
                console.log("Initial values loaded.");
                const animation = testAnimationBuilding();
                console.log("animationWorker done");
                self.postMessage({ "message": "success", "data": animation });
            }
        });
    }
    catch (error) {
        console.error('Error loading diagram:', error);
    }
}
function testAnimationBuilding() {
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
            let collisionDetected = (Collision.detectCollision(table) !== null);
            if (collisionDetected) {
                const collision = Collision.fromTable(table);
                collision === null || collision === void 0 ? void 0 : collision.resolve();
            }
            simulationTime += dt / iterNum;
            if ((collisionDetected) || (iter == 0))
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
    console.log("event", event);
    console.log("event.data", event.data);
    if (event.data.message == "init_table") {
        console.log("animationWorker: init_table");
        const cushionVertices = event.data.cushionVertices;
        const tableJson = event.data.tableJson;
        table = new Table(null, tableJson);
        Table.assignCushionVertices(cushionVertices);
        console.log("table", table);
    }
    else if (event.data.message == "load_diagram") {
        console.log("animationWorker: load_diagram");
        loadDiagram();
    }
});
