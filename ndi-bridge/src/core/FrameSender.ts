export interface FrameSender {
  start(): void;
  sendFrame(frame: Buffer): void;
  stop(): void;
}
