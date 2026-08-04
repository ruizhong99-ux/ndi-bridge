let socket;
window.addEventListener("message", event => {
  if (event.source !== window) return;
  if (event.data?.type === "h5-ndi-frame" && socket?.readyState === WebSocket.OPEN) {
    socket.send(event.data.buffer);
  }
  if (event.data?.type === "h5-ndi-status" && event.data.status === "missing-source") {
    console.warn("H5NdiSource is not available on this page");
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message.type === "start-capture") {
    socket = new WebSocket("ws://127.0.0.1:17890");
    socket.binaryType = "arraybuffer";
    socket.onopen = () => window.postMessage({ type: "h5-ndi-command", command: "start" }, "*");
  }
  if (message.type === "stop-capture") {
    window.postMessage({ type: "h5-ndi-command", command: "stop" }, "*");
    socket?.close();
    socket = undefined;
  }
});
