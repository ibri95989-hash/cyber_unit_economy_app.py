"""Сбор частотности по всем источникам параллельно.

Ключи не обязательны: без них каждый источник считает оценку по открытым
данным. Заданный ключ просто заменяет оценку точными цифрами API площадки.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from dataclasses import dataclass
from typing import Optional

from . import google, ozon, wildberries, yandex
from .estimate import MARKETPLACE_SHARE_OF_DEMAND, blend
from .models import SourceResult, Status
from .trends import TrendsDemand, TrendsUnavailable
from .trends import demand as trends_demand


@dataclass
class Credentials:
    """Ключи источников. Все поля необязательные."""

    wb_token: Optional[str] = None
    ozon_client_id: Optional[str] = None
    ozon_client_secret: Optional[str] = None
    yandex_oauth: Optional[str] = None
    xmlriver_user: Optional[str] = None
    xmlriver_key: Optional[str] = None
    regions: Optional[list[int]] = None


@lru_cache(maxsize=256)
def measure_demand(query: str) -> Optional[TrendsDemand]:
    """Базовый замер спроса без ключей. None, если Trends недоступен.

    Результат кешируется: Trends ограничивает частоту обращений, а один и тот
    же запрос за сессию проверяют по нескольку раз.
    """
    try:
        return trends_demand(query)
    except TrendsUnavailable:
        return None


class DerivedDemand:
    """Запасной замер спроса, если Google Trends недоступен.

    Считается обратным ходом: зная спрос внутри WB и Ozon и их долю в общем
    поисковом спросе, восстанавливаем спрос в вебе.
    """

    def __init__(self, monthly: int, sources: list[str]):
        self.monthly = monthly
        self.sources = sources

    @property
    def note(self) -> str:
        return (
            "Google Trends не ответил, оценка восстановлена по выдаче "
            + " и ".join(self.sources)
            + "."
        )


def _demand_from_marketplaces(results: list[SourceResult]) -> Optional[DerivedDemand]:
    values: list[Optional[int]] = []
    sources: list[str] = []
    for res in results:
        if not res.is_number:
            continue
        share = MARKETPLACE_SHARE_OF_DEMAND.get(res.source)
        if not share:
            continue
        values.append(int(res.monthly / share))
        sources.append(res.source)
    monthly = blend(*values)
    return DerivedDemand(monthly, sources) if monthly else None


def collect(query: str, creds: Optional[Credentials] = None) -> list[SourceResult]:
    """Вернуть результаты по Яндексу, WB, Ozon и Google для одного запроса."""
    query = query.strip()
    creds = creds or Credentials()
    if not query:
        return []

    # Замер спроса общий для всех источников — делаем его один раз.
    web_demand = measure_demand(query)

    with ThreadPoolExecutor(max_workers=2) as pool:
        wb_future = pool.submit(wildberries.fetch, query, creds.wb_token, web_demand)
        ozon_future = pool.submit(
            ozon.fetch, query, creds.ozon_client_id, creds.ozon_client_secret, web_demand
        )
        wb_res = wb_future.result()
        ozon_res = ozon_future.result()

    # Trends молчит — восстанавливаем спрос по выдаче маркетплейсов,
    # чтобы Яндекс и Google тоже показали цифру, а не прочерк.
    if web_demand is None:
        web_demand = _demand_from_marketplaces([wb_res, ozon_res])

    with ThreadPoolExecutor(max_workers=2) as pool:
        ya_future = pool.submit(
            yandex.fetch,
            query,
            creds.yandex_oauth,
            creds.xmlriver_user,
            creds.xmlriver_key,
            creds.regions,
            web_demand,
        )
        google_future = pool.submit(google.fetch, query, None, web_demand)
        ya_res = ya_future.result()
        google_res = google_future.result()

    # Если Яндекс отдал точные цифры, оценка Google должна опираться на них.
    if ya_res.status == Status.EXACT:
        google_res = google.fetch(query, ya_res.monthly, web_demand)

    return [ya_res, wb_res, ozon_res, google_res]
