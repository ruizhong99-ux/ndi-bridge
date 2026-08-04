const ffi = require("ffi-napi");
const ref = require("ref-napi");

const runtime = process.env.NDI_RUNTIME || "D:\\NDI 6 Tools\\Runtime";
const lib = ffi.Library(`${runtime}\\Processing.NDI.Lib.x64.dll`, {
  NDIlib_initialize: ["int", []],
  NDIlib_destroy: ["void", []],
  NDIlib_find_create_v2: ["pointer", ["pointer"]],
  NDIlib_find_destroy: ["void", ["pointer"]],
  NDIlib_find_wait_for_sources: ["int", ["pointer", "int"]],
  NDIlib_find_get_current_sources: ["pointer", ["pointer", "pointer"]]
});

if (!lib.NDIlib_initialize()) throw new Error("NDI initialize failed");
const finder = lib.NDIlib_find_create_v2(ref.NULL);
const count = ref.alloc(ref.types.int32);
try {
  lib.NDIlib_find_wait_for_sources(finder, 5000);
  const sources = lib.NDIlib_find_get_current_sources(finder, count);
  const pointerSize = ref.sizeof.pointer;
  const sourceSize = pointerSize * 2;
  const result = [];
  for (let i = 0; i < count.deref(); i++) {
    const source = ref.readPointer(sources, i * sourceSize, pointerSize);
    const name = ref.readPointer(source, 0, pointerSize);
    result.push(ref.readCString(name, 0));
  }
  console.log(JSON.stringify({ count: count.deref(), sources: result }, null, 2));
} finally {
  lib.NDIlib_find_destroy(finder);
  lib.NDIlib_destroy();
}
