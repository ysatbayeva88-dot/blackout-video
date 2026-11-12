#!/usr/bin/env bash
# Full pipeline for out/ant.mp4 («Ты уменьшился до размера муравья»). Steps 1-4 only redo work when inputs changed.
#   1. python3 tools/voiceover.py ant      (TTS per phrase, cached) -> audio/ant_full.mp3 + timings
#      DRAFT=1 adds --draft: phrases that cannot be voiced (no API quota) become timed silence.
#   2. python3 tools/plan_cues_ant.py      (scenes, survival meter, sound cues) -> video/src/ant/cues.json
#   3. python3 tools/sfx_ant.py            ('giant' one-shots, synthesized) -> video/public/ant_*.mp3
#   4. python3 tools/mix_ant.py            (voice + ducked music/SFX, -14 LUFS) -> video/public/ant_mix.mp3
#   5. Remotion render (three depth-of-field layers per frame: slow on CPU-only machines).
# Env: BROWSER=/path/to/chrome-headless-shell, GL=swangle|angle (headless servers need swangle), CONCURRENCY=3.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/voiceover.py ant ${DRAFT:+--draft}
cp audio/ant_timings.json video/src/ant/timings.json
python3 tools/plan_cues_ant.py
python3 tools/sfx_ant.py
python3 tools/mix_ant.py
cd video
mkdir -p ../out
npx remotion render Ant ../out/ant.mp4 ${BROWSER:+--browser-executable="$BROWSER"} ${GL:+--gl="$GL"} --concurrency=${CONCURRENCY:-3} --log=error
echo "out/ant.mp4 ready"
