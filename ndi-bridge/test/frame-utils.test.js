const test = require("node:test");
const assert = require("node:assert/strict");
const { expectedRgbaBytes, toFrameBuffer, assertRgbaFrame } = require("../dist/ipc/FrameUtils.js");

test("reuses a WebSocket Buffer without copying it", () => {
  const input = Buffer.alloc(16, 7);
  assert.strictEqual(toFrameBuffer(input), input);
});

test("wraps an ArrayBuffer as a Buffer", () => {
  const input = new Uint8Array([1, 2, 3, 4]).buffer;
  const output = toFrameBuffer(input);
  assert.deepEqual([...output], [1, 2, 3, 4]);
});

test("rejects an RGBA frame with the wrong size", () => {
  assert.throws(() => assertRgbaFrame(Buffer.alloc(3), 1, 1), /expected 4/);
});

test("rejects unsafe dimensions before they become a WebSocket payload limit", () => {
  assert.throws(() => expectedRgbaBytes(Number.MAX_SAFE_INTEGER, 2), /safe positive integers/);
});
