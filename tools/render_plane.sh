#!/usr/bin/env bash
# Render out/plane.mp4 and normalise loudness to -14 LUFS (Reels/Shorts level).
# Optional: BROWSER=/path/to/chrome-headless-shell to use a local browser.
set -euo pipefail
cd "$(dirname "$0")/../video"
mkdir -p ../out
npx remotion render Plane ../out/plane_raw.mp4 ${BROWSER:+--browser-executable="$BROWSER"} --log=error
ffmpeg -v error -y -i ../out/plane_raw.mp4 -c:v copy \
  -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k ../out/plane.mp4
rm ../out/plane_raw.mp4
echo "out/plane.mp4 ready"
