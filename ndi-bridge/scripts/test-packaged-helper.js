const { once } = require("node:events");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

function encode(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function createReader(stream) {
  let input = Buffer.alloc(0);
  const queued = [];
  const waiters = [];
  let ended = false;
  stream.on("data", chunk => {
    input = Buffer.concat([input, chunk]);
    while (input.length >= 4) {
      const length = input.readUInt32LE(0);
      if (input.length < length + 4) break;
      const message = JSON.parse(input.subarray(4, length + 4).toString("utf8"));
      input = input.subarray(length + 4);
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else queued.push(message);
    }
  });
  stream.on("end", () => {
    ended = true;
    while (waiters.length) waiters.shift()(undefined, new Error("Native Messaging host closed stdout"));
  });
  return () => {
    if (queued.length) return Promise.resolve(queued.shift());
    if (ended) return Promise.reject(new Error("Native Messaging host closed stdout"));
    return new Promise((resolve, reject) => waiters.push((message, error) => error ? reject(error) : resolve(message)));
  };
}

function waitForSocketMessage(socket) {
  return new Promise((resolve, reject) => {
    socket.once("message", data => resolve(JSON.parse(data.toString())));
    socket.once("error", reject);
  });
}

async function main() {
  const executable = path.resolve(__dirname, "../release/H5-NDI-Helper/H5-NDI-Helper.exe");
  const child = spawn(executable, [], {
    cwd: path.dirname(executable),
    env: { ...process.env, H5_NDI_PORT: "17891" },
    stdio: ["pipe", "pipe", "pipe"]
  });
  child.stderr.on("data", chunk => process.stderr.write(chunk));
  const nextNativeMessage = createReader(child.stdout);
  let socket;

  try {
    child.stdin.write(encode({ type: "start", sourceName: "H5-Studio-Packaged-Test" }));
    const started = await nextNativeMessage();
    if (started.type !== "started" || typeof started.port !== "number") throw new Error(`Unexpected start response: ${JSON.stringify(started)}`);

    socket = new WebSocket(`ws://127.0.0.1:${started.port}`);
    const ready = waitForSocketMessage(socket);
    await once(socket, "open");
    if ((await ready).type !== "ready") throw new Error("Packaged Helper WebSocket did not become ready");
    const width = 1920;
    const height = 1080;
    const frame = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      const alpha = y < height / 3 ? 0 : y < (height * 2) / 3 ? 128 : 255;
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        frame[offset] = 255;
        frame[offset + 1] = y < height / 2 ? 40 : 120;
        frame[offset + 2] = 40;
        frame[offset + 3] = alpha;
      }
    }
    socket.send(frame);
    if ((await waitForSocketMessage(socket)).type !== "frame-ack") throw new Error("Packaged Helper did not acknowledge the frame");
    socket.terminate();

    child.stdin.write(encode({ type: "stop" }));
    const stopped = await nextNativeMessage();
    if (stopped.type !== "stopped") throw new Error(`Unexpected stop response: ${JSON.stringify(stopped)}`);
    child.stdin.end();
    const [code] = await once(child, "exit");
    if (code !== 0) throw new Error(`Packaged Helper exited with code ${code}`);
    console.log("Packaged Helper smoke test passed");
  } finally {
    socket?.terminate();
    if (!child.killed) child.kill();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
