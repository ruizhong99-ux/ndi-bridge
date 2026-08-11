(() => {
  let timer;
  let running = false;
  let source;
  let width;
  let height;
  let fps;
  let acceptedNonce;

  function acceptCommandNonce(nonce) {
    if (typeof nonce !== "string" || nonce.length < 16) return false;
    if (!acceptedNonce) acceptedNonce = nonce;
    return acceptedNonce === nonce;
  }

  function stopWithError(message) {
    clearInterval(timer);
    timer = undefined;
    running = false;
    window.postMessage({ type: "h5-ndi-status", status: "error", message, nonce: acceptedNonce }, "*");
  }

  function captureFrame() {
    if (!running) return;
    try {
      const image = source.getFrame();
      if (!(image instanceof ImageData)) return stopWithError("H5NdiSource.getFrame() must return ImageData");
      if (image.width !== width || image.height !== height) {
        return stopWithError(`H5NdiSource returned ${image.width}x${image.height}; expected ${width}x${height}`);
      }
      window.postMessage({ type: "h5-ndi-frame", width, height, buffer: image.data.buffer, nonce: acceptedNonce }, "*", [image.data.buffer]);
    } catch (error) {
      stopWithError(String(error));
    }
  }

  function resumeTimer() {
    if (!running || timer) return;
    timer = setInterval(captureFrame, 1000 / fps);
  }

  function describeSource() {
    const candidate = window.H5NdiSource;
    if (!candidate?.getFrame) return window.postMessage({ type: "h5-ndi-status", status: "missing-source", nonce: acceptedNonce }, "*");
    const sourceWidth = Number(candidate.width);
    const sourceHeight = Number(candidate.height);
    const sourceFps = Number(candidate.fps ?? 30);
    if (!Number.isInteger(sourceWidth) || sourceWidth < 1 || !Number.isInteger(sourceHeight) || sourceHeight < 1 || !Number.isFinite(sourceFps) || sourceFps <= 0) {
      return window.postMessage({ type: "h5-ndi-status", status: "error", message: "H5NdiSource must define positive width, height, and fps", nonce: acceptedNonce }, "*");
    }
    window.postMessage({ type: "h5-ndi-status", status: "source-config", width: sourceWidth, height: sourceHeight, fps: sourceFps, nonce: acceptedNonce }, "*");
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.type !== "h5-ndi-command" || !acceptCommandNonce(event.data.nonce)) return;
    if (event.data.command === "describe-source") {
      describeSource();
    } else if (event.data.command === "start") {
      if (running) return;
      source = window.H5NdiSource;
      if (!source?.getFrame) return window.postMessage({ type: "h5-ndi-status", status: "missing-source", nonce: acceptedNonce }, "*");
      width = Number(source.width);
      height = Number(source.height);
      fps = Number(source.fps ?? 30);
      if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || !Number.isFinite(fps) || fps <= 0) {
        return stopWithError("H5NdiSource must define positive width, height, and fps");
      }
      running = true;
      resumeTimer();
      window.postMessage({ type: "h5-ndi-status", status: "capturing", width, height, fps, nonce: acceptedNonce }, "*");
    } else if (event.data.command === "pause") {
      if (!running) return;
      clearInterval(timer);
      timer = undefined;
    } else if (event.data.command === "resume") {
      resumeTimer();
    } else if (event.data.command === "stop") {
      clearInterval(timer);
      timer = undefined;
      running = false;
      window.postMessage({ type: "h5-ndi-status", status: "stopped", nonce: acceptedNonce }, "*");
    }
  });
})();
