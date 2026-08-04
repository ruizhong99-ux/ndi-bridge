import { WebSocketServer, WebSocket } from "ws";
import { NDISender, VideoConfig } from "../core/NDISender";
import { FrameSender } from "../core/FrameSender";

export interface BridgeConfig extends VideoConfig { port?: number; }

export class IPCReceiver {
  private readonly server: WebSocketServer;
  private readonly sender: FrameSender;
  private client?: WebSocket;

  constructor(private readonly config: BridgeConfig, sender?: FrameSender) {
    this.sender = sender ?? new NDISender(config);
    this.server = new WebSocketServer({ port: config.port ?? 17890, host: "127.0.0.1" });
  }

  start(): void {
    this.sender.start();
    this.server.on("connection", socket => {
      this.client?.close();
      this.client = socket;
      socket.binaryType = "arraybuffer";
      socket.on("message", data => {
        try {
          this.sender.sendFrame(Buffer.from(data as Buffer));
        } catch (error) {
          socket.send(JSON.stringify({ type: "error", message: String(error) }));
        }
      });
      socket.send(JSON.stringify({ type: "ready", sourceName: this.config.sourceName }));
    });
    this.server.on("listening", () => console.error(`Bridge listening on ws://127.0.0.1:${this.config.port ?? 17890}`));
  }

  stop(): void {
    this.client?.close();
    this.server.close();
    this.sender.stop();
  }
}
