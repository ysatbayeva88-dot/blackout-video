#!/usr/bin/env bash
# Full pipeline for out/plane.mp4. Steps 1-3 only redo work when inputs changed.
#   1. python3 tools/voiceover.py   (TTS per phrase, cached)  -> audio/plane_full.mp3 + timings
#   2. python3 tools/plan_cues.py   (scene + sound cue sheet) -> video/src/sim/cues.json
#   3. python3 tools/mix_plane.py   (voice + ducked music/SFX, -14 LUFS) -> video/public/plane_mix.mp3
#   4. Remotion render.
# Env: BROWSER=/path/to/chrome-headless-shell, GL=swangle|angle (headless servers need swangle).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/voiceover.py
cp audio/plane_timings.json video/src/timings.json
python3 tools/plan_cues.py
python3 tools/mix_plane.py
cd video
mkdir -p ../out
npx remotion render Plane ../out/plane.mp4 ${BROWSER:+--browser-executable="$BROWSER"} ${GL:+--gl="$GL"} --log=error
echo "out/plane.mp4 ready"
