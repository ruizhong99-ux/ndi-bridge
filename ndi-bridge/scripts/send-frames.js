const WebSocket = require("ws");
const width = Number(process.env.H5_NDI_WIDTH || 1920);
const height = Number(process.env.H5_NDI_HEIGHT || 1080);
const socket = new WebSocket(`ws://127.0.0.1:${process.env.H5_NDI_PORT || 17890}`);
const frameInterval = 1000 / Number(process.env.H5_NDI_FPS || 50);
const frame = Buffer.alloc(width * height * 4);
let frameInFlight = false;
let lastFrameAt = 0;
let timer;

for (let i = 0; i < frame.length; i += 4) {
  frame[i] = 255;
  frame[i + 1] = 40;
  frame[i + 2] = 40;
  frame[i + 3] = (i / 4) % 256;
}

function scheduleFrame() {
  clearTimeout(timer);
  const delay = Math.max(0, frameInterval - (Date.now() - lastFrameAt));
  timer = setTimeout(sendFrame, delay);
}

function sendFrame() {
  if (socket.readyState !== WebSocket.OPEN || frameInFlight) return;
  frameInFlight = true;
  lastFrameAt = Date.now();
  socket.send(frame);
}

socket.on("open", () => {
  sendFrame();
});
socket.on("message", data => {
  const message = JSON.parse(data.toString());
  if (message.type === "frame-ack") {
    frameInFlight = false;
    scheduleFrame();
  } else if (message.type === "error") {
    console.error(message.message);
  }
});
socket.on("close", () => clearTimeout(timer));
socket.on("error", error => { console.error(error); process.exitCode = 1; });
process.once("SIGINT", () => socket.close());
