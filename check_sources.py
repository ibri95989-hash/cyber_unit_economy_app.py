"""Быстрая проверка источников из терминала, без запуска интерфейса.

    python check_sources.py "ароматизатор в машину"
    python check_sources.py --proxy socks5://127.0.0.1:1080 "ароматизатор в машину"

Показывает, что ответил каждый источник, и сразу видно, доступны ли Trends,
WB и Ozon с этой машины. Без --proxy берётся системный HTTPS_PROXY.
"""
from __future__ import annotations

import argparse

from frequency.aggregator import collect
from frequency.http import check_connection, configure


def main() -> int:
    parser = argparse.ArgumentParser(description="Проверка источников частотности")
    parser.add_argument("query", nargs="*", help="проверяемый запрос")
    parser.add_argument("--proxy", help="http://, https:// или socks5:// адрес прокси")
    parser.add_argument(
        "--no-system-proxy",
        action="store_true",
        help="игнорировать HTTPS_PROXY из окружения",
    )
    args = parser.parse_args()

    configure(args.proxy, trust_env=not args.no_system_proxy)
    query = " ".join(args.query).strip() or "ароматизатор в машину"

    ok_net, message = check_connection()
    print(f"Сеть: {message}\n")
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
            "Ни один источник не ответил. Обычно это закрытый выход в интернет — "
            "укажите прокси: python check_sources.py --proxy socks5://host:port "
            f'"{query}"'
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
