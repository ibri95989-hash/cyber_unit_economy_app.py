"""Google: частотность запроса в РФ.

Точные цифры даёт только Keyword Planner (Google Ads API) — там нужен
developer token и аккаунт Ads. Если он не подключён, показываем оценку от
Вордстата по доле рынка Google в России и подтягиваем подсказки Google Suggest.
"""
from __future__ import annotations

from typing import Optional

from .estimate import google_from_yandex
from .http import session as new_session
from .models import SourceResult, Status
from .trends import TrendsDemand

SOURCE = "Google"

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"


def _suggestions(query: str) -> list[str]:
    try:
        resp = new_session().get(
            SUGGEST_URL,
            params={"client": "firefox", "hl": "ru", "gl": "ru", "q": query},
            timeout=10,
        )
        data = resp.json()
    except Exception:  # noqa: BLE001 - подсказки не критичны
        return []
    if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
        return [str(x) for x in data[1][:10]]
    return []


def fetch(
    query: str,
    yandex_monthly: Optional[int] = None,
    web_demand: Optional[TrendsDemand] = None,
) -> SourceResult:
    related = [(s, None) for s in _suggestions(query)]
    base = yandex_monthly or (web_demand.monthly if web_demand else None)
    monthly = google_from_yandex(base)
    if monthly is None:
        return SourceResult(
            SOURCE,
            query,
            Status.ERROR,
            None,
            "Нет базового замера спроса: Google Trends не ответил, повторите через минуту.",
            related,
        )
    source_note = (
        "от частотности Вордстата" if yandex_monthly else "от базового замера спроса"
    )
    return SourceResult(
        SOURCE,
        query,
        Status.ESTIMATE,
        monthly,
        f"Оценка: доля Google в поиске РФ {source_note}.",
        related,
    )
