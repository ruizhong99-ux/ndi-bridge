import { IPCReceiver } from "./ipc/IPCReceiver";
import { assertVideoConfig, readBridgeConfig } from "./config";
import { MockSender } from "./core/MockSender";
import { TestPatternSender } from "./core/TestPatternSender";
import { VideoConfig } from "./core/NDISender";
import { randomBytes } from "node:crypto";

let receiver: IPCReceiver | undefined;
let activeAuthToken: string | undefined;
let testSender: TestPatternSender | undefined;
let input = Buffer.alloc(0);
let commandQueue = Promise.resolve();
let shuttingDown = false;
const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;

function send(message: unknown): void {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

async function handle(message: unknown): Promise<void> {
  if (!message || typeof message !== "object") throw new Error("Invalid Native Messaging message");
  const command = message as { type?: unknown; sourceName?: unknown; width?: unknown; height?: unknown; fps?: unknown };

  if (command.type === "start") {
    if (receiver) {
      send({ type: "started", port: receiver.listeningPort, token: activeAuthToken });
      return;
    }
    testSender?.stop();
    testSender = undefined;

    const authToken = randomBytes(32).toString("hex");
    const config = readBridgeConfig(
      typeof command.sourceName === "string" ? command.sourceName : undefined,
      { width: typeof command.width === "number" ? command.width : undefined, height: typeof command.height === "number" ? command.height : undefined, fps: typeof command.fps === "number" ? command.fps : undefined },
      authToken
    );
    const sender = process.env.H5_NDI_MOCK === "1" ? new MockSender(config.width, config.height) : undefined;
    const next = new IPCReceiver(config, sender);
    try {
      await next.start();
      receiver = next;
      activeAuthToken = authToken;
      send({ type: "started", port: next.listeningPort, token: authToken });
    } catch (error) {
      await next.stop().catch(() => undefined);
      throw error;
    }
    return;
  }

  if (command.type === "stop") {
    const current = receiver;
    receiver = undefined;
    activeAuthToken = undefined;
    await current?.stop();
    testSender?.stop();
    testSender = undefined;
    send({ type: "stopped" });
    return;
  }

  if (command.type === "test-bars") {
    const video: VideoConfig = {
      width: typeof command.width === "number" ? command.width : 1920,
      height: typeof command.height === "number" ? command.height : 1080,
      fps: typeof command.fps === "number" ? command.fps : 50,
      sourceName: typeof command.sourceName === "string" ? command.sourceName : "H5-Studio-Stream"
    };
    assertVideoConfig(video);
    const current = receiver;
    receiver = undefined;
    activeAuthToken = undefined;
    await current?.stop();
    testSender?.stop();
    testSender = new TestPatternSender(video, process.env.H5_NDI_MOCK === "1" ? new MockSender(video.width, video.height) : undefined);
    try {
      testSender.start();
      send({ type: "test-started" });
    } catch (error) {
      testSender.stop();
      testSender = undefined;
      throw error;
    }
    return;
  }

  throw new Error(`Unknown Native Messaging command: ${String(command.type)}`);
}

function enqueue(message: unknown): void {
  commandQueue = commandQueue.then(async () => {
    try {
      await handle(message);
    } catch (error) {
      send({ type: "error", message: String(error) });
    }
  });
}

process.stdin.on("data", chunk => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const length = input.readUInt32LE(0);
    if (length > MAX_NATIVE_MESSAGE_BYTES) {
      input = Buffer.alloc(0);
      send({ type: "error", message: "Native Messaging message is too large" });
      return;
    }
    if (input.length < length + 4) return;
    const body = input.subarray(4, length + 4).toString("utf8");
    input = input.subarray(length + 4);
    try {
      enqueue(JSON.parse(body));
    } catch (error) {
      send({ type: "error", message: String(error) });
    }
  }
});

async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await commandQueue;
  const current = receiver;
  receiver = undefined;
  await current?.stop().catch(() => undefined);
  process.exit(0);
}

process.stdin.on("end", () => { void shutdown(); });
console.error("Powered by NDI");
