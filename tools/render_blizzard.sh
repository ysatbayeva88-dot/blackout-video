#!/usr/bin/env bash
# Full pipeline for out/blizzard.mp4. Steps 1-3 only redo work when inputs changed.
#   1. python3 tools/voiceover.py blizzard  (TTS per phrase, cached) -> audio/blizzard_full.mp3 + timings
#   2. python3 tools/plan_cues_blizzard.py  (scene + sound cue sheet) -> video/src/blizzard/cues.json
#   3. python3 tools/mix_blizzard.py        (voice + ducked music/SFX, -14 LUFS) -> video/public/blizzard_mix.mp3
#   4. Remotion render.
# Env: BROWSER=/path/to/chrome-headless-shell, GL=swangle|angle (headless servers need swangle).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/voiceover.py blizzard
cp audio/blizzard_timings.json video/src/blizzard/timings.json
python3 tools/plan_cues_blizzard.py
python3 tools/mix_blizzard.py
cd video
mkdir -p ../out
npx remotion render Blizzard ../out/blizzard.mp4 ${BROWSER:+--browser-executable="$BROWSER"} ${GL:+--gl="$GL"} --log=error
echo "out/blizzard.mp4 ready"
