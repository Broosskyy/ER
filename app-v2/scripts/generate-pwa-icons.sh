#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/images/icon.png"
OUT="$ROOT/public/pwa"

mkdir -p "$OUT"

ffmpeg -y -i "$SRC" -vf scale=192:192 "$OUT/icon-192.png" >/dev/null 2>&1
ffmpeg -y -i "$SRC" -vf scale=512:512 "$OUT/icon-512.png" >/dev/null 2>&1
ffmpeg -y -i "$SRC" -vf "scale=410:410,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x0B0B0F" "$OUT/icon-maskable-512.png" >/dev/null 2>&1
ffmpeg -y -i "$SRC" -vf scale=180:180 "$OUT/apple-touch-icon.png" >/dev/null 2>&1
cp "$ROOT/assets/images/favicon.png" "$ROOT/public/favicon.png"

echo "Generated PWA icons in public/pwa"
