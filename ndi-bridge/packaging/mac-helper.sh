#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
NODE_PATH="$BASE_DIR/runtime/node"
SCRIPT_PATH="$BASE_DIR/dist/nativeHost.js"

if [ ! -x "$NODE_PATH" ]; then
  echo "H5-NDI-Bridge: bundled macOS Node runtime is missing: $NODE_PATH" >&2
  exit 2
fi

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "H5-NDI-Bridge: packaged Native Messaging script is missing: $SCRIPT_PATH" >&2
  exit 2
fi

export DYLD_LIBRARY_PATH="$BASE_DIR/ndi-runtime${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
exec "$NODE_PATH" "$SCRIPT_PATH"
