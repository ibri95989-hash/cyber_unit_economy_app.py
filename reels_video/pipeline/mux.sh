#!/bin/bash
# Сведение: нормализация громкости озвучки + подкладка её под отрендеренное видео.
#   mux.sh [video.mp4] [voice.mp3] [out.mp4]
set -e
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
IN=${1:-/home/user/work/out/reels_raw.mp4}
AUD=${2:-/home/user/work/voice.mp3}
OUT=${3:-/home/user/work/out/REELS_9x16_final.mp4}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

DUR=$("$FF" -i "$IN" 2>&1 | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' | head -1 \
      | awk -F: '{print $1*3600+$2*60+$3}')
echo "video duration: ${DUR}s"

# 1) громкость -> -14 LUFS (уровень Instagram/TikTok/YouTube), дотягиваем тишиной до длины видео.
#    Отдельным шагом: apad вместе с -shortest и "-c:v copy" в одной команде уводит ffmpeg в вечный цикл.
"$FF" -y -v error -i "$AUD" \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,apad=whole_dur=${DUR}" \
  -t "$DUR" -c:a aac -b:a 192k -ar 48000 "$TMP/audio.m4a"

# 2) складываем без перекодирования видео
"$FF" -y -v error -i "$IN" -i "$TMP/audio.m4a" -map 0:v:0 -map 1:a:0 \
  -c copy -movflags +faststart "$OUT"

ls -la "$OUT"
"$FF" -i "$OUT" 2>&1 | grep -E "Duration|Stream"
