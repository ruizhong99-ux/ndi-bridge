import { IPCReceiver } from "./ipc/IPCReceiver";
import { MockSender } from "./core/MockSender";

const config = {
  width: Number(process.env.H5_NDI_WIDTH ?? 1920),
  height: Number(process.env.H5_NDI_HEIGHT ?? 1080),
  fps: Number(process.env.H5_NDI_FPS ?? 50),
  sourceName: process.env.H5_NDI_SOURCE ?? "H5-Studio-Stream",
  port: Number(process.env.H5_NDI_PORT ?? 17890),
  queueSize: 8
};

console.log("Powered by NDI");
console.log(`H5-NDI-Bridge V1 (${config.width}x${config.height}@${config.fps})`);

let receiver: IPCReceiver | undefined;
try {
  receiver = new IPCReceiver(config, process.env.H5_NDI_MOCK === "1" ? new MockSender(config.width, config.height) : undefined);
  receiver.start();
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}

const shutdown = () => { receiver?.stop(); process.exit(0); };
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
