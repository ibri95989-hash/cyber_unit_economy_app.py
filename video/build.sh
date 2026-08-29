#!/usr/bin/env bash
# ---------------------------------------------------------------
# Полная сборка вертикального ролика 1080x1920 @60fps со звуком.
# Требуется: node + playwright (chromium), ffmpeg, python3.
#   ./build.sh                   — полная сборка
#   ./build.sh --preview 3.5,20  — только PNG-кадры указанных секунд
#
# Если рядом лежит озвучка out/vo_source.mp3 (или путь задан
# переменной VO), она сводится с процедурной подложкой: подложка
# приглушается под голосом, общий уровень приводится к -14 LUFS.
# Без озвучки в ролик уходит одна подложка.
# ---------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out

if [ -z "${FFMPEG:-}" ]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG=ffmpeg
  else
    FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
  fi
fi
export FFMPEG

if [ "${1:-}" = "--preview" ]; then
  node render.mjs --preview "${2:-1.5,5.9,11.9,17.6,20.5,26.9,33.6}"
  exit 0
fi

echo "==> 1/4  рендер кадров -> H.264"
node render.mjs

echo "==> 2/4  синтез звуковой подложки"
python3 audio.py out/bed.wav

VO="${VO:-assets/voiceover.mp3}"
if [ -f "$VO" ]; then
  echo "==> 3/4  сведение озвучки с подложкой"
  ./mix.sh "$VO" out/bed.wav out/mix.wav
  TRACK=out/mix.wav
else
  echo "==> 3/4  озвучка не найдена ($VO) — в ролик уходит одна подложка"
  TRACK=out/bed.wav
fi

echo "==> 4/4  сведение видео и звука"
"$FFMPEG" -y -loglevel error \
  -i out/video_silent.mp4 -i "$TRACK" \
  -c:v copy \
  -c:a aac -b:a 160k -ar 44100 -ac 2 \
  -movflags +faststart -shortest \
  out/wildberries_payout_delay_9x16.mp4

"$FFMPEG" -y -loglevel error -ss 0.7 -i out/wildberries_payout_delay_9x16.mp4 \
  -frames:v 1 -q:v 2 out/cover.jpg

echo
echo "готово: out/wildberries_payout_delay_9x16.mp4"
ls -la out/wildberries_payout_delay_9x16.mp4
