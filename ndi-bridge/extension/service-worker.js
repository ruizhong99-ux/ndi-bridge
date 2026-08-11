let nativePort;
let helperStartedByNativeHost = false;
let operation = Promise.resolve();
let activeTabId;
let activeMode;
const DEFAULT_HELPER_PORT = 17890;
const DEFAULT_CONFIG = { sourceName: "H5-Studio-Stream", format: "1080p50" };
let state = { status: "stopped", message: "NDI output stopped" };

function setState(next) {
  state = { ...state, ...next };
  if (state.status === "stopped") { activeTabId = undefined; activeMode = undefined; }
}

function formatVideo(config) {
  return { width: 1920, height: 1080, fps: 50 };
}

async function loadConfig() {
  const stored = chrome.storage?.local ? await chrome.storage.local.get(DEFAULT_CONFIG) : {};
  const next = { ...DEFAULT_CONFIG, ...stored, format: "1080p50" };
  if (chrome.storage?.local && stored.format !== next.format) await chrome.storage.local.set({ format: next.format });
  return next;
}

async function saveConfig(config) {
  const next = { sourceName: String(config?.sourceName ?? "").trim() || DEFAULT_CONFIG.sourceName, format: "1080p50" };
  if (chrome.storage?.local) await chrome.storage.local.set(next);
  return next;
}

function connectNativeHost() {
  if (nativePort) return nativePort;
  const port = chrome.runtime.connectNative("com.h5.ndi.bridge");
  nativePort = port;
  port.onDisconnect.addListener(() => {
    if (nativePort === port) {
      nativePort = undefined;
      helperStartedByNativeHost = false;
      if (["outputting", "testing", "starting"].includes(state.status)) setState({ status: "error", message: "Native Helper disconnected" });
    }
  });
  return port;
}

function disconnectNativeHost() {
  const port = nativePort;
  nativePort = undefined;
  helperStartedByNativeHost = false;
  try { port?.disconnect(); } catch { /* Port may already be closed. */ }
}

function waitForNativeMessage(port, expectedType, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => { clearTimeout(timer); port.onMessage.removeListener(onMessage); port.onDisconnect.removeListener(onDisconnect); };
    const onMessage = message => {
      if (message?.type === expectedType) { cleanup(); resolve(message); }
      else if (message?.type === "error") { cleanup(); reject(new Error(`Native host error: ${message.message}`)); }
    };
    const onDisconnect = () => { cleanup(); reject(new Error(chrome.runtime.lastError?.message ?? "Native host disconnected")); };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    timer = setTimeout(() => { cleanup(); reject(new Error(`Native host did not reply with ${expectedType}`)); }, timeoutMs);
  });
}

async function startHelper(sourceName, video) {
  let startedByNativeHost = false;
  let helperPort = DEFAULT_HELPER_PORT;
  let helperToken;
  let responsePromise;
  try {
    const port = connectNativeHost();
    responsePromise = waitForNativeMessage(port, "started", 8000);
    port.postMessage({ type: "start", sourceName, ...video });
    const response = await responsePromise;
    if (!Number.isInteger(response.port) || response.port < 0 || response.port > 65535) throw new Error("Native host returned an invalid Helper port");
    if (typeof response.token !== "string" || response.token.length < 32) throw new Error("Native host returned an invalid WebSocket token");
    helperPort = response.port;
    helperToken = response.token;
    helperStartedByNativeHost = true;
    startedByNativeHost = true;
  } catch (error) {
    responsePromise?.catch(() => undefined);
    if (String(error).startsWith("Error: Native host error:")) throw error;
    disconnectNativeHost();
    console.warn(`Native Messaging unavailable; using an existing Helper: ${String(error)}`);
  }
  return { startedByNativeHost, helperPort, token: helperToken };
}

async function stopHelper() {
  if (!nativePort || !helperStartedByNativeHost) return;
  const port = nativePort;
  try { port.postMessage({ type: "stop" }); await waitForNativeMessage(port, "stopped", 5000); }
  catch (error) { disconnectNativeHost(); throw error; }
  finally { helperStartedByNativeHost = false; }
}

async function startOutput(tabId, requestedConfig) {
  const config = await saveConfig(requestedConfig);
  const video = formatVideo(config);
  setState({ status: "starting", message: "Starting NDI output...", warning: undefined });
  const source = await chrome.tabs.sendMessage(tabId, { type: "get-source-config" });
  if (!source?.ok) throw new Error(source?.message ?? "The page does not provide a valid H5NdiSource");
  if (source.width !== video.width || source.height !== video.height || source.fps !== video.fps) throw new Error(`Page source must be ${video.width}x${video.height}@${video.fps} for the selected format`);
  const helper = await startHelper(config.sourceName, video);
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: "start-capture", port: helper.helperPort, token: helper.token });
    if (!result?.ok) throw new Error(result?.message ?? "The page could not start RGBA capture");
    activeTabId = tabId;
    activeMode = "page";
    setState({ status: "outputting", message: "NDI output is live", sourceName: config.sourceName, ...video });
    return { ok: true, state };
  } catch (error) {
    if (helper.startedByNativeHost) await stopHelper().catch(() => undefined);
    throw error;
  }
}

async function stopOutput(tabId, warning) {
  setState({ status: "stopping", message: "Stopping NDI output..." });
  try { if (tabId) await chrome.tabs.sendMessage(tabId, { type: "stop-capture" }); } catch { /* Page may already be gone. */ }
  await stopHelper().catch(() => undefined);
  setState({ status: "stopped", message: warning ? "Output stopped after page refresh" : "NDI output stopped", warning });
  return { ok: true, state };
}

async function startTestBars(requestedConfig) {
  const config = await saveConfig(requestedConfig);
  const video = formatVideo(config);
  setState({ status: "starting", message: "Starting color bars...", warning: undefined });
  const helper = await startHelper(config.sourceName, video);
  try {
    if (!helper.startedByNativeHost) throw new Error("Color bars require the registered Native Helper");
    const responsePromise = waitForNativeMessage(nativePort, "test-started", 5000);
    nativePort.postMessage({ type: "test-bars", sourceName: config.sourceName, ...video });
    await responsePromise;
    activeMode = "test";
    setState({ status: "testing", message: "SMPTE color bars are live", sourceName: config.sourceName, ...video });
    return { ok: true, state };
  } catch (error) { await stopHelper().catch(() => undefined); throw error; }
}

async function stopTestBars() { return stopOutput(undefined); }

async function handle(message) {
  if (message.type === "get-state") return { ok: true, state, config: await loadConfig() };
  if (message.type === "save-config") return { ok: true, config: await saveConfig(message.config), state };
  if (message.type === "start") return startOutput(message.tabId, message.config);
  if (message.type === "stop") return stopOutput(message.tabId);
  if (message.type === "start-test-bars") return startTestBars(message.config);
  if (message.type === "stop-test-bars") return stopTestBars();
  if (message.type === "capture-status" && message.status === "error") {
    setState({ status: "error", message: message.message ?? "Page capture stopped unexpectedly" });
    return { ok: true, state };
  }
  return undefined;
}

chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && tabId === activeTabId && activeMode === "page") {
    operation = operation.then(() => stopOutput(tabId, "网页已刷新，NDI 输出已停止。"), () => stopOutput(tabId, "网页已刷新，NDI 输出已停止。"));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const result = operation.then(() => handle(message), () => handle(message));
  operation = result.then(() => undefined, () => undefined);
  result.then(sendResponse).catch(error => { setState({ status: "error", message: String(error) }); sendResponse({ ok: false, state, message: String(error) }); });
  return true;
});
