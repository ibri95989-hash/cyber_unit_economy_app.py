#!/usr/bin/env bash
# ---------------------------------------------------------------
# Полная сборка вертикального ролика 1080x1920 @60fps + звук.
# Требуется: node + playwright (chromium), ffmpeg, python3.
#   ./build.sh            — полная сборка
#   ./build.sh --preview  — только PNG-кадры для проверки
# ---------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out

# ffmpeg: системный либо из пакета imageio-ffmpeg
if [ -z "${FFMPEG:-}" ]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG=ffmpeg
  else
    FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
  fi
fi
export FFMPEG

if [ "${1:-}" = "--preview" ]; then
  node render.mjs --preview "${2:-0.9,3.4,7.4,11.6,15.0,19.2,23.7}"
  exit 0
fi

echo "==> 1/3  рендер кадров -> H.264"
node render.mjs

echo "==> 2/3  синтез звуковой дорожки"
python3 audio.py out/audio.wav

echo "==> 3/3  сведение видео и звука"
"$FFMPEG" -y -loglevel error \
  -i out/video_silent.mp4 -i out/audio.wav \
  -c:v copy \
  -c:a aac -b:a 160k -ar 44100 -ac 2 \
  -movflags +faststart -shortest \
  out/wildberries_payout_delay_9x16.mp4

"$FFMPEG" -y -loglevel error -i out/wildberries_payout_delay_9x16.mp4 \
  -vf "select=eq(n\,0)" -frames:v 1 out/cover.jpg

echo
echo "готово: out/wildberries_payout_delay_9x16.mp4"
ls -la out/wildberries_payout_delay_9x16.mp4
