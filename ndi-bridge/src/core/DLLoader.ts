import ffi from "ffi-napi";
import path from "node:path";

export interface NDILibrary {
  NDIlib_initialize: () => number;
  NDIlib_destroy: () => void;
  NDIlib_send_create: (settings: Buffer) => Buffer;
  NDIlib_send_destroy: (sender: Buffer) => void;
  NDIlib_send_send_video_async_v2: (sender: Buffer, frame: Buffer) => void;
}

export function loadNDILibrary(): NDILibrary {
  const candidates = process.platform === "win32"
    ? ["Processing.NDI.Lib.x64.dll", ...(process.env.NDI_RUNTIME ? [path.join(process.env.NDI_RUNTIME, "Processing.NDI.Lib.x64.dll")] : [])]
    : process.platform === "darwin"
      ? ["libndi.dylib", "/Library/NDI SDK for Apple/lib/libndi.dylib"]
      : ["libndi.so"];

  let lastError: unknown;
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    try {
      return ffi.Library(candidate, {
        NDIlib_initialize: ["int", []],
        NDIlib_destroy: ["void", []],
        NDIlib_send_create: ["pointer", ["pointer"]],
        NDIlib_send_destroy: ["void", ["pointer"]],
        NDIlib_send_send_video_async_v2: ["void", ["pointer", "pointer"]]
      }) as unknown as NDILibrary;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to load NDI runtime. Checked: ${candidates.join(", ")}. ` +
    "Install the NDI SDK Runtime and add its runtime directory to PATH/NDI_RUNTIME. " +
    `Original error: ${String(lastError)}`
  );
}
