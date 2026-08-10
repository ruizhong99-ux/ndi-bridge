const test = require("node:test");
const assert = require("node:assert/strict");
const { readBridgeConfig } = require("../dist/config.js");

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
