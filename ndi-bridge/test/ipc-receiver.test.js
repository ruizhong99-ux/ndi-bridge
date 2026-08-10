const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { IPCReceiver } = require("../dist/ipc/IPCReceiver.js");

function nextControlMessage(socket) {
  return new Promise((resolve, reject) => {
    const onMessage = data => {
      try {
        const message = JSON.parse(data.toString());
        socket.off("error", onError);
        resolve(message);
      } catch (error) {
        reject(error);
      }
    };
    const onError = error => {
      socket.off("message", onMessage);
      reject(error);
    };
    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

test("IPCReceiver accepts one RGBA frame and returns a frame acknowledgement", async () => {
  const frames = [];
  const sender = {
    start() {},
    sendFrame(frame) { frames.push(frame); },
    stop() {}
  };
  const receiver = new IPCReceiver({ width: 2, height: 1, fps: 30, sourceName: "test", port: 0 }, sender);
  let socket;

  try {
    await receiver.start();
    socket = new WebSocket(`ws://127.0.0.1:${receiver.listeningPort}`);
    const readyMessage = nextControlMessage(socket);
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    assert.deepEqual(await readyMessage, { type: "ready", sourceName: "test" });

    const input = Buffer.from([255, 0, 0, 255, 0, 0, 255, 128]);
    socket.send(input);
    assert.deepEqual(await nextControlMessage(socket), { type: "frame-ack" });
    assert.equal(frames.length, 1);
    assert.deepEqual([...frames[0]], [...input]);
  } finally {
    socket?.terminate();
    await receiver.stop();
  }
});

test("IPCReceiver rejects a WebSocket without the configured token", async () => {
  const receiver = new IPCReceiver({ width: 1, height: 1, fps: 30, sourceName: "auth", port: 0, authToken: "secret" }, {
    start() {}, sendFrame() {}, stop() {}
  });
  let socket;
  try {
    await receiver.start();
    socket = new WebSocket(`ws://127.0.0.1:${receiver.listeningPort}`);
    await assert.rejects(() => new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    }));
  } finally {
    socket?.terminate();
    await receiver.stop();
  }
});

test("IPCReceiver does not leave a server behind when stopped during startup", async () => {
  let releaseStart;
  const sender = {
    start() { return new Promise(resolve => { releaseStart = resolve; }); },
    sendFrame() {},
    stop() { releaseStart?.(); }
  };
  const receiver = new IPCReceiver({ width: 1, height: 1, fps: 30, sourceName: "race", port: 0 }, sender);
  const starting = receiver.start();
  const stopping = receiver.stop();
  await Promise.all([starting, stopping]);
  assert.equal(receiver.listeningPort, undefined);
});

test("IPCReceiver closes the client after rejecting an invalid RGBA frame", async () => {
  const sender = {
    start() {},
    sendFrame() {},
    stop() {}
  };
  const receiver = new IPCReceiver({ width: 1, height: 1, fps: 30, sourceName: "invalid", port: 0 }, sender);
  let socket;

  try {
    await receiver.start();
    socket = new WebSocket(`ws://127.0.0.1:${receiver.listeningPort}`);
    const readyMessage = nextControlMessage(socket);
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    assert.equal((await readyMessage).type, "ready");

    const closed = new Promise(resolve => socket.once("close", resolve));
    socket.send(Buffer.alloc(3));
    const errorMessage = await nextControlMessage(socket);
    assert.equal(errorMessage.type, "error");
    await closed;
  } finally {
    socket?.terminate();
    await receiver.stop();
  }
});

test("IPCReceiver stops the sender if WebSocket setup fails", async () => {
  let starts = 0;
  let stops = 0;
  const sender = {
    start() { starts++; },
    sendFrame() {},
    stop() { stops++; }
  };
  const receiver = new IPCReceiver({
    width: Number.MAX_SAFE_INTEGER,
    height: 2,
    fps: 30,
    sourceName: "invalid-config",
    port: 0
  }, sender);

  await assert.rejects(() => receiver.start(), /safe positive integers/);
  assert.equal(starts, 1);
  assert.equal(stops, 1);
});
