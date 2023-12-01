/* Stores a diagram object and allows user to manipulate it.
*/
var _a, _b;
import { initDiagram, addArrow, addText } from "./diagram.js";
console.log("main.ts");
initDiagram();
(_a = document.getElementById("buttonAddArrow")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
    addArrow();
});
(_b = document.getElementById("buttonAddText")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
    addText();
});
