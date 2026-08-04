(() => {
  let timer;
  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.type !== "h5-ndi-command") return;
    if (event.data.command === "start") {
      if (timer) return;
      const source = window.H5NdiSource;
      if (!source?.getFrame) return window.postMessage({ type: "h5-ndi-status", status: "missing-source" }, "*");
      const fps = Math.max(1, Number(source.fps ?? 30));
      timer = setInterval(() => {
        const image = source.getFrame();
        if (!(image instanceof ImageData)) return;
        window.postMessage({ type: "h5-ndi-frame", width: image.width, height: image.height, buffer: image.data.buffer }, "*", [image.data.buffer]);
      }, 1000 / fps);
      window.postMessage({ type: "h5-ndi-status", status: "capturing" }, "*");
    } else if (event.data.command === "stop") {
      clearInterval(timer);
      timer = undefined;
      window.postMessage({ type: "h5-ndi-status", status: "stopped" }, "*");
    }
  });
})();
