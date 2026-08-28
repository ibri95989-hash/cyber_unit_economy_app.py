"""Google: частотность запроса в РФ.

Точные цифры даёт только Keyword Planner (Google Ads API) — там нужен
developer token и аккаунт Ads. Если он не подключён, показываем оценку от
Вордстата по доле рынка Google в России и подтягиваем подсказки Google Suggest.
"""
from __future__ import annotations

from typing import Optional

import requests

from .estimate import google_from_yandex
from .http import DEFAULT_HEADERS
from .models import SourceResult, Status

SOURCE = "Google"

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"


def _suggestions(query: str) -> list[str]:
    try:
        resp = requests.get(
            SUGGEST_URL,
            params={"client": "firefox", "hl": "ru", "gl": "ru", "q": query},
            headers=DEFAULT_HEADERS,
            timeout=10,
        )
        data = resp.json()
    except Exception:  # noqa: BLE001 - подсказки не критичны
        return []
    if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
        return [str(x) for x in data[1][:10]]
    return []


def fetch(query: str, yandex_monthly: Optional[int] = None) -> SourceResult:
    related = [(s, None) for s in _suggestions(query)]
    monthly = google_from_yandex(yandex_monthly)
    if monthly is None:
        return SourceResult(
            SOURCE,
            query,
            Status.NO_KEY,
            None,
            "Оценка Google считается от Вордстата — подключите Яндекс, "
            "и цифра появится автоматически.",
            related,
        )
    return SourceResult(
        SOURCE,
        query,
        Status.ESTIMATE,
        monthly,
        "Оценка: доля Google в поиске РФ от частотности Вордстата.",
        related,
    )
