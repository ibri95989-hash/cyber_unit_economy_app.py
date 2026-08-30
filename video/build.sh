#!/usr/bin/env bash
# Build the vertical reel from a voice-over track, stretching a fixed
# storyboard to fit its length (no exact word sync - use build_captions.sh
# when you have the script text and want every subtitle to land on its word).
#   ./build.sh path/to/voice.mp3 [output.mp4] [--target 55] [--workers N]
set -euo pipefail
cd "$(dirname "$0")"

VOICE="${1:?usage: ./build.sh voice.mp3 [out.mp4] [--target SECONDS] [--workers N]}"
OUT="${2:-build/wb_unit_economy_vertical.mp4}"
shift || true; shift || true

WORKERS=""
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --workers) WORKERS="$2"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
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
node lint_scenes.mjs render/scenes_a.js render/scenes_b.js

mkdir -p build
python3 analyze_audio.py "$VOICE" -o build/audio.json "${ARGS[@]}"

node capture_parallel.mjs --entry index.html --config build/audio.json \
  --audio "$VOICE" --out "$OUT" --ffmpeg "$FFMPEG" ${WORKERS:+--workers "$WORKERS"}

echo "-- verify --"
python3 verify_render.py "$OUT" build/audio.json
echo "-> $OUT"
