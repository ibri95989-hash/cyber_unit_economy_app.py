"""Быстрая проверка источников из терминала, без запуска интерфейса.

    python check_sources.py "ароматизатор в машину"

Показывает, что ответил каждый источник, и сразу видно, доступны ли Trends,
WB и Ozon с этой машины.
"""
from __future__ import annotations

import sys

from frequency.aggregator import collect


def main() -> int:
    query = " ".join(sys.argv[1:]).strip() or "ароматизатор в машину"
    print(f"Запрос: {query}\n")

    results = collect(query)
    ok = 0
    for res in results:
        value = f"{res.monthly:,}".replace(",", " ") if res.is_number else "—"
        ok += 1 if res.is_number else 0
        print(f"{res.source:<14} {value:>12}/мес  [{res.label}]")
        print(f"{'':<14} {res.detail}\n")

    if not ok:
        print(
            "Ни один источник не ответил. Обычно это закрытый выход в интернет "
            "(прокси или VPN) — проверьте: curl -I https://trends.google.com/"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
