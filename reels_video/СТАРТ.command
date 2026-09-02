#!/bin/bash
cd "$(dirname "$0")"
clear
echo
echo "  ================================================"
echo "     REELS KIT — ролик 9:16 из вашей озвучки"
echo "  ================================================"
echo

PY=""
for c in python3 python; do
  command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
if [ -z "$PY" ]; then
  echo "  [!] На компьютере не найден Python."
  echo "      Скачайте его с https://www.python.org/downloads/"
  echo "      и запустите СТАРТ снова."
  echo
  read -n 1 -s -r -p "  Нажмите любую клавишу…"; exit 1
fi

if [ ! -f src/Montserrat.ttf ]; then
  echo "  Первый запуск: устанавливаю всё необходимое."
  echo "  Это займёт около 10 минут и делается один раз."
  echo
  "$PY" install.py || {
    echo; echo "  [!] Установка не завершилась. Проверьте интернет и запустите снова."
    echo; read -n 1 -s -r -p "  Нажмите любую клавишу…"; exit 1; }
  clear; echo; echo "  Установка завершена."; echo
fi

AUDIO="$1"
if [ -z "$AUDIO" ]; then
  echo "  Перетащите файл озвучки (mp3) мышью в это окно"
  echo "  и нажмите Enter."
  echo
  read -r -p "  Файл: " AUDIO
fi
AUDIO="${AUDIO%\"}"; AUDIO="${AUDIO#\"}"; AUDIO="${AUDIO%\'}"; AUDIO="${AUDIO#\'}"
AUDIO="${AUDIO/#\~/$HOME}"
AUDIO="$(echo "$AUDIO" | sed 's/[[:space:]]*$//')"
if [ ! -f "$AUDIO" ]; then
  echo; echo "  [!] Файл не найден: $AUDIO"
  echo; read -n 1 -s -r -p "  Нажмите любую клавишу…"; exit 1
fi

echo
echo "  Собираю ролик. Не закрывайте окно."
echo
"$PY" make_reel.py "$AUDIO" && { echo; echo "  Готово."; open out 2>/dev/null || true; }
echo
read -n 1 -s -r -p "  Нажмите любую клавишу, чтобы закрыть окно…"
