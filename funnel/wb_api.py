"""Выгрузка воронки из API продавца Wildberries.

Отчёт «Воронка продаж» в ЛК и метод ``/api/v2/nm-report/detail`` — одни и те же
цифры: переходы в карточку, корзины, заказы, выкупы и суммы по каждому
артикулу. Нужен токен продавца с категорией «Аналитика» (Настройки → Доступ к
API). У метода жёсткий лимит — 3 запроса в минуту, поэтому между страницами
делаем паузу, а число страниц ограничиваем.
"""
from __future__ import annotations

import time
from datetime import date, datetime, time as dt_time
from typing import Optional

import pandas as pd

from frequency.http import SourceError, session

DETAIL_URL = "https://seller-analytics-api.wildberries.ru/api/v2/nm-report/detail"

PAGE_SIZE = 1000
MAX_PAGES = 10
PAGE_PAUSE = 21  # 3 запроса в минуту — безопасный интервал между страницами.
TIMEOUT = 60


def _period(begin: date, end: date) -> dict:
    """WB ждёт «YYYY-MM-DD HH:MM:SS»; берём полные сутки на обоих концах."""
    return {
        "begin": datetime.combine(begin, dt_time.min).strftime("%Y-%m-%d %H:%M:%S"),
        "end": datetime.combine(end, dt_time.max.replace(microsecond=0)).strftime("%Y-%m-%d %H:%M:%S"),
    }


def _post(token: str, body: dict) -> dict:
    sess = session()
    sess.headers.update({"Authorization": token, "Content-Type": "application/json"})
    try:
        resp = sess.post(DETAIL_URL, json=body, timeout=TIMEOUT)
    except Exception as exc:  # noqa: BLE001 - наверх отдаём один тип ошибки
        raise SourceError(f"WB не ответил: {exc}") from exc
    if resp.status_code == 401:
        raise SourceError("WB отклонил токен (401). Нужен токен с категорией «Аналитика».")
    if resp.status_code == 429:
        raise SourceError("WB ограничил частоту запросов (429). Подождите минуту и повторите.")
    if resp.status_code >= 400:
        raise SourceError(f"WB ответил HTTP {resp.status_code}: {resp.text[:200]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise SourceError("WB вернул не JSON — вероятно, запрос ушёл через заглушку сети.") from exc


def _flatten(card: dict) -> dict:
    """Карточка из ответа API → строка канонической воронки."""
    stats = (card.get("statistics") or {}).get("selectedPeriod") or {}
    stocks = card.get("stocks") or {}
    obj = card.get("object") or {}
    return {
        "nm_id": str(card.get("nmID") or ""),
        "vendor_code": str(card.get("vendorCode") or ""),
        "name": str(card.get("vendorCode") or obj.get("name") or ""),
        "brand": str(card.get("brandName") or ""),
        "subject": str(obj.get("name") or ""),
        "impressions": 0.0,
        "open_card": float(stats.get("openCardCount") or 0),
        "add_to_cart": float(stats.get("addToCartCount") or 0),
        "orders": float(stats.get("ordersCount") or 0),
        "orders_rub": float(stats.get("ordersSumRub") or 0),
        "buyouts": float(stats.get("buyoutsCount") or 0),
        "buyouts_rub": float(stats.get("buyoutsSumRub") or 0),
        "cancels": float(stats.get("cancelCount") or 0),
        "stocks": float((stocks.get("stocksMp") or 0) + (stocks.get("stocksWb") or 0)),
    }


def fetch_funnel(
    token: str,
    begin: date,
    end: date,
    max_pages: int = MAX_PAGES,
    progress=None,
) -> pd.DataFrame:
    """Все карточки за период. progress — колбэк (страница, всего строк)."""
    rows: list[dict] = []
    for page in range(1, max_pages + 1):
        body = {
            "timezone": "Europe/Moscow",
            "period": _period(begin, end),
            "orderBy": {"field": "ordersSumRub", "mode": "desc"},
            "page": page,
        }
        payload = _post(token, body)
        data = payload.get("data") or {}
        cards = data.get("cards") or []
        rows.extend(_flatten(card) for card in cards)
        if progress:
            progress(page, len(rows))
        if not data.get("isNextPage") or not cards:
            break
        if page < max_pages:
            time.sleep(PAGE_PAUSE)

    if not rows:
        raise SourceError("API ответил, но карточек за этот период нет.")

    df = pd.DataFrame(rows)
    df["item_key"] = df["nm_id"].replace("", pd.NA).fillna(df["vendor_code"]).fillna("—")
    return df


def check_token(token: str) -> tuple[bool, str]:
    """Быстрая проверка доступа: одна карточка за вчерашний день."""
    today = date.today()
    try:
        payload = _post(
            token,
            {
                "timezone": "Europe/Moscow",
                "period": _period(today, today),
                "orderBy": {"field": "ordersSumRub", "mode": "desc"},
                "page": 1,
            },
        )
    except SourceError as exc:
        return False, str(exc)
    cards = (payload.get("data") or {}).get("cards") or []
    return True, f"Токен принят, карточек в ответе: {len(cards)}."


def demo_frame(seed: Optional[int] = 7) -> pd.DataFrame:
    """Синтетический пример: чтобы посмотреть разбор без токена и выгрузки."""
    import numpy as np

    rng = np.random.default_rng(seed)
    n = 24
    open_card = rng.integers(400, 30000, n).astype(float)
    cr_cart = rng.normal(0.09, 0.035, n).clip(0.01, 0.3)
    cr_order = rng.normal(0.32, 0.12, n).clip(0.03, 0.9)
    cr_buyout = rng.normal(0.72, 0.14, n).clip(0.2, 0.98)
    price = rng.integers(490, 4900, n).astype(float)

    add_to_cart = (open_card * cr_cart).round()
    orders = (add_to_cart * cr_order).round()
    buyouts = (orders * cr_buyout).round()
    return pd.DataFrame(
        {
            "nm_id": [f"1{i:07d}" for i in range(n)],
            "vendor_code": [f"ART-{i:03d}" for i in range(n)],
            "name": [f"Демо-товар {i + 1}" for i in range(n)],
            "brand": "DEMO",
            "subject": rng.choice(["Ароматизаторы", "Держатели", "Органайзеры"], n),
            "impressions": 0.0,
            "open_card": open_card,
            "add_to_cart": add_to_cart,
            "orders": orders,
            "orders_rub": orders * price,
            "buyouts": buyouts,
            "buyouts_rub": buyouts * price,
            "cancels": (orders - buyouts).clip(0),
            "stocks": rng.integers(0, 400, n).astype(float),
            "item_key": [f"1{i:07d}" for i in range(n)],
        }
    )
