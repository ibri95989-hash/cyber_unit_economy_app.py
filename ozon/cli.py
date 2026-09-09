"""Командный интерфейс к Ozon: то, чем пользуюсь я, когда работаю с кабинетом.

    python -m ozon.cli check                      # ключи на месте и приняты?
    python -m ozon.cli supplies                   # заявки на поставку
    python -m ozon.cli campaigns                  # рекламные кампании
    python -m ozon.cli bids 12345678              # ставки в кампании
    python -m ozon.cli set-bid 12345678 --sku 1 --bid 35     # сухой прогон
    python -m ozon.cli set-bid 12345678 --sku 1 --bid 35 --apply

Любое изменение по умолчанию идёт сухим прогоном: команда покажет, что
собирается сделать, и остановится. Реальная отправка — только с --apply и
только когда в окружении разрешено OZON_ALLOW_WRITES=1.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .config import load_credentials
from .errors import OzonApiError, OzonWriteBlocked
from .performance import PerformanceApi
from .safety import WriteGuard
from .seller import SellerApi


def show(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def cmd_check(args: argparse.Namespace) -> int:
    creds = load_credentials()
    print("Найденные ключи:\n" + creds.report() + "\n")
    guard = WriteGuard.from_env()
    print(f"Запись разрешена: {'да' if guard.writes_allowed else 'нет (только чтение)'}")
    print(f"Потолок ставки: {guard.max_bid}; шаг не больше {guard.max_change_pct}%\n")

    ok = True
    if creds.has_seller:
        try:
            print(SellerApi(creds).ping())
        except OzonApiError as exc:
            ok = False
            print(f"Seller API: ошибка — {exc}")
    else:
        print("Seller API: ключей нет.")
    if creds.has_performance:
        try:
            print(PerformanceApi(creds).ping())
        except OzonApiError as exc:
            ok = False
            print(f"Performance API: ошибка — {exc}")
    else:
        print("Performance API: ключей нет.")
    return 0 if ok else 1


def cmd_supplies(args: argparse.Namespace) -> int:
    api = SellerApi()
    show(api.supply_orders(limit=args.limit, states=args.state or None))
    return 0


def cmd_supply(args: argparse.Namespace) -> int:
    show(SellerApi().supply_order([args.supply_order_id]))
    return 0


def cmd_timeslots(args: argparse.Namespace) -> int:
    show(SellerApi().timeslots(args.supply_order_id, days=args.days))
    return 0


def cmd_stocks(args: argparse.Namespace) -> int:
    api = SellerApi()
    show(api.stocks_on_warehouses(limit=args.limit) if args.warehouses else api.stocks(limit=args.limit))
    return 0


def cmd_analytics(args: argparse.Namespace) -> int:
    show(SellerApi().analytics(date_from=args.date_from, date_to=args.date_to))
    return 0


def cmd_campaigns(args: argparse.Namespace) -> int:
    show(PerformanceApi().campaigns(state=args.state or ""))
    return 0


def cmd_bids(args: argparse.Namespace) -> int:
    show(PerformanceApi().products(args.campaign_id))
    return 0


def cmd_set_bid(args: argparse.Namespace) -> int:
    api = PerformanceApi()
    bids = {sku: args.bid for sku in args.sku}
    try:
        show(api.set_bids(args.campaign_id, bids, apply=args.apply))
    except OzonWriteBlocked as exc:
        print(str(exc))
        return 2
    return 0


def cmd_campaign_state(args: argparse.Namespace) -> int:
    api = PerformanceApi()
    action = api.activate if args.action == "on" else api.deactivate
    try:
        show(action(args.campaign_id, apply=args.apply))
    except OzonWriteBlocked as exc:
        print(str(exc))
        return 2
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    api = PerformanceApi()
    task = api.statistics(args.campaign_id, date_from=args.date_from, date_to=args.date_to)
    uuid = (task or {}).get("UUID") or (task or {}).get("uuid")
    if not uuid:
        show(task)
        return 1
    print(f"Отчёт заказан: {uuid}. Жду готовности…", file=sys.stderr)
    show(api.statistics_wait(str(uuid)))
    return 0


def cmd_phrases(args: argparse.Namespace) -> int:
    show(PerformanceApi().phrases(date_from=args.date_from, date_to=args.date_to))
    return 0


def cmd_raw(args: argparse.Namespace) -> int:
    body = json.loads(args.body) if args.body else None
    api: Any = SellerApi() if args.api == "seller" else PerformanceApi()
    show(api.call(args.method, args.path, body))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ozon", description="Работа с кабинетом Ozon через API")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check", help="проверить ключи и доступ").set_defaults(func=cmd_check)

    p = sub.add_parser("supplies", help="список заявок на поставку")
    p.add_argument("--limit", type=int, default=50)
    p.add_argument("--state", action="append", help="фильтр по статусу, можно несколько раз")
    p.set_defaults(func=cmd_supplies)

    p = sub.add_parser("supply", help="подробности заявки на поставку")
    p.add_argument("supply_order_id", type=int)
    p.set_defaults(func=cmd_supply)

    p = sub.add_parser("timeslots", help="свободные интервалы поставки")
    p.add_argument("supply_order_id", type=int)
    p.add_argument("--days", type=int, default=14)
    p.set_defaults(func=cmd_timeslots)

    p = sub.add_parser("stocks", help="остатки товаров")
    p.add_argument("--warehouses", action="store_true", help="в разрезе складов FBO")
    p.add_argument("--limit", type=int, default=100)
    p.set_defaults(func=cmd_stocks)

    p = sub.add_parser("analytics", help="аналитика продаж")
    p.add_argument("--date-from", dest="date_from")
    p.add_argument("--date-to", dest="date_to")
    p.set_defaults(func=cmd_analytics)

    p = sub.add_parser("campaigns", help="рекламные кампании")
    p.add_argument("--state", help="например CAMPAIGN_STATE_RUNNING")
    p.set_defaults(func=cmd_campaigns)

    p = sub.add_parser("bids", help="товары и ставки кампании")
    p.add_argument("campaign_id", type=int)
    p.set_defaults(func=cmd_bids)

    p = sub.add_parser("set-bid", help="изменить ставку по товарам кампании")
    p.add_argument("campaign_id", type=int)
    p.add_argument("--sku", type=int, action="append", required=True)
    p.add_argument("--bid", type=float, required=True)
    p.add_argument("--apply", action="store_true", help="отправить в Ozon, а не только показать")
    p.set_defaults(func=cmd_set_bid)

    p = sub.add_parser("campaign", help="включить или выключить кампанию")
    p.add_argument("campaign_id", type=int)
    p.add_argument("action", choices=["on", "off"])
    p.add_argument("--apply", action="store_true")
    p.set_defaults(func=cmd_campaign_state)

    p = sub.add_parser("stats", help="отчёт по кампаниям")
    p.add_argument("campaign_id", type=int, nargs="+")
    p.add_argument("--date-from", dest="date_from")
    p.add_argument("--date-to", dest="date_to")
    p.set_defaults(func=cmd_stats)

    p = sub.add_parser("phrases", help="показы и расход по поисковым фразам")
    p.add_argument("--date-from", dest="date_from")
    p.add_argument("--date-to", dest="date_to")
    p.set_defaults(func=cmd_phrases)

    p = sub.add_parser("raw", help="произвольный метод API")
    p.add_argument("api", choices=["seller", "performance"])
    p.add_argument("method", choices=["GET", "POST", "PATCH", "PUT", "DELETE"])
    p.add_argument("path", help="например /v1/warehouse/list")
    p.add_argument("--body", help="тело запроса в JSON")
    p.set_defaults(func=cmd_raw)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except OzonWriteBlocked as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except OzonApiError as exc:
        print(f"Ozon: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
