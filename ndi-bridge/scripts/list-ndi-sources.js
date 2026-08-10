const ffi = require("ffi-napi");
const ref = require("ref-napi");
const path = require("node:path");

const runtime = process.env.NDI_RUNTIME || "C:\\Program Files\\NDI\\NDI 6 Runtime\\v6";
const lib = ffi.Library(path.join(runtime, "Processing.NDI.Lib.x64.dll"), {
  NDIlib_initialize: ["int", []],
  NDIlib_destroy: ["void", []],
  NDIlib_find_create_v2: ["pointer", ["pointer"]],
  NDIlib_find_destroy: ["void", ["pointer"]],
  NDIlib_find_wait_for_sources: ["int", ["pointer", "int"]],
  NDIlib_find_get_current_sources: ["pointer", ["pointer", "pointer"]]
});

if (!lib.NDIlib_initialize()) throw new Error("NDI initialize failed");
const finder = lib.NDIlib_find_create_v2(ref.NULL);
if (!finder || ref.isNull(finder)) throw new Error("NDI find create failed");
const count = ref.alloc(ref.types.int32);
try {
  const changed = lib.NDIlib_find_wait_for_sources(finder, 5000);
  const sources = lib.NDIlib_find_get_current_sources(finder, count);
  const pointerSize = ref.sizeof.pointer;
  const sourceSize = pointerSize * 2;
  const result = [];
  for (let i = 0; i < count.deref(); i++) {
    // NDI returns a contiguous array of NDIlib_source_t structs, not an
    // array of pointers to structs.
    const name = ref.readPointer(sources, i * sourceSize, pointerSize);
    result.push(ref.readCString(name, 0));
  }
  console.log(JSON.stringify({ changed, count: count.deref(), sources: result }, null, 2));
} finally {
  lib.NDIlib_find_destroy(finder);
  lib.NDIlib_destroy();
}
