#!/bin/bash
cd "$(dirname "$0")"
if [ -z "$1" ]; then
  echo "Перетащите файл озвучки (mp3) в это окно и нажмите Enter."
  read -r -p "Файл: " AUDIO
else
  AUDIO="$1"
fi
AUDIO="${AUDIO%\"}"; AUDIO="${AUDIO#\"}"; AUDIO="${AUDIO/#\~/$HOME}"
python3 make_reel.py "$AUDIO"
echo
read -n 1 -s -r -p "Нажмите любую клавишу, чтобы закрыть окно…"
