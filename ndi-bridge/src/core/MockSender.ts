import { FrameSender } from "./FrameSender";

export class MockSender implements FrameSender {
  private frames = 0;

  constructor(private readonly width: number, private readonly height: number) {}

  start(): void { console.error("Mock sender started; NDI DLL is not being used"); }

  sendFrame(frame: Buffer): void {
    const expected = this.width * this.height * 4;
    if (frame.length !== expected) throw new Error(`Invalid RGBA frame size: expected ${expected}, got ${frame.length}`);
    this.frames++;
    if (this.frames % 30 === 0) console.error(`Mock frames received: ${this.frames}`);
  }

  stop(): void { console.error(`Mock sender stopped after ${this.frames} frame(s)`); }
}
