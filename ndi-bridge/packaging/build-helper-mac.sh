#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
NODE_VERSION="v20.20.2"
MACHINE=$(uname -m)

case "$MACHINE" in
  arm64) NODE_ARCH="darwin-arm64" ;;
  x86_64) NODE_ARCH="darwin-x64" ;;
  *)
    echo "Unsupported macOS architecture: $MACHINE" >&2
    exit 1
    ;;
esac

TOOLS_DIR="$PROJECT_ROOT/.tools"
NODE_DIR="$TOOLS_DIR/node-$NODE_VERSION-$NODE_ARCH"
NODE_BIN="$NODE_DIR/bin/node"
NPM_BIN="$NODE_DIR/bin/npm"
NODE_ARCHIVE="$TOOLS_DIR/node-$NODE_VERSION-$NODE_ARCH.tar.gz"

mkdir -p "$TOOLS_DIR"
if [ ! -x "$NODE_BIN" ]; then
  if [ ! -f "$NODE_ARCHIVE" ]; then
    curl -fL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-$NODE_ARCH.tar.gz" -o "$NODE_ARCHIVE"
  fi
  rm -rf "$NODE_DIR"
  tar -xzf "$NODE_ARCHIVE" -C "$TOOLS_DIR"
fi

NDI_LIB=""
if [ -n "${NDI_RUNTIME:-}" ]; then
  if [ -f "$NDI_RUNTIME" ]; then
    NDI_LIB="$NDI_RUNTIME"
  elif [ -f "$NDI_RUNTIME/libndi.dylib" ]; then
    NDI_LIB="$NDI_RUNTIME/libndi.dylib"
  fi
fi

if [ -z "$NDI_LIB" ] && [ -n "${NDI_RUNTIME_DIR_V6:-}" ] && [ -f "$NDI_RUNTIME_DIR_V6/libndi.dylib" ]; then
  NDI_LIB="$NDI_RUNTIME_DIR_V6/libndi.dylib"
fi

if [ -z "$NDI_LIB" ] && [ -f "/Library/NDI SDK for Apple/lib/libndi.dylib" ]; then
  NDI_LIB="/Library/NDI SDK for Apple/lib/libndi.dylib"
fi

if [ -z "$NDI_LIB" ] && [ -f "/Library/NDI SDK for Apple/lib/macOS/libndi.dylib" ]; then
  NDI_LIB="/Library/NDI SDK for Apple/lib/macOS/libndi.dylib"
fi

if [ -z "$NDI_LIB" ]; then
  echo "NDI libndi.dylib was not found." >&2
  echo "Install the official NDI SDK/Runtime for Apple or set NDI_RUNTIME to its file or directory." >&2
  exit 2
fi

cd "$PROJECT_ROOT"
"$NPM_BIN" ci
"$NPM_BIN" run build

RELEASE_DIR="$PROJECT_ROOT/release/H5-NDI-Helper-Mac"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/runtime" "$RELEASE_DIR/dist" "$RELEASE_DIR/ndi-runtime"

cp "$NODE_BIN" "$RELEASE_DIR/runtime/node"
cp -R "$PROJECT_ROOT/dist/." "$RELEASE_DIR/dist/"
cp -R "$PROJECT_ROOT/node_modules" "$RELEASE_DIR/node_modules"
cp "$NDI_LIB" "$RELEASE_DIR/ndi-runtime/libndi.dylib"
cp "$PROJECT_ROOT/packaging/mac-helper.sh" "$RELEASE_DIR/h5-ndi-helper"
chmod 755 "$RELEASE_DIR/runtime/node" "$RELEASE_DIR/h5-ndi-helper"

cp "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/package-lock.json" "$RELEASE_DIR/"
(cd "$RELEASE_DIR" && "$NPM_BIN" prune --omit=dev --ignore-scripts)
rm -f "$RELEASE_DIR/package.json" "$RELEASE_DIR/package-lock.json"

echo "Built macOS helper for $MACHINE: $RELEASE_DIR"
