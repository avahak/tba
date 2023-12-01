/* Stores a diagram object and allows user to manipulate it.
*/

export {};
import { initDiagram, addArrow, addText } from "./diagram.js";

console.log("main.ts");

initDiagram();

document.getElementById("buttonAddArrow")?.addEventListener("click", () => {
    addArrow();
});

document.getElementById("buttonAddText")?.addEventListener("click", () => {
    addText();
});