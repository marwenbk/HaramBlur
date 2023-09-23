// Create a new Web Worker.
const worker = new Worker('worker.js');

// Listen for messages from the main thread.
self.onmessage = function(e) {
  // Post a message to the Web Worker.
  worker.postMessage(e.data);
};

// Listen for messages from the Web Worker.
worker.onmessage = function(e) {
  // Post a message back to the main thread.
  self.postMessage(e.data);
};

window.addEventListener("message", (event) => {
  console.log("message received in serup.js from worker.js", event.data);
});