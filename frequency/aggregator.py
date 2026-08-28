"""Сбор частотности по всем источникам параллельно."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Optional

from . import google, ozon, wildberries, yandex
from .models import SourceResult, Status


@dataclass
class Credentials:
    """Ключи источников. Любой может быть пустым — источник тогда даст оценку."""

    wb_token: Optional[str] = None
    ozon_client_id: Optional[str] = None
    ozon_client_secret: Optional[str] = None
    yandex_oauth: Optional[str] = None
    xmlriver_user: Optional[str] = None
    xmlriver_key: Optional[str] = None
    regions: Optional[list[int]] = None


def collect(query: str, creds: Optional[Credentials] = None) -> list[SourceResult]:
    """Вернуть результаты по WB, Ozon, Яндексу и Google для одного запроса."""
    query = query.strip()
    creds = creds or Credentials()
    if not query:
        return []

    with ThreadPoolExecutor(max_workers=3) as pool:
        wb_future = pool.submit(wildberries.fetch, query, creds.wb_token)
        ozon_future = pool.submit(
            ozon.fetch, query, creds.ozon_client_id, creds.ozon_client_secret
        )
        ya_future = pool.submit(
            yandex.fetch,
            query,
            creds.yandex_oauth,
            creds.xmlriver_user,
            creds.xmlriver_key,
            creds.regions,
        )
        wb_res = wb_future.result()
        ozon_res = ozon_future.result()
        ya_res = ya_future.result()

    # Google считаем последним: его оценка опирается на цифру Вордстата.
    google_res = google.fetch(query, ya_res.monthly if ya_res.status == Status.EXACT else None)
    return [ya_res, wb_res, ozon_res, google_res]
