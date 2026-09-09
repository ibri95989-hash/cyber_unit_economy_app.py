"""Самопроверка: пройти по всем методам, которыми пользуется панель.

Смысл — один прогон вместо переписки по каждой вкладке: видно сразу, что
отвечает, что закрыто правами ключа, а где ошибка в самом запросе.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List

from .config import Credentials, load_credentials
from .errors import OzonApiError
from .performance import PerformanceApi
from .seller import SellerApi
from .version import VERSION

OK = "ок"
FAILED = "ошибка"
SKIPPED = "пропущено"


def _size(payload: Any) -> str:
    """Коротко описать ответ, не вываливая его целиком."""
    if isinstance(payload, list):
        # Короткие строки показываем как есть: по ним видно, что именно ушло
        # в запрос, — на догадках об этом мы уже обожглись.
        if payload and all(isinstance(x, str) and len(x) < 60 for x in payload):
            joined = ", ".join(payload[:6])
            return joined + (f" … и ещё {len(payload) - 6}" if len(payload) > 6 else "")
        return f"записей: {len(payload)}"
    if isinstance(payload, dict):
        for key, value in payload.items():
            if isinstance(value, list):
                return f"{key}: {len(value)}"
        return "полей: " + str(len(payload))
    return str(payload)[:80]


def _check(rows: List[Dict[str, str]], name: str, method: str, call: Callable[[], Any]) -> None:
    try:
        payload = call()
    except OzonApiError as exc:
        rows.append(
            {
                "проверка": name,
                "метод": method,
                "результат": FAILED,
                "подробности": str(exc).splitlines()[0][:200],
            }
        )
    except Exception as exc:  # noqa: BLE001 - самопроверка не должна падать сама
        rows.append({"проверка": name, "метод": method, "результат": FAILED, "подробности": f"{type(exc).__name__}: {exc}"[:200]})
    else:
        rows.append({"проверка": name, "метод": method, "результат": OK, "подробности": _size(payload)})


def _preview(payload: Any) -> str:
    """Кусок ответа как есть — чтобы не гадать, что внутри."""
    import json

    return json.dumps(payload, ensure_ascii=False)[:300]


def _states(api: SellerApi) -> List[str]:
    """Статусы для фильтра заявок. Пустой список — уже повод сказать об этом."""
    found = api.supply_order_states()
    if not found:
        raise OzonApiError(
            "счётчик статусов не ответил — список заявок пойдёт с запасным статусом"
        )
    return found


def run_checks(credentials: Credentials | None = None) -> List[Dict[str, str]]:
    """Прогнать все проверки и вернуть таблицу результатов."""
    creds = credentials or load_credentials()
    rows: List[Dict[str, str]] = [
        {"проверка": "Версия панели", "метод": "—", "результат": OK, "подробности": VERSION}
    ]

    if not creds.has_seller:
        rows.append({"проверка": "Seller API", "метод": "—", "результат": SKIPPED, "подробности": "ключей нет"})
    else:
        api = SellerApi(creds)
        _check(rows, "Ключ принят", "/v1/supply-order/status/counter", api.supply_status_counter)
        _check(rows, "Ответ счётчика", "сырые данные", lambda: _preview(api.supply_status_counter()))
        _check(rows, "Статусы поставок", "разбор счётчика", lambda: _states(api))
        _check(rows, "Заявки на поставку", "/v3/supply-order/list", lambda: api.supply_orders(limit=10))
        _check(rows, "Заявки с подробностями", "/v3/supply-order/get", lambda: api.supply_orders_detailed(limit=10))
        _check(rows, "Остатки", "/v4/product/info/stocks", lambda: api.stocks(limit=10))
        _check(rows, "Остатки по складам", "/v2/analytics/stock_on_warehouses", lambda: api.stocks_on_warehouses(limit=10))
        _check(rows, "Товары", "/v3/product/list", lambda: api.product_list(limit=10))
        _check(rows, "Аналитика продаж", "/v1/analytics/data", lambda: api.analytics(limit=10))
        _check(rows, "Кластеры", "/v1/cluster/list", api.clusters)
        _check(rows, "Склады FBO", "/v1/warehouse/fbo/list", lambda: api.supply_warehouses())
        _check(rows, "Склады продавца", "/v2/warehouse/list", api.warehouses)

    if not creds.has_performance:
        rows.append({"проверка": "Performance API", "метод": "—", "результат": SKIPPED, "подробности": "ключей нет"})
    else:
        ads = PerformanceApi(creds)
        _check(rows, "Токен рекламы", "/api/client/token", ads.token)
        _check(rows, "Кампании", "/api/client/campaign", lambda: ads.campaigns())

    return rows


def summary(rows: List[Dict[str, str]]) -> str:
    """Строка вида «работает 9 из 11» — то, что стоит прочитать первым."""
    checks = [row for row in rows if row["метод"] != "—"]
    good = sum(1 for row in checks if row["результат"] == OK)
    return f"Работает {good} из {len(checks)} проверок."
