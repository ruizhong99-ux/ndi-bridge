import type { BridgeConfig } from "./ipc/IPCReceiver";

const DEFAULT_SOURCE = "H5-Studio-Stream";
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 50;
const DEFAULT_PORT = 17890;
const MAX_FRAME_BYTES = 256 * 1024 * 1024;

function positiveInt(value: string | undefined, fallback: number, allowZero = false): number {
  const parsed = Number(value ?? fallback);
  const minimum = allowZero ? 0 : 1;
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

export function readBridgeConfig(sourceName?: string, video?: Partial<Pick<BridgeConfig, "width" | "height" | "fps" | "scanMode">>, authToken?: string): BridgeConfig {
  const configuredName = sourceName ?? process.env.H5_NDI_SOURCE ?? DEFAULT_SOURCE;
  let width = positiveInt(video?.width === undefined ? process.env.H5_NDI_WIDTH : String(video.width), DEFAULT_WIDTH);
  let height = positiveInt(video?.height === undefined ? process.env.H5_NDI_HEIGHT : String(video.height), DEFAULT_HEIGHT);
  if (!Number.isSafeInteger(width * height * 4) || width * height * 4 > MAX_FRAME_BYTES) {
    width = DEFAULT_WIDTH;
    height = DEFAULT_HEIGHT;
  }
  return {
    width,
    height,
    fps: positiveInt(video?.fps === undefined ? process.env.H5_NDI_FPS : String(video.fps), DEFAULT_FPS),
    sourceName: configuredName.trim() || DEFAULT_SOURCE,
    port: Math.min(65535, positiveInt(process.env.H5_NDI_PORT, DEFAULT_PORT, true)),
    queueSize: 8,
    scanMode: video?.scanMode === "interlaced" ? "interlaced" : "progressive",
    authToken
  };
}
