const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function eventBus() {
  return { addListener() {}, removeListener() {} };
}

function loadWorker(initialStored = {}) {
  const stored = { ...initialStored };
  const context = {
    chrome: {
      storage: {
        local: {
          async get(defaults) { return { ...defaults, ...stored }; },
          async set(next) { Object.assign(stored, next); }
        }
      },
      tabs: { onUpdated: eventBus(), async sendMessage() { return { ok: true }; } },
      runtime: { onMessage: eventBus(), connectNative() { throw new Error("not used"); } }
    },
    console,
    Promise,
    Number,
    String,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../extension/service-worker.js"), "utf8"), context);
  return context;
}

test("service worker normalizes legacy interlaced settings to progressive 50P", async () => {
  const context = loadWorker();

  assert.deepEqual({ ...context.formatVideo({ format: "1080i50" }) }, {
    width: 1920,
    height: 1080,
    fps: 50
  });
  const saved = await context.saveConfig({ sourceName: "test", format: "1080i50" });
  assert.equal(saved.format, "1080p50");
});

test("service worker migrates legacy interlaced settings while loading config", async () => {
  const context = loadWorker({ sourceName: "legacy", format: "1080i50" });

  assert.deepEqual({ ...(await context.loadConfig()) }, {
    sourceName: "legacy",
    format: "1080p50"
  });
  assert.equal((await context.chrome.storage.local.get({})).format, "1080p50");
});
