#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION="${1:-1.0.0}"
MACHINE=$(uname -m)
STAGING="$PROJECT_ROOT/.mac-release-staging"
OUTPUT_DIR="$PROJECT_ROOT/release-assets"
ARCHIVE="$OUTPUT_DIR/H5-NDI-Bridge-macOS-$MACHINE-v$VERSION.tar.gz"
CHECKSUMS="$OUTPUT_DIR/SHA256SUMS-macOS-$MACHINE.txt"

sh "$PROJECT_ROOT/packaging/build-helper-mac.sh"

HELPER_DIR="$PROJECT_ROOT/release/H5-NDI-Helper-Mac"
if [ ! -x "$HELPER_DIR/h5-ndi-helper" ]; then
  echo "Built macOS helper is missing: $HELPER_DIR/h5-ndi-helper" >&2
  exit 2
fi

rm -rf "$STAGING"
mkdir -p "$STAGING"
trap 'rm -rf "$STAGING"' EXIT

cp -R "$PROJECT_ROOT/extension" "$STAGING/extension"
cp -R "$HELPER_DIR" "$STAGING/H5-NDI-Helper-Mac"
cp "$PROJECT_ROOT/packaging/install-mac.sh" "$PROJECT_ROOT/packaging/uninstall-mac.sh" "$PROJECT_ROOT/packaging/USAGE-MAC.txt" "$STAGING/"
chmod 755 "$STAGING/install-mac.sh" "$STAGING/uninstall-mac.sh"

mkdir -p "$OUTPUT_DIR"
rm -f "$ARCHIVE" "$CHECKSUMS"
tar -czf "$ARCHIVE" -C "$STAGING" .

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$ARCHIVE" > "$CHECKSUMS"
else
  openssl dgst -sha256 "$ARCHIVE" > "$CHECKSUMS"
fi

echo "Created macOS package: $ARCHIVE"
echo "Created checksum file: $CHECKSUMS"
