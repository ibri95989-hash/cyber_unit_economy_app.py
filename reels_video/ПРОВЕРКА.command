#!/bin/bash
cd "$(dirname "$0")"
PY=""
for c in python3 python; do command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }; done
if [ -z "$PY" ]; then echo "  [!] Python не найден. Запустите СТАРТ."; else "$PY" make_reel.py --check; fi
echo
read -n 1 -s -r -p "  Нажмите любую клавишу, чтобы закрыть окно…"
