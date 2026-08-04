import { IPCReceiver } from "./ipc/IPCReceiver";

let receiver: IPCReceiver | undefined;
let input = Buffer.alloc(0);

function send(message: unknown): void {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

function handle(message: { type?: string; sourceName?: string }): void {
  if (message.type === "start" && !receiver) {
    receiver = new IPCReceiver({
      width: Number(process.env.H5_NDI_WIDTH ?? 1920),
      height: Number(process.env.H5_NDI_HEIGHT ?? 1080),
      fps: Number(process.env.H5_NDI_FPS ?? 50),
      sourceName: message.sourceName ?? process.env.H5_NDI_SOURCE ?? "H5-Studio-Stream",
      port: Number(process.env.H5_NDI_PORT ?? 17890),
      queueSize: 8
    });
    receiver.start();
    send({ type: "started" });
  } else if (message.type === "stop") {
    receiver?.stop();
    receiver = undefined;
    send({ type: "stopped" });
  }
}

process.stdin.on("data", chunk => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const length = input.readUInt32LE(0);
    if (input.length < length + 4) return;
    const body = input.subarray(4, length + 4).toString("utf8");
    input = input.subarray(length + 4);
    try { handle(JSON.parse(body)); } catch (error) { send({ type: "error", message: String(error) }); }
  }
});

process.stdin.on("end", () => { receiver?.stop(); process.exit(0); });
console.error("Powered by NDI");
