# H5-NDI-Bridge V1

V1 target: a cooperating H5 page exposes `window.H5NdiSource`, the Chrome extension reads RGBA frames, and the local Helper sends them as Full NDI RGBA.

## Current test path

1. Install the NDI Runtime and make sure `Processing.NDI.Lib.x64.dll` is on `PATH`, or set `NDI_RUNTIME`.
2. Run `npm install` and `npm run build`.
3. Run `npm run helper`.
4. Load `extension/` as an unpacked Chrome extension.
5. Serve `test-page/` from a local HTTP server, open it in Chrome, and click the extension button.

For a quick static server from this directory, use `python -m http.server 8080 --directory test-page` and open `http://127.0.0.1:8080`.

The Native Messaging manifest is a packaging template. Its `path` and `EXTENSION_ID` must be replaced by the installer after `nativeHost.ts` is packaged as `H5-NDI-Helper.exe`. The packaged helper has passed the Native Messaging `start -> started -> stop -> stopped` protocol test and a real 1920x1080 RGBA WebSocket frame test.

The extension-to-helper transport is localhost WebSocket in V1. It is intentionally a first working path; shared memory optimization is deferred.

During development, the extension falls back to an already-running Helper when Native Messaging is not registered yet. This makes the button testable before the final Chrome extension ID and registry entry are installed.

If NDI Runtime is not installed yet, use `H5_NDI_MOCK=1 npm run dev` to verify the local WebSocket and RGBA frame-size path without loading the NDI DLL. On Windows PowerShell, use `$env:H5_NDI_MOCK='1'; npm run dev`.

## H5 Alpha demo page

The included demo page is a fixed 1920x1080 RGBA canvas. It exposes `window.H5NdiSource` and supports transparent PNG import.

```powershell
python -m http.server 8080 --directory test-page
```

Open `http://127.0.0.1:8080`, import a PNG with transparency, or click `Show alpha test`. The page keeps the canvas at 1920x1080 even when the browser preview is scaled down.

## Verified V1 path

- Mac NDI Tools receives a stable red signal from `H5-Studio-Stream`.
- OBS receives RGBA and shows transparent, semi-transparent, and opaque regions correctly over a green background.
- Node 20.20.2, `ffi-napi`, the NDI DLL, and the TypeScript build have been verified.

The Windows `.exe` is available at `release/H5-NDI-Helper/H5-NDI-Helper.exe`. Native Messaging registration still needs the final unpacked extension ID and install path. `native-host/com.h5.ndi.bridge.example.json` remains a template until those two values are filled in.

The project uses `ref-struct-di` with the same `ref-napi` instance as `ffi-napi`. This avoids the incompatible duplicate `ref-napi` dependency that previously broke packaged DLL loading.
