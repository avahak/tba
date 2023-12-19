self.addEventListener('message', (event) => {
    // const p = new THREE.Vector3(5, 6, 7);
    self.postMessage({ "message": "start", "data": "test" });
    console.log("workerTest: event.data", event.data);
});
export {};
