"""Ежедневная проверка кабинета без участия человека.

Смысл простой: срочное — вроде поставки, которую надо отвезти послезавтра, —
должно само напомнить о себе, а не ждать, пока кто-то откроет панель.

    python -m ozon.watch          # проверить и записать отчёт
    python -m ozon.watch --quiet  # молча, только код возврата

Код возврата 2 означает «есть срочное»: по нему запускающий скрипт решает,
показывать ли окно с напоминанием.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .errors import OzonApiError
from .insights import СРОЧНО, analyse
from .snapshot import ROOT, collect

REPORT_FILE = ROOT / "ozon_daily.txt"
HISTORY_FILE = ROOT / "ozon_daily.jsonl"


def format_report(findings: List[Dict[str, str]]) -> str:
    """Отчёт в виде, который не стыдно показать в окне уведомления."""
    if not findings:
        return "Кабинет в порядке: срочного нет."
    lines: List[str] = []
    for f in findings:
        метка = {"срочно": "[!]", "внимание": "[~]"}.get(f["уровень"], "   ")
        lines.append(f"{метка} {f['заголовок']}: {f['вывод']}")
        if f["цифры"]:
            lines.append(f"      {f['цифры']}")
    return "\n".join(lines)


def run(*, quiet: bool = False) -> int:
    """Собрать данные, посчитать выводы, записать отчёт."""
    try:
        snapshot = collect()
    except OzonApiError as exc:
        if not quiet:
            print(f"[!] {exc}")
        return 1

    findings = snapshot.get("выводы") or analyse(snapshot)
    urgent = [f for f in findings if f["уровень"] == СРОЧНО]
    report = format_report(findings)

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    REPORT_FILE.write_text(f"Проверка {stamp}\n\n{report}\n", encoding="utf-8")
    try:
        with HISTORY_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"когда": stamp, "выводы": findings}, ensure_ascii=False) + "\n")
    except OSError:
        pass

    if not quiet:
        print(report)
    return 2 if urgent else 0


def main(argv: Optional[List[str]] = None) -> int:
    args = set(argv if argv is not None else sys.argv[1:])
    return run(quiet="--quiet" in args)


if __name__ == "__main__":
    raise SystemExit(main())
