import ref from "ref-napi";
import { loadNDILibrary, NDILibrary } from "./DLLoader";
import {
  NDI_FOURCC_RGBA,
  NDI_FRAME_FORMAT_PROGRESSIVE,
  NDIlib_send_create_t,
  NDIlib_video_frame_v2_t
} from "../types/ndi.types";
import { RingBuffer } from "./RingBuffer";
import { FrameSender } from "./FrameSender";

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  sourceName: string;
  queueSize?: number;
}

export class NDISender implements FrameSender {
  private readonly library: NDILibrary;
  private readonly queue: RingBuffer<Buffer>;
  private sender?: Buffer;
  private settings?: InstanceType<typeof NDIlib_send_create_t>;
  private initialized = false;

  constructor(private readonly config: VideoConfig) {
    this.library = loadNDILibrary();
    this.queue = new RingBuffer(config.queueSize ?? 8);
  }

  start(): void {
    if (this.initialized) return;
    if (!this.library.NDIlib_initialize()) throw new Error("NDIlib_initialize failed");

    const name = ref.allocCString(this.config.sourceName);
    this.settings = new NDIlib_send_create_t();
    this.settings.p_ndi_name = name;
    this.settings.p_groups = ref.NULL;
    this.settings.clock_video = 1;
    this.settings.clock_audio = 0;
    this.sender = this.library.NDIlib_send_create(this.settings.ref());
    if (!this.sender || ref.isNull(this.sender)) {
      this.library.NDIlib_destroy();
      throw new Error("NDIlib_send_create failed");
    }
    this.initialized = true;
    console.error(`NDI source started: ${this.config.sourceName}`);
  }

  sendFrame(frame: Buffer): void {
    if (!this.sender || !this.initialized) throw new Error("NDI sender is not started");
    const expected = this.config.width * this.config.height * 4;
    if (frame.length !== expected) throw new Error(`Invalid RGBA frame size: expected ${expected}, got ${frame.length}`);

    // Keep the Buffer strongly referenced in the ring for the async NDI call.
    this.queue.push(frame);
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
    video.timestamp = Date.now();
    this.library.NDIlib_send_send_video_async_v2(this.sender, video.ref());
  }

  stop(): void {
    if (this.sender) this.library.NDIlib_send_destroy(this.sender);
    this.sender = undefined;
    this.queue.clear();
    this.settings = undefined;
    if (this.initialized) this.library.NDIlib_destroy();
    this.initialized = false;
  }
}
