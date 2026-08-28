"""Ozon: частотность запроса.

Работает без ключей: оценка складывается из публичной выдачи Ozon (сколько
товаров под запрос) и замера спроса в вебе через Google Trends. Если есть
Client Id и Client Secret рекламного кабинета, Performance API даёт точные
показы по фразе, и они имеют приоритет.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

import requests

from .estimate import blend, from_product_count, from_web_demand
from .http import DEFAULT_HEADERS, SourceError, get_json, post_json
from .models import SourceResult, Status
from .trends import TrendsDemand

SOURCE = "Ozon"

PUBLIC_SEARCH = "https://www.ozon.ru/api/composer-api.bx/page/json/v2"
PUBLIC_SUGGEST = "https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2"
TOKEN_URL = "https://api-performance.ozon.ru/api/client/token"
PHRASES_URL = "https://api-performance.ozon.ru/api/client/statistics/phrases"


def _public_products(query: str) -> Optional[int]:
    data = get_json(
        PUBLIC_SEARCH,
        params={"url": f"/search/?text={query}&from_global=true"},
        headers={"Referer": "https://www.ozon.ru/"},
    )
    state = (data or {}).get("widgetStates") or {}
    import json as _json
    import re

    for key, raw in state.items():
        if "searchResultsV2" not in key and "tile" not in key.lower():
            continue
        try:
            parsed = _json.loads(raw)
        except (TypeError, ValueError):
            continue
        for field in ("totalFound", "total", "count"):
            if isinstance(parsed.get(field), int):
                return parsed[field]
    match = re.search(r'"totalFound":\s*(\d+)', _json.dumps(data, ensure_ascii=False))
    return int(match.group(1)) if match else None


def _token(client_id: str, client_secret: str) -> str:
    data = post_json(
        TOKEN_URL,
        json_body={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
        },
    )
    token = (data or {}).get("access_token")
    if not token:
        raise SourceError("Performance API не вернул access_token.")
    return token


def _exact_from_api(query: str, client_id: str, client_secret: str) -> SourceResult:
    token = _token(client_id, client_secret)
    end = date.today()
    start = end - timedelta(days=30)
    data = post_json(
        PHRASES_URL,
        headers={"Authorization": f"Bearer {token}"},
        json_body={
            "dateFrom": start.isoformat(),
            "dateTo": end.isoformat(),
            "page": 0,
            "pageSize": 500,
        },
    )
    rows = (data or {}).get("rows") or (data or {}).get("phrases") or []
    needle = query.strip().lower()
    for row in rows:
        phrase = str(row.get("phrase") or row.get("searchPhrase") or "").strip().lower()
        if phrase != needle:
            continue
        views = row.get("views") or row.get("shows") or row.get("impressions")
        if isinstance(views, (int, float)):
            return SourceResult(
                SOURCE,
                query,
                Status.EXACT,
                int(views),
                "Performance API Ozon: показы по фразе за 30 дней.",
            )
    return SourceResult(
        SOURCE,
        query,
        Status.ERROR,
        None,
        "Performance API ответил, но фразы нет в статистике ваших кампаний.",
    )


def _suggestions(query: str) -> list[str]:
    try:
        resp = requests.get(
            "https://www.ozon.ru/api/composer-api.bx/_action/searchSuggestions",
            params={"text": query},
            headers={**DEFAULT_HEADERS, "Referer": "https://www.ozon.ru/"},
            timeout=10,
        )
        payload = resp.json()
    except Exception:  # noqa: BLE001 - подсказки не критичны
        return []
    out: list[str] = []

    def walk(node):
        if isinstance(node, dict):
            text = node.get("text") or node.get("title")
            if isinstance(text, str) and 2 < len(text) < 80:
                out.append(text)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    seen: list[str] = []
    for item in out:
        if item.lower() not in {s.lower() for s in seen}:
            seen.append(item)
    return seen[:10]


def fetch(
    query: str,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    web_demand: Optional[TrendsDemand] = None,
) -> SourceResult:
    note = ""
    if client_id and client_secret:
        try:
            return _exact_from_api(query, client_id, client_secret)
        except SourceError as exc:
            note = f"Performance API недоступен ({exc}). "

    products: Optional[int] = None
    signals: list[str] = []
    try:
        products = _public_products(query)
    except SourceError:
        pass

    by_products = from_product_count(SOURCE, query, products or 0)
    if by_products:
        signals.append(f"{products:,} товаров в выдаче Ozon".replace(",", " "))
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
            f"{note}Ozon не ответил и замера спроса нет — повторите через минуту.",
            related,
        )
    return SourceResult(
        SOURCE,
        query,
        Status.ESTIMATE,
        monthly,
        f"{note}Оценка по открытым данным: " + " + ".join(signals) + ".",
        related,
        {"products": products},
    )
