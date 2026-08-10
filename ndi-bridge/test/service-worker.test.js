const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function eventBus() {
  const listeners = new Set();
  return {
    addListener(listener) { listeners.add(listener); },
    removeListener(listener) { listeners.delete(listener); },
    dispatch(...args) { for (const listener of [...listeners]) listener(...args); }
  };
}

test("service worker forwards the Helper port returned by Native Messaging", async () => {
  const runtimeMessages = eventBus();
  const nativeMessages = eventBus();
  const nativeDisconnects = eventBus();
  const sentToPage = [];
  const nativePort = {
    onMessage: nativeMessages,
    onDisconnect: nativeDisconnects,
      postMessage(message) {
      if (message.type === "start") setImmediate(() => nativeMessages.dispatch({ type: "started", port: 19001, token: "a".repeat(64) }));
    },
    disconnect() {}
  };
  const chrome = {
    runtime: {
      onMessage: runtimeMessages,
      connectNative() { return nativePort; },
      lastError: undefined
    },
    tabs: {
      async sendMessage(_tabId, message) {
        sentToPage.push(message);
        if (message.type === "get-source-config") return { ok: true, width: 1920, height: 1080, fps: 50 };
        return { ok: true };
      }
    }
  };
  const context = { chrome, console, Promise, Number, setImmediate, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../extension/service-worker.js"), "utf8"), context);

  const result = await new Promise(resolve => {
    runtimeMessages.dispatch({ type: "start", tabId: 7 }, {}, resolve);
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, "outputting");
  assert.equal(sentToPage.length, 2);
  assert.equal(sentToPage[0].type, "get-source-config");
  assert.equal(sentToPage[1].type, "start-capture");
  assert.equal(sentToPage[1].port, 19001);
});
