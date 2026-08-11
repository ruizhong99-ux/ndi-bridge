const test = require("node:test");
const assert = require("node:assert/strict");
const ffi = require("ffi-napi");
const ref = require("ref-napi");
const { NDISender } = require("../dist/core/NDISender.js");
const { NDI_FOURCC_RGBA, NDI_FRAME_FORMAT_PROGRESSIVE } = require("../dist/types/ndi.types.js");

test("NDISender destroys initialized NDI state when sender creation fails", () => {
  const originalLibrary = ffi.Library;
  let destroyCalls = 0;
  ffi.Library = () => ({
    NDIlib_initialize: () => 1,
    NDIlib_destroy: () => { destroyCalls++; },
    NDIlib_send_create: () => { throw new Error("create failed"); },
    NDIlib_send_destroy() {},
    NDIlib_send_send_video_async_v2() {}
  });

  try {
    const sender = new NDISender({
      width: 1,
      height: 1,
      fps: 50,
      sourceName: "startup-failure",
      queueSize: 8
    });
    assert.throws(() => sender.start(), /create failed/);
    assert.equal(destroyCalls, 1);
  } finally {
    ffi.Library = originalLibrary;
  }
});

test("NDISender passes the original RGBA buffer address and descriptor fields", () => {
  let descriptor;
  const sender = new NDISender({
    width: 2,
    height: 1,
    fps: 50,
    sourceName: "rgba-address",
    queueSize: 8
  }, {
    NDIlib_initialize: () => 1,
    NDIlib_destroy() {},
    NDIlib_send_create: () => Buffer.alloc(8, 1),
    NDIlib_send_destroy() {},
    NDIlib_send_send_video_async_v2: (_handle, frame) => { descriptor = Buffer.from(frame); }
  });
  const input = Buffer.from([255, 0, 0, 0, 0, 255, 0, 128]);

  sender.start();
  sender.sendFrame(input);
  sender.stop();

  assert.equal(descriptor.readInt32LE(8), NDI_FOURCC_RGBA);
  assert.equal(descriptor.readInt32LE(16), 1);
  assert.equal(descriptor.readInt32LE(24), NDI_FRAME_FORMAT_PROGRESSIVE);
  assert.equal(descriptor.readInt32LE(48), 8);
  assert.deepEqual([...ref.readPointer(descriptor, 40, 8)], [...input]);
});
