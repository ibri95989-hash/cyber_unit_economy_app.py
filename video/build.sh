#!/usr/bin/env bash
# Build the vertical reel from a voice-over track.
#   ./build.sh path/to/voice.mp3 [output.mp4] [--target 55]
set -euo pipefail
cd "$(dirname "$0")"

VOICE="${1:?usage: ./build.sh voice.mp3 [out.mp4] [--target SECONDS]}"
OUT="${2:-build/wb_unit_economy_vertical.mp4}"
shift || true; shift || true

FFMPEG="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || echo ffmpeg)}"
export FFMPEG

[ -f render/fonts.css ] || python3 fetch_fonts.py
[ -d node_modules/playwright ] || {
  mkdir -p node_modules
  ln -sfn /opt/node22/lib/node_modules/playwright node_modules/playwright
  ln -sfn /opt/node22/lib/node_modules/playwright-core node_modules/playwright-core
}

mkdir -p build
python3 analyze_audio.py "$VOICE" -o build/audio.json "$@"
node capture.mjs --audio "$VOICE" --out "$OUT" --ffmpeg "$FFMPEG"
echo "-> $OUT"
