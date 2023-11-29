/**
 * Represents the state of one pool diagram.
*/
export { initDiagram };
import { TableScene, TableView } from "./tableView.js";
console.log("diagram.ts");
function initDiagram() {
    const tableScene = new TableScene();
    // tableScene.setLights("square");
    tableScene.setLights("ambient only");
    const tableView = new TableView(document.getElementById("three-box"), tableScene);
    tableView.animate();
}
