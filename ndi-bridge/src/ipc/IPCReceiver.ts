import { WebSocketServer, WebSocket } from "ws";
import { NDISender, VideoConfig } from "../core/NDISender";
import { FrameSender } from "../core/FrameSender";
import { assertRgbaFrame, expectedRgbaBytes, toFrameBuffer, WebSocketFrame } from "./FrameUtils";

export interface BridgeConfig extends VideoConfig { port?: number; authToken?: string; }

export class IPCReceiver {
  private readonly sender: FrameSender;
  private readonly port: number;
  private server?: WebSocketServer;
  private client?: WebSocket;
  private startPromise?: Promise<void>;
  private stopPromise?: Promise<void>;
  private stopRequested = false;
  private receivedFrames = 0;
  private lastFrameLog = Date.now();

  constructor(private readonly config: BridgeConfig, sender?: FrameSender) {
    this.sender = sender ?? new NDISender(config);
    this.port = config.port ?? 17890;
  }

  async start(): Promise<void> {
    if (this.stopPromise) await this.stopPromise;
    if (this.startPromise) return this.startPromise;
    this.stopRequested = false;
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } catch (error) {
      this.startPromise = undefined;
      throw error;
    }
  }

  get listeningPort(): number | undefined {
    const address = this.server?.address();
    return address && typeof address === "object" ? address.port : undefined;
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopRequested = true;
    this.stopPromise = this.stopInternal();
    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = undefined;
      this.stopRequested = false;
    }
  }

  private async stopInternal(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    this.client?.terminate();
    this.client = undefined;
    if (server) await this.closeServer(server);
    await this.sender.stop();
    await this.startPromise?.catch(() => undefined);
    this.startPromise = undefined;
  }

  private async startInternal(): Promise<void> {
    await this.sender.start();
    if (this.stopRequested) {
      await this.sender.stop();
      return;
    }
    let server: WebSocketServer | undefined;
    try {
      const activeServer = new WebSocketServer({
        port: this.port,
        host: "127.0.0.1",
        maxPayload: expectedRgbaBytes(this.config.width, this.config.height),
        verifyClient: (info, done) => {
          const token = new URL(info.req.url ?? "/", "ws://127.0.0.1").searchParams.get("token");
          const origin = info.origin;
          const validOrigin = !origin || origin === "null" || origin.startsWith("http://127.0.0.1") || origin.startsWith("http://localhost");
          done(Boolean((!this.config.authToken || token === this.config.authToken) && validOrigin), 1008, "Unauthorized WebSocket client");
        }
      });
      server = activeServer;
      this.server = activeServer;
      activeServer.on("error", error => console.error(`Bridge WebSocket error: ${String(error)}`));
      activeServer.on("connection", socket => this.handleConnection(socket));
      await new Promise<void>((resolve, reject) => {
        activeServer.once("listening", () => resolve());
        activeServer.once("error", reject);
      });
    } catch (error) {
      this.server = undefined;
      if (server) await this.closeServer(server);
      await this.sender.stop();
      throw error;
    }

    if (this.stopRequested) {
      this.server = undefined;
      await this.closeServer(server);
      await this.sender.stop();
      return;
    }

    console.error(`Bridge listening on ws://127.0.0.1:${this.listeningPort ?? this.port}`);
  }

  private handleConnection(socket: WebSocket): void {
    this.client?.terminate();
    this.client = socket;
    socket.binaryType = "arraybuffer";
    socket.on("close", () => {
      if (this.client === socket) this.client = undefined;
    });
    socket.on("error", error => console.error(`Bridge client error: ${String(error)}`));
    socket.on("message", (data, isBinary) => {
      try {
        if (!isBinary) throw new Error("Only binary RGBA frames are accepted");
        const frame = toFrameBuffer(data as WebSocketFrame);
        if (frame.length > expectedRgbaBytes(this.config.width, this.config.height)) {
          throw new Error("RGBA frame exceeds the configured frame size");
        }
        assertRgbaFrame(frame, this.config.width, this.config.height);
        const frameLength = frame.length;
        this.sender.sendFrame(frame);
        this.receivedFrames += 1;
        const now = Date.now();
        if (this.receivedFrames === 1 || now - this.lastFrameLog >= 5000) {
          console.error(`RGBA frames received: ${this.receivedFrames}, latest=${frameLength} bytes`);
          this.lastFrameLog = now;
        }
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "frame-ack" }));
      } catch (error) {
        console.error(`RGBA frame rejected: ${String(error)}`);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "error", message: String(error) }));
          socket.close(1003, "Invalid RGBA frame");
        }
      }
    });
    socket.send(JSON.stringify({ type: "ready", sourceName: this.config.sourceName }));
  }

  private closeServer(server: WebSocketServer): Promise<void> {
    if (server.address() === null) return Promise.resolve();
    return new Promise(resolve => server.close(() => resolve()));
  }
}
