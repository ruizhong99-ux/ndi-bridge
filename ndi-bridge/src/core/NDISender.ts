import ref from "ref-napi";
import { loadNDILibrary, NDILibrary } from "./DLLoader";
import {
  NDI_FOURCC_RGBA,
  NDI_FRAME_FORMAT_PROGRESSIVE,
  NDIlib_send_create_t,
  NDIlib_video_frame_v2_t,
  NDIFrame
} from "../types/ndi.types";
import { RingBuffer } from "./RingBuffer";
import { FrameSender } from "./FrameSender";
import { assertRgbaFrame } from "../ipc/FrameUtils";

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  sourceName: string;
  queueSize?: number;
}

interface PendingFrame {
  buffer: Buffer;
  descriptor: NDIFrame;
}

export class NDISender implements FrameSender {
  private readonly library: NDILibrary;
  private readonly queue: RingBuffer<PendingFrame>;
  private sender?: Buffer;
  private settings?: InstanceType<typeof NDIlib_send_create_t>;
  private sourceName?: Buffer;
  private ndiInitialized = false;
  private initialized = false;

  constructor(private readonly config: VideoConfig, library?: NDILibrary) {
    this.library = library ?? loadNDILibrary();
    this.queue = new RingBuffer(config.queueSize ?? 8);
  }

  start(): void {
    if (this.initialized) return;
    try {
      if (!this.library.NDIlib_initialize()) throw new Error("NDIlib_initialize failed");
      this.ndiInitialized = true;

      this.sourceName = ref.allocCString(this.config.sourceName);
      this.settings = new NDIlib_send_create_t();
      this.settings.p_ndi_name = this.sourceName;
      this.settings.p_groups = ref.NULL;
      this.settings.clock_video = 1;
      this.settings.clock_audio = 0;
      this.sender = this.library.NDIlib_send_create(this.settings.ref());
      if (!this.sender || ref.isNull(this.sender)) throw new Error("NDIlib_send_create failed");
      this.initialized = true;
      console.error(`NDI source started: ${this.config.sourceName}`);
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  sendFrame(frame: Buffer): void {
    if (!this.sender || !this.initialized) throw new Error("NDI sender is not started");
    assertRgbaFrame(frame, this.config.width, this.config.height);
    const video = new NDIlib_video_frame_v2_t();
    video.xres = this.config.width;
    video.yres = this.config.height;
    video.fourCC = NDI_FOURCC_RGBA;
    video.frame_rate_N = this.config.fps;
    video.frame_rate_D = 1;
    video.picture_aspect_ratio = this.config.width / this.config.height;
    video.frame_format_type = NDI_FRAME_FORMAT_PROGRESSIVE;
    video.timecode = 0;
    // ref.address validates that the Buffer has a live native address; assigning the
    // Buffer itself makes the struct field contain that address, without a memcpy.
    if (!ref.address(frame)) throw new Error("RGBA frame has no native address");
    video.p_data = frame;
    video.line_stride_in_bytes = this.config.width * 4;
    video.p_metadata = ref.NULL;
    // Let NDI generate its own 100-ns timestamp. Date.now() is milliseconds.
    video.timestamp = 0;
    // Keep both the pixels and the descriptor alive while async NDI may read them.
    this.library.NDIlib_send_send_video_async_v2(this.sender, video.ref());
    this.queue.push({ buffer: frame, descriptor: video });
  }

  stop(): void {
    this.cleanup();
  }

  private cleanup(): void {
    const sender = this.sender;
    this.sender = undefined;
    try {
      if (sender) this.library.NDIlib_send_destroy(sender);
    } finally {
      this.queue.clear();
      this.settings = undefined;
      this.sourceName = undefined;
      if (this.ndiInitialized) {
        this.ndiInitialized = false;
        this.library.NDIlib_destroy();
      }
      this.initialized = false;
    }
  }
}
