#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
INSTALL_ROOT="$HOME/Library/Application Support/H5-NDI-Bridge"
HOST_NAME="com.h5.ndi.bridge"
EXTENSION_ID=""

print_help() {
  echo "Usage: bash packaging/install-mac.sh [--extension-id ID]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --extension-id)
      [ "$#" -ge 2 ] || { echo "--extension-id requires a value" >&2; exit 1; }
      EXTENSION_ID="$2"
      shift 2
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

if [ -z "$EXTENSION_ID" ] && command -v pbpaste >/dev/null 2>&1; then
  EXTENSION_ID=$(pbpaste 2>/dev/null | tr -d '[:space:]' || true)
fi

is_valid_id() {
  case "$1" in
    ????????-????????-????????-????????) return 1 ;;
  esac
  [ "${#1}" -eq 32 ] || return 1
  case "$1" in
    *[!a-p0-9]*) return 1 ;;
  esac
}

if ! is_valid_id "$EXTENSION_ID"; then
  echo "Paste the unpacked extension ID (32 lowercase characters a-p):" >&2
  IFS= read -r EXTENSION_ID
  EXTENSION_ID=$(printf '%s' "$EXTENSION_ID" | tr -d '[:space:]')
fi

if ! is_valid_id "$EXTENSION_ID"; then
  echo "Invalid extension ID: $EXTENSION_ID" >&2
  exit 1
fi

HELPER_SOURCE="$SOURCE_ROOT/H5-NDI-Helper-Mac"
if [ ! -x "$HELPER_SOURCE/h5-ndi-helper" ]; then
  echo "Mac helper is missing or not executable: $HELPER_SOURCE/h5-ndi-helper" >&2
  echo "Build it first with: bash packaging/package-mac.sh" >&2
  exit 2
fi

rm -rf "$INSTALL_ROOT"
mkdir -p "$INSTALL_ROOT"
cp -R "$HELPER_SOURCE" "$INSTALL_ROOT/H5-NDI-Helper-Mac"
cp -R "$SOURCE_ROOT/extension" "$INSTALL_ROOT/extension"
chmod 755 "$INSTALL_ROOT/H5-NDI-Helper-Mac/h5-ndi-helper" "$INSTALL_ROOT/H5-NDI-Helper-Mac/runtime/node"

MANIFEST="$INSTALL_ROOT/$HOST_NAME.json"
cat > "$MANIFEST" <<EOF
{
  "name": "$HOST_NAME",
  "description": "H5 NDI Bridge Native Messaging host",
  "path": "$INSTALL_ROOT/H5-NDI-Helper-Mac/h5-ndi-helper",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
EOF

for BROWSER_ROOT in \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"; do
  mkdir -p "$BROWSER_ROOT"
  cp "$MANIFEST" "$BROWSER_ROOT/$HOST_NAME.json"
done

echo "Installed H5-NDI-Bridge macOS helper."
echo "Native Messaging host: $HOST_NAME"
echo "Extension ID: $EXTENSION_ID"
echo "Restart the browser, then open the extension."
