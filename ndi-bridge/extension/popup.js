const button = document.getElementById("toggle");
const status = document.getElementById("status");
let running = false;

function setStatus(text) { status.textContent = text; }

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

button.addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return setStatus("No active page found");
  running = !running;
  button.textContent = running ? "Stop NDI Output" : "Start NDI Output";
  setStatus(running ? "Connecting to Helper..." : "Stopping...");
  const response = await chrome.runtime.sendMessage({ type: running ? "start" : "stop", tabId: tab.id });
  setStatus(response?.message ?? "No Helper response");
  if (response?.ok === false) {
    running = false;
    button.textContent = "Start NDI Output";
  }
});
