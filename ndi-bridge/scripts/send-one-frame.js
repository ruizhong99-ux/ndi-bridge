const WebSocket = require("ws");

const width = Number(process.env.H5_NDI_WIDTH || 1920);
const height = Number(process.env.H5_NDI_HEIGHT || 1080);
const port = Number(process.env.H5_NDI_PORT || 17890);
const frame = Buffer.alloc(width * height * 4);

for (let i = 0; i < frame.length; i += 4) {
  frame[i] = 255;
  frame[i + 1] = (i / 4) % 256;
  frame[i + 2] = 40;
  frame[i + 3] = (i / 4) % 256;
}

const socket = new WebSocket(`ws://127.0.0.1:${port}`);
socket.on("message", data => {
  const message = JSON.parse(data.toString());
  console.log(JSON.stringify(message));
  if (message.type === "ready") socket.send(frame);
  if (message.type === "frame-ack") socket.terminate();
});
socket.on("close", () => process.exit(0));
socket.on("error", error => {
  console.error(error);
  process.exitCode = 1;
});
