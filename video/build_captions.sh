#!/usr/bin/env bash
# Build a vertical reel with burned-in, word-synced captions from a
# voice-over + its exact script text (one caption card per line, blank
# lines are just separators - see assets/script_wb_leaks_profit.txt for
# the format). This is the pipeline to use whenever you have the script:
# it aligns every subtitle to the real pauses in the audio instead of
# stretching a fixed storyboard to fit.
#   ./build_captions.sh voice.mp3 script.txt [out.mp4] [--workers N]
set -euo pipefail
cd "$(dirname "$0")"

VOICE="${1:?usage: ./build_captions.sh voice.mp3 script.txt [out.mp4] [--workers N]}"
SCRIPT="${2:?usage: ./build_captions.sh voice.mp3 script.txt [out.mp4] [--workers N]}"
OUT="${3:-build/reel.mp4}"
shift || true; shift || true; shift || true

WORKERS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --workers) WORKERS="$2"; shift 2 ;;
    *) shift ;;
  esac
done

FFMPEG="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || echo ffmpeg)}"
export FFMPEG

[ -f render/fonts.css ] || python3 fetch_fonts.py
[ -d node_modules/playwright ] || {
  mkdir -p node_modules
  ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright
  ln -sfn /opt/node22/lib/node_modules/playwright-core node_modules/playwright-core
}

echo "-- lint --"
node lint_scenes.mjs render/scenes2_a.js render/scenes2_b.js render/captions.js

mkdir -p build
python3 analyze_captions.py "$VOICE" "$SCRIPT" -o build/captions.json

node capture_parallel.mjs --entry index2.html --config build/captions.json \
  --audio "$VOICE" --out "$OUT" --ffmpeg "$FFMPEG" ${WORKERS:+--workers "$WORKERS"}

echo "-- verify --"
python3 verify_render.py "$OUT" build/captions.json
echo "-> $OUT"
