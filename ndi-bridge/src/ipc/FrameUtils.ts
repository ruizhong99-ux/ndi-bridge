export type WebSocketFrame = Buffer | ArrayBuffer | ArrayBufferView | readonly Buffer[];
export const MAX_FRAME_BYTES = 256 * 1024 * 1024;

export function expectedRgbaBytes(width: number, height: number): number {
  const bytes = width * height * 4;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    !Number.isSafeInteger(bytes) ||
    bytes > MAX_FRAME_BYTES
  ) {
    throw new RangeError("RGBA dimensions and frame size must be safe positive integers");
  }
  return bytes;
}

export function toFrameBuffer(data: WebSocketFrame): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) return Buffer.concat(data as readonly Buffer[]);
  throw new TypeError("WebSocket message is not a binary frame");
}

export function assertRgbaFrame(frame: Buffer, width: number, height: number): void {
  const expected = expectedRgbaBytes(width, height);
  if (frame.length !== expected) {
    throw new Error(`Invalid RGBA frame size: expected ${expected}, got ${frame.length}`);
  }
}
