let socket;
let capturing = false;
let frameInFlight = false;
let ackTimer;
let pendingStart;
let pendingSourceConfig;
let captureWidth;
let captureHeight;
const bridgeNonce = createSessionNonce();

function createSessionNonce() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

function postCommand(command) {
  window.postMessage({ type: "h5-ndi-command", command, nonce: bridgeNonce }, "*");
}

function clearAckTimer() {
  clearTimeout(ackTimer);
  ackTimer = undefined;
}

function settleStart(error) {
  const request = pendingStart;
  pendingStart = undefined;
  if (!request) return;
  clearTimeout(request.timeout);
  if (error) request.reject(error);
  else request.resolve({ ok: true, message: "RGBA capture started" });
}

function disconnectSocket(error = new Error("RGBA capture ended")) {
  const current = socket;
  const wasCapturing = capturing;
  socket = undefined;
  capturing = false;
  frameInFlight = false;
  clearAckTimer();
  if (wasCapturing) postCommand("stop");
  if (wasCapturing && error.message !== "RGBA capture stopped") {
    chrome.runtime.sendMessage({ type: "capture-status", status: "error", message: String(error) }).catch(() => undefined);
  }
  if (current && current.readyState < WebSocket.CLOSING) current.close();
  settleStart(error);
}

window.addEventListener("message", event => {
  if (event.source !== window) return;
  if (event.data?.nonce !== bridgeNonce) return;
  if (event.data?.type === "h5-ndi-frame" && socket?.readyState === WebSocket.OPEN) {
    if (!capturing || frameInFlight) return;
    if (!(event.data.buffer instanceof ArrayBuffer) || event.data.buffer.byteLength !== captureWidth * captureHeight * 4) {
      return disconnectSocket(new Error("Page returned an invalid RGBA frame"));
    }
    frameInFlight = true;
    postCommand("pause");
    try {
      socket.send(event.data.buffer);
      clearAckTimer();
      ackTimer = setTimeout(() => disconnectSocket(new Error("Helper did not acknowledge the RGBA frame")), 1000);
    } catch (error) {
      disconnectSocket(new Error(String(error)));
    }
  }
  if (event.data?.type !== "h5-ndi-status") return;
  if (event.data.status === "source-config") {
    const { width, height, fps } = event.data;
    if (![width, height].every(Number.isInteger) || width < 1 || height < 1 || !Number.isFinite(fps) || fps <= 0) {
      pendingSourceConfig?.reject(new Error("Page returned invalid H5NdiSource dimensions"));
    } else {
      captureWidth = width;
      captureHeight = height;
      pendingSourceConfig?.resolve({ ok: true, width, height, fps });
    }
    pendingSourceConfig = undefined;
  } else if (event.data.status === "capturing") {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    capturing = true;
    settleStart();
  } else if (event.data.status === "missing-source") {
    disconnectSocket(new Error("This page does not provide window.H5NdiSource"));
  } else if (event.data.status === "error") {
    disconnectSocket(new Error(String(event.data.message ?? "H5NdiSource capture failed")));
  }
});

function startCapture(port = 17890, token) {
  if (capturing && socket?.readyState === WebSocket.OPEN) return Promise.resolve({ ok: true, message: "RGBA capture already running" });
  disconnectSocket(new Error("RGBA capture restarted"));

  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const current = new WebSocket(`ws://127.0.0.1:${port}/${query}`);
  socket = current;
  current.binaryType = "arraybuffer";
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => disconnectSocket(new Error(`Helper did not become ready on port ${port}`)), 5000);
    pendingStart = { resolve, reject, timeout, socket: current };
    current.onmessage = event => {
      if (socket !== current) return;
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message.type === "ready") {
        postCommand("start");
      } else if (message.type === "frame-ack") {
        frameInFlight = false;
        clearAckTimer();
        postCommand("resume");
      } else if (message.type === "error") {
        disconnectSocket(new Error(`H5 NDI Helper rejected data: ${message.message}`));
      }
    };
    current.onerror = () => {
      if (socket === current) disconnectSocket(new Error(`Helper is not running on port ${port}`));
    };
    current.onclose = () => {
      if (socket !== current) return;
      disconnectSocket(new Error("Helper connection closed"));
    };
  });
}

function stopCapture() {
  disconnectSocket(new Error("RGBA capture stopped"));
}

function getSourceConfig() {
  if (pendingSourceConfig) return Promise.reject(new Error("Source configuration request already pending"));
  return new Promise((resolve, reject) => {
    pendingSourceConfig = { resolve, reject };
    postCommand("describe-source");
    setTimeout(() => {
      if (pendingSourceConfig?.reject === reject) {
        pendingSourceConfig = undefined;
        reject(new Error("Page did not provide H5NdiSource configuration"));
      }
    }, 3000);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "start-capture") {
    startCapture(message.port ?? 17890, message.token).then(sendResponse).catch(error => sendResponse({ ok: false, message: String(error) }));
    return true;
  }
  if (message.type === "stop-capture") {
    stopCapture();
    sendResponse({ ok: true, message: "RGBA capture stopped" });
  }
  if (message.type === "get-source-config") {
    getSourceConfig().then(sendResponse).catch(error => sendResponse({ ok: false, message: String(error) }));
    return true;
  }
});
