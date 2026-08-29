#!/usr/bin/env bash
# ---------------------------------------------------------------
# Сведение: дикторская озвучка + процедурная подложка.
# Подложка приглушается под голосом (sidechain), общий уровень
# приводится к -14 LUFS — норма для соцсетей.
#   ./mix.sh <озвучка> <подложка.wav> <результат.wav>
# ---------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
VO="${1:-assets/voiceover.mp3}"
BED="${2:-out/bed.wav}"
OUT="${3:-out/mix.wav}"
: "${FFMPEG:=$(command -v ffmpeg || python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')}"

"$FFMPEG" -y -loglevel error -i "$BED" -i "$VO" -filter_complex "
  [1:a]aformat=channel_layouts=stereo:sample_rates=44100,
       highpass=f=95,
       acompressor=threshold=0.09:ratio=3:attack=8:release=190:makeup=1.6,
       loudnorm=I=-16:TP=-2.0:LRA=9,
       apad=whole_dur=35.2[vo];
  [vo]asplit=2[vo_out][vo_key];
  [0:a]volume=0.85[bedin];
  [bedin][vo_key]sidechaincompress=threshold=0.07:ratio=4.5:attack=8:release=300:makeup=1[bed];
  [bed][vo_out]amix=inputs=2:duration=longest:normalize=0,
       alimiter=limit=0.96:level=disabled,
       loudnorm=I=-14:TP=-1.5:LRA=11,
       atrim=0:35.2
" -c:a pcm_s16le -ar 44100 -ac 2 "$OUT"
echo "сведено: $OUT"
