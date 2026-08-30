#!/bin/bash
cd "$(dirname "$0")"
echo "Установка Reels Kit. Это займёт около 10 минут."
echo
python3 install.py || {
  echo
  echo "Не получилось. Проверьте, что установлен Python 3.9 или новее:"
  echo "  python3 --version"
}
echo
read -n 1 -s -r -p "Нажмите любую клавишу, чтобы закрыть окно…"
