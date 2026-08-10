const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCaptureMain() {
  const messages = [];
  const intervals = [];
  const cleared = [];
  const listeners = [];
  let nextTimer = 1;
  const page = {
    H5NdiSource: { width: 2, height: 1, fps: 50, getFrame() { return new ImageData(2, 1); } },
    addEventListener(_type, listener) { listeners.push(listener); },
    postMessage(message) { messages.push(message); }
  };
  class ImageDataStub {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  }
  const context = {
    window: page,
    ImageData: ImageDataStub,
    setInterval(callback, delay) {
      const timer = { id: nextTimer++, callback, delay };
      intervals.push(timer);
      return timer;
    },
    clearInterval(timer) { cleared.push(timer); }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../extension/capture-main.js"), "utf8"), context);
  return { page, messages, intervals, cleared, send(command) { listeners[0]({ source: page, data: { type: "h5-ndi-command", command } }); } };
}

test("capture-main pauses frame generation until the transport resumes it", () => {
  const capture = loadCaptureMain();

  capture.send("start");
  assert.equal(capture.intervals.length, 1);
  const firstTimer = capture.intervals[0];

  capture.send("pause");
  assert.deepEqual(capture.cleared, [firstTimer]);

  capture.send("resume");
  assert.equal(capture.intervals.length, 2);
  assert.equal(capture.messages[0].status, "capturing");
});
