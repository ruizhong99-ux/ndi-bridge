const test = require("node:test");
const assert = require("node:assert/strict");
const { readBridgeConfig, assertVideoConfig } = require("../dist/config.js");

test("readBridgeConfig ignores unsafe frame dimensions instead of creating a huge payload limit", () => {
  const previousWidth = process.env.H5_NDI_WIDTH;
  const previousHeight = process.env.H5_NDI_HEIGHT;
  process.env.H5_NDI_WIDTH = "9007199254740992";
  process.env.H5_NDI_HEIGHT = "1080";

  try {
    const config = readBridgeConfig();
    assert.equal(config.width, 1920);
    assert.equal(config.height, 1080);
  } finally {
    if (previousWidth === undefined) delete process.env.H5_NDI_WIDTH;
    else process.env.H5_NDI_WIDTH = previousWidth;
    if (previousHeight === undefined) delete process.env.H5_NDI_HEIGHT;
    else process.env.H5_NDI_HEIGHT = previousHeight;
  }
});

test("assertVideoConfig rejects oversized frames and unreasonable frame rates", () => {
  assert.throws(() => assertVideoConfig({ width: 16384, height: 16384, fps: 50, sourceName: "test" }), /frame size/);
  assert.throws(() => assertVideoConfig({ width: 1920, height: 1080, fps: 1000, sourceName: "test" }), /fps/);
});

test("readBridgeConfig falls back when the configured frame rate is too high", () => {
  const previousFps = process.env.H5_NDI_FPS;
  process.env.H5_NDI_FPS = "1000";
  try {
    assert.equal(readBridgeConfig().fps, 50);
  } finally {
    if (previousFps === undefined) delete process.env.H5_NDI_FPS;
    else process.env.H5_NDI_FPS = previousFps;
  }
});
