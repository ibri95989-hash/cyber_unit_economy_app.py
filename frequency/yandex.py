"""Яндекс: сколько раз запрос вводили в поиске за месяц.

Работает без ключей: базовый режим — оценка по Google Trends, приведённая к
абсолютным показам через опорные запросы (frequency/trends.py).

Если ключи всё-таки есть, они дают точные цифры и имеют приоритет:
  1) Официальный Wordstat API — OAuth-токен приложения Яндекс ID
     (https://yandex.ru/dev/wordstat/).
  2) XMLRiver — платный шлюз к Вордстату, user id и key.
"""
from __future__ import annotations

from typing import Optional

from .http import SourceError, get_json, post_json
from .models import SourceResult, Status
from .trends import TrendsDemand, TrendsUnavailable, demand as trends_demand

SOURCE = "Яндекс"

WORDSTAT_TOP = "https://api.wordstat.yandex.net/v1/topRequests"
XMLRIVER_URL = "https://xmlriver.com/wordstat/json"

# Коды регионов Вордстата: пусто = вся Россия и мир, 225 = Россия.
DEFAULT_REGIONS = [225]


def _from_wordstat(query: str, token: str, regions: list[int]) -> SourceResult:
    data = post_json(
        WORDSTAT_TOP,
        headers={"Authorization": f"Bearer {token}"},
        json_body={
            "phrase": query,
            "regions": regions or [],
            "devices": ["all"],
        },
    )
    total = None
    if isinstance(data, dict):
        for key in ("totalCount", "total", "count", "shows"):
            if isinstance(data.get(key), (int, float)):
                total = int(data[key])
                break
        if total is None:
            including = data.get("includingPhrases") or {}
            items = including.get("items") or []
            for item in items:
                if str(item.get("phrase", "")).strip().lower() == query.strip().lower():
                    total = int(item.get("count", 0))
                    break

    related: list[tuple[str, Optional[int]]] = []
    including = (data or {}).get("includingPhrases") or {}
    for item in (including.get("items") or [])[:10]:
        phrase = item.get("phrase")
        count = item.get("count")
        if phrase:
            related.append((phrase, int(count) if isinstance(count, (int, float)) else None))

    if total is None:
        return SourceResult(SOURCE, query, Status.ERROR, None, "Вордстат не вернул частотность.", related)
    return SourceResult(
        SOURCE, query, Status.EXACT, total, "Wordstat API: показов в месяц по фразе.", related
    )


def _from_xmlriver(query: str, user: str, key: str, regions: list[int]) -> SourceResult:
    params = {"user": user, "key": key, "query": query}
    if regions:
        params["region"] = regions[0]
    data = get_json(XMLRIVER_URL, params=params)
    content = (data or {}).get("content") or data
    total = None
    related: list[tuple[str, Optional[int]]] = []
    if isinstance(content, dict):
        includes = content.get("includingPhrases") or content.get("phrases") or []
        for item in includes:
            phrase = str(item.get("phrase") or item.get("text") or "")
            count = item.get("number") or item.get("count")
            count = int(count) if isinstance(count, (int, float)) else None
            if phrase.strip().lower() == query.strip().lower() and count is not None:
                total = count
            elif phrase:
                related.append((phrase, count))
    if total is None and related:
        # Вордстат первой строкой отдаёт саму фразу — берём максимум как базовую частоту.
        total = max((c for _, c in related if c is not None), default=None)
    if total is None:
        return SourceResult(SOURCE, query, Status.ERROR, None, "XMLRiver не вернул частотность.", related[:10])
    return SourceResult(
        SOURCE, query, Status.EXACT, total, "XMLRiver (данные Вордстата): показов в месяц.", related[:10]
    )


def fetch(
    query: str,
    oauth_token: Optional[str] = None,
    xmlriver_user: Optional[str] = None,
    xmlriver_key: Optional[str] = None,
    regions: Optional[list[int]] = None,
    web_demand: Optional[TrendsDemand] = None,
) -> SourceResult:
    regions = regions if regions is not None else DEFAULT_REGIONS
    errors = []
    if oauth_token:
        try:
            return _from_wordstat(query, oauth_token, regions)
        except SourceError as exc:
            errors.append(f"Wordstat API: {exc}")
    if xmlriver_user and xmlriver_key:
        try:
            return _from_xmlriver(query, xmlriver_user, xmlriver_key, regions)
        except SourceError as exc:
            errors.append(f"XMLRiver: {exc}")
    # Ключей нет (или они не сработали) — считаем оценку без них.
    trends_error: Optional[str] = None
    if web_demand is None:
        try:
            web_demand = trends_demand(query)
        except TrendsUnavailable as exc:
            trends_error = str(exc)

    prefix = ("Ключи не сработали: " + " | ".join(errors) + ". ") if errors else ""
    if web_demand is None:
        return SourceResult(
            SOURCE,
            query,
            Status.ERROR,
            None,
            prefix
            + (trends_error or "Google Trends не отвечает")
            + " — повторите через минуту.",
        )
    return SourceResult(
        SOURCE, query, Status.ESTIMATE, web_demand.monthly, prefix + web_demand.note
    )
