import { IPCReceiver } from "./ipc/IPCReceiver";
import { MockSender } from "./core/MockSender";
import { readBridgeConfig } from "./config";

const config = readBridgeConfig();

console.log("Powered by NDI");
console.log(`H5-NDI-Bridge V1 (${config.width}x${config.height}@${config.fps})`);

let receiver: IPCReceiver | undefined;
let shuttingDown = false;

async function main(): Promise<void> {
  let next: IPCReceiver | undefined;
  try {
    next = new IPCReceiver(config, process.env.H5_NDI_MOCK === "1" ? new MockSender(config.width, config.height) : undefined);
    receiver = next;
    await next.start();
  } catch (error) {
    console.error(String(error));
    await next?.stop().catch(() => undefined);
    process.exitCode = 1;
  }
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await receiver?.stop().catch(() => undefined);
  process.exit(0);
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
void main().catch(error => {
  console.error(String(error));
  process.exitCode = 1;
});
