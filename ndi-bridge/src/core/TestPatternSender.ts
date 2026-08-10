import { NDISender, VideoConfig } from "./NDISender";
import { FrameSender } from "./FrameSender";

// SMPTE-style 75% bars with a moving white marker in the lower band.
export class TestPatternSender implements FrameSender {
  private readonly sender: FrameSender;
  private timer?: NodeJS.Timeout;
  private frameNumber = 0;

  constructor(private readonly config: VideoConfig, sender?: FrameSender) { this.sender = sender ?? new NDISender(config); }

  start(): void {
    if (this.timer) return;
    this.sender.start();
    const interval = 1000 / this.config.fps;
    this.send();
    this.timer = setInterval(() => this.send(), interval);
    console.error(`SMPTE color bars started: ${this.config.sourceName}`);
  }

  sendFrame(_frame: Buffer): void { throw new Error("TestPatternSender does not accept external frames"); }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.sender.stop();
    console.error("SMPTE color bars stopped");
  }

  private send(): void {
    try { this.sender.sendFrame(this.createFrame()); this.frameNumber++; }
    catch (error) { console.error(`Color bars frame failed: ${String(error)}`); this.stop(); }
  }

  private createFrame(): Buffer {
    const { width, height } = this.config;
    const frame = Buffer.allocUnsafe(width * height * 4);
    const bars = [[191, 191, 191], [191, 191, 0], [0, 191, 191], [0, 191, 0], [191, 0, 191], [191, 0, 0], [0, 0, 191], [0, 0, 0]];
    const barWidth = width / bars.length;
    const lowerStart = Math.floor(height * 0.75);
    const markerX = (this.frameNumber * 8) % width;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r; let g; let b;
        if (y < lowerStart) [r, g, b] = bars[Math.min(bars.length - 1, Math.floor(x / barWidth))];
        else if (y < Math.floor(height * 0.875)) {
          const lower = [[0, 0, 191], [19, 19, 19], [191, 191, 191], [19, 19, 19], [191, 191, 191], [19, 19, 19], [191, 191, 191], [19, 19, 19]];
          [r, g, b] = lower[Math.min(lower.length - 1, Math.floor(x / barWidth))];
        } else {
          const level = Math.floor((x / Math.max(1, width - 1)) * 255);
          r = level; g = level; b = level;
        }
        if (Math.abs(x - markerX) < Math.max(2, Math.floor(width / 240)) && y >= lowerStart) { r = 255; g = 255; b = 255; }
        const offset = (y * width + x) * 4;
        frame[offset] = r; frame[offset + 1] = g; frame[offset + 2] = b; frame[offset + 3] = 255;
      }
    }
    return frame;
  }
}
