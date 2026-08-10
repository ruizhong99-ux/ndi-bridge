#!/bin/sh
set -eu

HOST_NAME="com.h5.ndi.bridge"
INSTALL_ROOT="$HOME/Library/Application Support/H5-NDI-Bridge"

for BROWSER_ROOT in \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"; do
  rm -f "$BROWSER_ROOT/$HOST_NAME.json"
done

rm -rf "$INSTALL_ROOT"
echo "Removed H5-NDI-Bridge macOS helper and Native Messaging registrations."
