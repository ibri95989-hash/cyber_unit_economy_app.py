#!/bin/bash
cd "$(dirname "$0")"
echo
echo "  Обновляю программу до последней версии."
echo "  Ваши настройки и готовые ролики останутся на месте."
echo
PY=""
for c in python3 python; do command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }; done
if [ -z "$PY" ]; then echo "  [!] Python не найден. Сначала запустите СТАРТ."; else "$PY" update.py; fi
echo
read -n 1 -s -r -p "  Нажмите любую клавишу, чтобы закрыть окно…"
