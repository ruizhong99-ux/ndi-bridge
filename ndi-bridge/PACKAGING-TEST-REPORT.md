# H5-NDI-Bridge Packaging Test Report

Date: 2026-08-05

## Result

The packaged Windows helper passed the automated packaging checks.

## Checks passed

- TypeScript build completed with `npm.cmd run build`.
- `release/H5-NDI-Helper/H5-NDI-Helper.exe` rebuilt successfully.
- Packaged Node 20 loaded `ffi-napi`, `ref-napi`, `ref-struct-di`, and the NDI DLL.
- Native Messaging protocol: `start` returned `started`.
- Native Messaging protocol: `stop` returned `stopped`.
- Helper exited with code 0 after stdin closed.
- WebSocket handshake returned `ready`.
- One 1920x1080 RGBA frame was accepted: 8,294,400 bytes.
- Frame test used alpha values 0, 128, and 255 in three vertical regions.

## Important fixes

The old `ref-struct-napi` package installed its own older `ref-napi`. Loading both pointer libraries caused `ffi-napi` to fail with a null dynamic-loader error. The project now uses `ref-struct-di`, which receives the already-loaded top-level `ref-napi` instance.

The C# launcher now forwards stdin/stdout immediately. This is required because Chrome keeps the Native Messaging pipe open and does not send EOF after each message.

## Remaining manual checks

- Fill the Chrome extension ID into the Native Messaging manifest.
- Register the manifest in the Windows Native Messaging registry.
- Click the extension button on the demo page.
- Confirm `H5-Studio-Stream` appears in OBS or NDI Tools.
- Repeat the transparent, semi-transparent, and opaque alpha test over a green background.
