#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/build/icon.png"
OUT="$ROOT/build"

if [ ! -f "$SRC" ]; then
  echo "找不到源图标: $SRC" >&2
  exit 1
fi

mkdir -p "$OUT/icon.iconset"

for size in 16 32 128 256 512; do
  double=$((size * 2))
  sips -z "$size" "$size" "$SRC" --out "$OUT/icon.iconset/icon_${size}x${size}.png" >/dev/null
  sips -z "$double" "$double" "$SRC" --out "$OUT/icon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$OUT/icon.iconset" -o "$OUT/icon.icns"
rm -rf "$OUT/icon.iconset"

ls -lh "$OUT/icon.png" "$OUT/icon.icns"
