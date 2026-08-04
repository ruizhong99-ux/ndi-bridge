const WebSocket = require("ws");
const width = Number(process.env.H5_NDI_WIDTH || 1920);
const height = Number(process.env.H5_NDI_HEIGHT || 1080);
const socket = new WebSocket(`ws://127.0.0.1:${process.env.H5_NDI_PORT || 17890}`);
socket.on("open", () => {
  const frame = Buffer.alloc(width * height * 4);
  for (let i = 0; i < frame.length; i += 4) {
    frame[i] = 255;
    frame[i + 1] = 40;
    frame[i + 2] = 40;
    frame[i + 3] = (i / 4) % 256;
  }
  setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(frame); }, 1000 / Number(process.env.H5_NDI_FPS || 30));
});
socket.on("error", error => { console.error(error); process.exitCode = 1; });
