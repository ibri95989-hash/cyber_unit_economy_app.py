"""Перенести ключи Ozon из произвольного файла в .env.

Ключи обычно лежат в заметке вида «Client-Id: 12345», сохранённой рядом с
кабинетом. Перепечатывать их в форму руками незачем: здесь разбирается
свободный текст и раскладывается по четырём известным настройкам.

    python -m ozon.import_keys "C:\\Users\\gost\\Desktop\\Marketplace-AI\\keys.txt"
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

from .config import mask, save_env

# Client ID рекламного кабинета выглядит как почта на домене Ozon —
# это самый надёжный признак, чтобы не спутать его с Client-Id продавца.
PERFORMANCE_MARK = "@advertising"
SELLER_WORDS = ("seller", "селлер", "продав")
PERFORMANCE_WORDS = ("performance", "перформанс", "реклам", "advertising")


def _pairs(text: str) -> List[tuple]:
    """Разобрать текст на пары «подпись — значение», сохраняя порядок."""
    found: List[tuple] = []
    section = ""
    for raw in text.splitlines():
        line = raw.strip().strip(",")
        if not line or line.startswith("#"):
            continue

        lowered = line.lower()
        # Заголовок раздела: строка без значения, но с названием кабинета.
        if ":" not in line and "=" not in line:
            if any(word in lowered for word in SELLER_WORDS + PERFORMANCE_WORDS):
                section = lowered
            continue

        separator = ":" if (":" in line and ("=" not in line or line.index(":") < line.index("="))) else "="
        label, _, value = line.partition(separator)
        value = value.strip().strip('"').strip("'").strip(",")
        if value:
            found.append((label.strip().lower(), value, section))
    return found


def parse(text: str) -> Dict[str, str]:
    """Достать четыре ключа из текста. Чего нет — того нет."""
    keys: Dict[str, str] = {}
    for label, value, section in _pairs(text):
        context = f"{section} {label}"
        performance = any(word in context for word in PERFORMANCE_WORDS)

        if PERFORMANCE_MARK in value.lower():
            keys.setdefault("OZON_PERF_CLIENT_ID", value)
        elif "secret" in label or "секрет" in label:
            keys.setdefault("OZON_PERF_CLIENT_SECRET", value)
        elif "api" in label and "key" in label or "ключ" in label:
            keys.setdefault("OZON_API_KEY", value)
        elif "client" in label or "id" == label.strip() or "клиент" in label:
            target = "OZON_PERF_CLIENT_ID" if performance else "OZON_CLIENT_ID"
            keys.setdefault(target, value)
    return keys


def import_file(path: Path) -> Dict[str, str]:
    """Прочитать файл и сохранить найденные ключи в .env."""
    if not path.exists():
        raise FileNotFoundError(f"Файл не найден: {path}")
    text = path.read_text(encoding="utf-8", errors="replace")
    keys = parse(text)
    if not keys:
        raise ValueError(
            "В файле не нашлось ничего похожего на ключи. Ожидаются строки "
            "вида «Client-Id: 12345» или «api_key=...»."
        )
    save_env(keys)
    return keys


def main(argv: Optional[List[str]] = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if not args:
        print("Укажите путь к файлу с ключами.")
        return 1
    try:
        keys = import_file(Path(" ".join(args)))
    except (OSError, ValueError) as exc:
        print(f"[!] {exc}")
        return 1
    print("Перенесено в .env:")
    for name, value in keys.items():
        print(f"  {name} = {mask(value)}")
    missing = {"OZON_CLIENT_ID", "OZON_API_KEY", "OZON_PERF_CLIENT_ID", "OZON_PERF_CLIENT_SECRET"} - set(keys)
    if missing:
        print("Не нашлось: " + ", ".join(sorted(missing)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
