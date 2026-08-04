let nativePort;
let helperStartedByNativeHost = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "start") {
      try {
        nativePort ??= chrome.runtime.connectNative("com.h5.ndi.bridge");
        nativePort.postMessage({ type: "start", sourceName: "H5-Studio-Stream" });
        helperStartedByNativeHost = true;
      } catch (error) {
        // Development fallback: use a helper that is already listening on localhost.
        // Production installs should register the Native Messaging host.
        nativePort = undefined;
        helperStartedByNativeHost = false;
        console.warn(`Native Messaging unavailable; using existing Helper: ${String(error)}`);
      }
      try {
        await chrome.tabs.sendMessage(message.tabId, { type: "start-capture" });
        sendResponse({
          ok: true,
          message: helperStartedByNativeHost
            ? "NDI output started"
            : "Connected to existing NDI Helper"
        });
      } catch (error) {
        sendResponse({ ok: false, message: `Helper start failed: ${String(error)}` });
      }
    } else if (message.type === "stop") {
      await chrome.tabs.sendMessage(message.tabId, { type: "stop-capture" });
      if (nativePort && helperStartedByNativeHost) nativePort.postMessage({ type: "stop" });
      helperStartedByNativeHost = false;
      sendResponse({ ok: true, message: "NDI output stopped" });
    }
  })();
  return true;
});
