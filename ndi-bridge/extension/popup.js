const toggle = document.getElementById("toggle");
const testBars = document.getElementById("test-bars");
const sourceName = document.getElementById("source-name");
const format = document.getElementById("format");
const indicator = document.getElementById("indicator");
const statusText = document.getElementById("status-text");
const details = document.getElementById("details");
const warning = document.getElementById("warning");
const extensionIdValue = document.getElementById("extension-id-value");
const copyId = document.getElementById("copy-id");
let state = { status: "stopped" };

extensionIdValue.textContent = chrome.runtime.id;
copyId.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(chrome.runtime.id);
    copyId.textContent = "Copied";
    setTimeout(() => { copyId.textContent = "Copy Extension ID"; }, 1500);
  } catch {
    copyId.textContent = "Copy failed";
  }
});

function render(next) {
  state = next ?? { status: "stopped" };
  const active = ["starting", "outputting", "stopping", "testing"].includes(state.status);
  const busy = ["starting", "stopping"].includes(state.status);
  toggle.className = state.status;
  indicator.className = state.status === "outputting" ? "outputting" : state.status === "error" ? "error" : "";
  toggle.textContent = state.status === "outputting" ? "Stop NDI Output" : state.status === "starting" ? "Starting..." : state.status === "stopping" ? "Stopping..." : "Start NDI Output";
  toggle.disabled = busy;
  testBars.textContent = state.status === "testing" ? "Stop Color Bars" : "Start Color Bars";
  testBars.disabled = busy || state.status === "outputting";
  statusText.textContent = state.message ?? (state.status === "outputting" ? "NDI output is live" : state.status === "error" ? "NDI output error" : "NDI output stopped");
  details.textContent = state.width ? `${state.width} × ${state.height} ${state.scanMode === "interlaced" ? "50i" : "50P"} · ${state.sourceName ?? ""}` : "";
  warning.textContent = state.warning ?? "";
  warning.style.display = state.warning ? "block" : "none";
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.state) render(response.state);
  if (response?.config) {
    sourceName.value = response.config.sourceName ?? "H5-Studio-Stream";
    format.value = response.config.format ?? "1080p50";
  }
  return response;
}

async function refresh() {
  try { await send({ type: "get-state" }); } catch (error) { render({ status: "error", message: String(error) }); }
}

toggle.addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return render({ status: "error", message: "No active page found" });
  const nextType = state.status === "outputting" ? "stop" : "start";
  const config = { sourceName: sourceName.value.trim(), format: format.value };
  await send({ type: nextType, tabId: tab.id, config });
});

testBars.addEventListener("click", async () => {
  const config = { sourceName: sourceName.value.trim(), format: format.value };
  await send({ type: state.status === "testing" ? "stop-test-bars" : "start-test-bars", config });
});

sourceName.addEventListener("change", () => { void send({ type: "save-config", config: { sourceName: sourceName.value.trim(), format: format.value } }); });
format.addEventListener("change", () => { void send({ type: "save-config", config: { sourceName: sourceName.value.trim(), format: format.value } }); });
void refresh();
