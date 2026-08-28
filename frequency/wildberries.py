"""Wildberries: частотность запроса.

Работает без ключей: оценка собирается из двух независимых открытых сигналов —
сколько товаров WB показывает под запрос (публичный поиск) и какой спрос на
запрос в вебе (Google Trends). Если есть токен продавца с правом «Аналитика»,
берём точные показы из отчёта «Поисковые запросы» — он важнее любых оценок.
"""
from __future__ import annotations

from typing import Optional

from .estimate import blend, from_product_count, from_web_demand
from .http import SourceError, get_json, post_json
from .models import SourceResult, Status
from .trends import TrendsDemand

SOURCE = "Wildberries"

PUBLIC_SEARCH = "https://search.wb.ru/exactmatch/ru/common/v13/search"
PUBLIC_HINT = "https://search.wb.ru/suggests/api/v7/hint"
ANALYTICS_REPORT = (
    "https://seller-analytics-api.wildberries.ru/api/v2/search-report/report"
)


def _public_products(query: str) -> Optional[int]:
    """Сколько товаров WB показывает по запросу."""
    data = get_json(
        PUBLIC_SEARCH,
        params={
            "ab_testing": "false",
            "appType": 1,
            "curr": "rub",
            "dest": -1257786,
            "lang": "ru",
            "query": query,
            "resultset": "filters",
            "spp": 30,
            "suppressSpellcheck": "false",
        },
        headers={"Origin": "https://www.wildberries.ru"},
    )
    for key in ("total", "totalProducts"):
        if isinstance(data, dict) and isinstance(data.get(key), int):
            return data[key]
    payload = data.get("data") if isinstance(data, dict) else None
    if isinstance(payload, dict) and isinstance(payload.get("total"), int):
        return payload["total"]
    return None


def _suggestions(query: str) -> list[str]:
    try:
        data = get_json(
            PUBLIC_HINT,
            params={"query": query, "gender": "common", "locale": "ru", "lang": "ru"},
            headers={"Origin": "https://www.wildberries.ru"},
            attempts=2,
        )
    except SourceError:
        return []
    items = data if isinstance(data, list) else data.get("suggests", [])
    out = []
    for item in items or []:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict) and item.get("name"):
            out.append(item["name"])
    return out[:10]


def _exact_from_api(query: str, token: str) -> SourceResult:
    """Отчёт «Поисковые запросы» продавца: реальные показы за 30 дней."""
    from datetime import date, timedelta

    end = date.today()
    start = end - timedelta(days=30)
    data = post_json(
        ANALYTICS_REPORT,
        headers={"Authorization": token},
        json_body={
            "currentPeriod": {"start": start.isoformat(), "end": end.isoformat()},
            "searchTexts": [query],
            "limit": 30,
            "offset": 0,
            "orderBy": {"field": "openCard", "mode": "desc"},
        },
    )
    groups = (data or {}).get("data", {}).get("groups") or []
    for group in groups:
        text = (group.get("searchText") or "").strip().lower()
        if text != query.strip().lower():
            continue
        freq = group.get("frequency") or {}
        current = freq.get("current")
        if isinstance(current, (int, float)):
            return SourceResult(
                SOURCE,
                query,
                Status.EXACT,
                int(current),
                "Отчёт «Поисковые запросы» WB за последние 30 дней.",
            )
    return SourceResult(
        SOURCE,
        query,
        Status.ERROR,
        None,
        "API продавца ответил, но по этому запросу данных за 30 дней нет.",
    )


def fetch(
    query: str,
    token: Optional[str] = None,
    web_demand: Optional[TrendsDemand] = None,
) -> SourceResult:
    if token:
        try:
            return _exact_from_api(query, token)
        except SourceError as exc:
            fallback_note = f"API продавца недоступен ({exc}). "
    else:
        fallback_note = ""

    products: Optional[int] = None
    signals: list[str] = []
    try:
        products = _public_products(query)
    except SourceError:
        pass

    by_products = from_product_count(SOURCE, query, products or 0)
    if by_products:
        signals.append(f"{products:,} товаров в выдаче WB".replace(",", " "))
    by_demand = from_web_demand(SOURCE, web_demand.monthly if web_demand else None)
    if by_demand:
        signals.append("спрос в вебе по Google Trends")

    monthly = blend(by_products, by_demand)
    related = [(s, None) for s in _suggestions(query)]
    if monthly is None:
        return SourceResult(
            SOURCE,
            query,
            Status.ERROR,
            None,
            f"{fallback_note}WB не ответил и замера спроса нет — повторите через минуту.",
            related,
        )
    return SourceResult(
        SOURCE,
        query,
        Status.ESTIMATE,
        monthly,
        f"{fallback_note}Оценка по открытым данным: " + " + ".join(signals) + ".",
        related,
        {"products": products},
    )
