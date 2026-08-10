export interface FrameSender {
  start(): void | Promise<void>;
  sendFrame(frame: Buffer): void;
  stop(): void | Promise<void>;
}
