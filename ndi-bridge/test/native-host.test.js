const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const path = require("node:path");

function encode(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function createMessageReader(stream) {
  let input = Buffer.alloc(0);
  const messages = [];
  const waiters = [];

  function flush() {
    while (input.length >= 4) {
      const length = input.readUInt32LE(0);
      if (input.length < length + 4) return;
      const body = input.subarray(4, length + 4).toString("utf8");
      input = input.subarray(length + 4);
      const message = JSON.parse(body);
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(message);
      else messages.push(message);
    }
  }

  stream.on("data", chunk => {
    input = Buffer.concat([input, chunk]);
    flush();
  });

  return () => {
    if (messages.length) return Promise.resolve(messages.shift());
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  };
}

test("Native Messaging start/stop waits for the real Helper lifecycle", async () => {
  const child = spawn(process.execPath, [path.resolve(__dirname, "../dist/nativeHost.js")], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, H5_NDI_MOCK: "1", H5_NDI_PORT: "0" },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const nextMessage = createMessageReader(child.stdout);

  try {
    child.stdin.write(encode({ type: "start", sourceName: "test-native-host" }));
    const started = await nextMessage();
    assert.equal(started.type, "started");
    assert.equal(typeof started.port, "number");

    child.stdin.write(encode({ type: "start" }));
    assert.equal((await nextMessage()).type, "started");

    child.stdin.write(encode({ type: "stop" }));
    assert.deepEqual(await nextMessage(), { type: "stopped" });
    child.stdin.end();
    const [code] = await once(child, "exit");
    assert.equal(code, 0);
  } finally {
    if (!child.killed) child.kill();
  }
});
