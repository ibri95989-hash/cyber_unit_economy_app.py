"""Seller API Ozon: товары, остатки, отправления, поставки FBO.

Авторизация — два заголовка: Client-Id и Api-Key. Ключ создаётся в личном
кабинете продавца: Настройки → Seller API → Сгенерировать ключ. Права ключа
задаются там же, и урезанный ключ (например, «Аналитик») не сможет менять
поставки — это и есть штатный способ ограничить, что делает интеграция.

Ozon постепенно выключает старые версии методов, поэтому пути к поставкам
перечислены списком: клиент сам откатится на предыдущую версию, если свежая
ответила 404.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional

from .client import ApiClient
from .config import Credentials, load_credentials
from .errors import OzonAuthError
from .safety import WriteGuard

BASE_URL = "https://api-seller.ozon.ru"


class SellerApi(ApiClient):
    """Чтение каталога и поставок, при разрешённой записи — управление ими."""

    base_url = BASE_URL

    def __init__(
        self,
        credentials: Optional[Credentials] = None,
        *,
        guard: Optional[WriteGuard] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        creds = credentials or load_credentials()
        if not creds.has_seller:
            raise OzonAuthError(
                "Нет ключей Seller API. Задайте OZON_CLIENT_ID и OZON_API_KEY "
                "в окружении или в .env (см. .env.example)."
            )
        self.client_id = str(creds.seller_client_id)
        self.api_key = str(creds.seller_api_key)
        self.guard = guard or WriteGuard.from_env()

    def auth_headers(self) -> Dict[str, str]:
        return {"Client-Id": self.client_id, "Api-Key": self.api_key}

    # ------------------------------------------------------------------ каталог

    def product_list(self, *, limit: int = 100, last_id: str = "") -> Any:
        """Список товаров кабинета."""
        return self.post("/v3/product/list", body={"filter": {}, "limit": limit, "last_id": last_id})

    def product_info(self, *, offer_ids: Iterable[str] = (), product_ids: Iterable[int] = ()) -> Any:
        """Карточки товаров по offer_id или product_id."""
        return self.post(
            "/v3/product/info/list",
            body={"offer_id": list(offer_ids), "product_id": list(product_ids), "sku": []},
        )

    def stocks(self, *, limit: int = 100, last_id: str = "") -> Any:
        """Остатки по товарам: сколько свободно и сколько зарезервировано."""
        return self.post(
            "/v4/product/info/stocks",
            body={"filter": {"visibility": "ALL"}, "limit": limit, "last_id": last_id},
        )

    def stocks_on_warehouses(self, *, limit: int = 100, offset: int = 0) -> Any:
        """Остатки в разрезе складов FBO — основа для решения «что везти»."""
        return self.post(
            "/v2/analytics/stock_on_warehouses",
            body={"limit": limit, "offset": offset, "warehouse_type": "ALL"},
        )

    def analytics(
        self,
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        metrics: Optional[List[str]] = None,
        dimension: Optional[List[str]] = None,
        limit: int = 500,
    ) -> Any:
        """Аналитика продаж: заказы, выручка, конверсия по выбранным разрезам."""
        today = date.today()
        return self.post(
            "/v1/analytics/data",
            body={
                "date_from": date_from or (today - timedelta(days=30)).isoformat(),
                "date_to": date_to or today.isoformat(),
                "metrics": metrics or ["ordered_units", "revenue", "hits_view", "conv_tocart"],
                "dimension": dimension or ["sku"],
                "limit": limit,
                "offset": 0,
            },
        )

    # ---------------------------------------------------------------- отправления

    def postings_fbs(self, *, since: Optional[str] = None, to: Optional[str] = None, limit: int = 100) -> Any:
        """Отправления FBS за период."""
        today = date.today()
        return self.post(
            "/v3/posting/fbs/list",
            body={
                "dir": "DESC",
                "filter": {
                    "since": (since or (today - timedelta(days=7)).isoformat()) + "T00:00:00.000Z",
                    "to": (to or today.isoformat()) + "T23:59:59.999Z",
                },
                "limit": limit,
                "offset": 0,
                "with": {"analytics_data": False, "financial_data": False},
            },
        )

    # -------------------------------------------------------------------- склады

    def warehouses(self) -> Any:
        """Склады продавца (FBS)."""
        return self.post("/v1/warehouse/list", body={})

    def clusters(self) -> Any:
        """Кластеры Ozon — крупные регионы, между которыми делится поставка."""
        return self.post("/v1/cluster/list", body={"cluster_type": "CLUSTER_TYPE_OZON"})

    def supply_warehouses(self, search: str = "") -> Any:
        """Склады Ozon, куда можно везти поставку FBO."""
        return self.post("/v1/warehouse/fbo/list", body={"search": search, "filter_by_supply_type": []})

    # ------------------------------------------------------------------ поставки

    # Ozon принимает от 1 до 100 заявок за запрос.
    SUPPLY_LIMIT = 100

    def supply_orders(
        self,
        *,
        states: Optional[List[str]] = None,
        limit: int = 50,
        from_supply_order_id: int = 0,
    ) -> Any:
        """Список заявок на поставку.

        Тело запроса у версий разное: в v3 limit на верхнем уровне, в v2 и v1 —
        внутри paging. Перебираем варианты и берём первый, который Ozon принял.
        """
        limit = max(1, min(int(limit), self.SUPPLY_LIMIT))
        filters: Dict[str, Any] = {"states": list(states)} if states else {}
        cursor: Dict[str, Any] = (
            {"from_supply_order_id": from_supply_order_id} if from_supply_order_id else {}
        )

        # Какой формы тело ждёт живая версия метода, Ozon в открытой документации
        # не показывает, поэтому пробуем от самой скупой к самой полной: лишнее
        # поле чаще ломает валидацию, чем отсутствующее.
        bodies: List[Dict[str, Any]] = [
            {"limit": limit, **cursor},
            {"limit": limit, "filter": filters, **cursor},
            {"limit": limit, "filter": {"states": list(states or [])}, **cursor},
        ]
        legacy: Dict[str, Any] = {
            "filter": filters,
            "paging": {"from_supply_order_id": from_supply_order_id, "limit": limit},
        }

        variants: List[Any] = []
        for body in bodies:
            if body not in [existing for _, existing in variants]:
                variants.append(("/v3/supply-order/list", body))
        variants += [("/v2/supply-order/list", legacy), ("/v1/supply-order/list", legacy)]

        return self.try_variants("POST", variants)

    def supply_order(self, order_ids: Iterable[int]) -> Any:
        """Подробности по заявкам на поставку."""
        ids = [int(x) for x in order_ids]
        return self.try_variants(
            "POST",
            [
                ("/v3/supply-order/get", {"order_ids": ids}),
                ("/v3/supply-order/get", {"supply_order_id": ids}),
                ("/v2/supply-order/get", {"supply_order_id": ids}),
                ("/v1/supply-order/get", {"supply_order_id": ids}),
            ],
        )

    def supply_status_counter(self) -> Any:
        """Сводка: сколько заявок в каком статусе."""
        return self.post("/v1/supply-order/status/counter", body={})

    def timeslots(self, supply_order_id: int, *, days: int = 14) -> Any:
        """Свободные интервалы поставки на склад."""
        today = date.today()
        return self.post(
            "/v1/supply-order/timeslot/get",
            body={
                "supply_order_id": supply_order_id,
                "date_from": today.isoformat() + "T00:00:00Z",
                "date_to": (today + timedelta(days=days)).isoformat() + "T00:00:00Z",
            },
        )

    def bundle(self, bundle_ids: Iterable[str], *, limit: int = 100) -> Any:
        """Состав поставки: какие товары и в каком количестве в ней едут."""
        return self.post(
            "/v1/supply-order/bundle",
            body={"bundle_ids": [str(x) for x in bundle_ids], "limit": limit, "is_asc": True},
        )

    # ------------------------------------------------------ поставки: изменения

    def draft_create(self, *, cluster_ids: List[int], items: List[Dict[str, Any]], drop_off_point_warehouse_id: int = 0, apply: bool = False) -> Any:
        """Черновик поставки FBO: кластеры, товары и количество.

        items — список вида [{"sku": 123456789, "quantity": 10}, ...].
        """
        body: Dict[str, Any] = {
            "cluster_ids": [str(c) for c in cluster_ids],
            "items": items,
            "type": "CREATE_TYPE_CROSSDOCK" if drop_off_point_warehouse_id else "CREATE_TYPE_DIRECT",
        }
        if drop_off_point_warehouse_id:
            body["drop_off_point_warehouse_id"] = drop_off_point_warehouse_id
        self.guard.check(
            "supply.draft_create",
            {"cluster_ids": cluster_ids, "positions": len(items), "units": sum(int(i.get("quantity", 0)) for i in items)},
            apply=apply,
        )
        result = self.post("/v1/draft/create", body=body)
        self.guard.audit("supply.draft_create", {"cluster_ids": cluster_ids, "positions": len(items)}, applied=True)
        return result

    def draft_info(self, operation_id: str) -> Any:
        """Что получилось из черновика: доступные кластеры и склады."""
        return self.post("/v1/draft/create/info", body={"operation_id": operation_id})

    def draft_timeslots(
        self,
        *,
        draft_id: int,
        warehouse_ids: List[int],
        days: int = 14,
    ) -> Any:
        """Интервалы приёмки, доступные черновику на выбранных складах."""
        today = date.today()
        return self.post(
            "/v1/draft/timeslot/info",
            body={
                "draft_id": draft_id,
                "warehouse_ids": [str(w) for w in warehouse_ids],
                "date_from": today.isoformat() + "T00:00:00Z",
                "date_to": (today + timedelta(days=days)).isoformat() + "T00:00:00Z",
            },
        )

    def supply_create_status(self, operation_id: str) -> Any:
        """Создалась ли заявка из черновика и какой у неё номер."""
        return self.post("/v1/draft/supply/create/status", body={"operation_id": operation_id})

    def supply_create(
        self,
        *,
        draft_id: int,
        warehouse_id: int,
        timeslot_from: str,
        timeslot_to: str,
        apply: bool = False,
        confirm: bool = False,
    ) -> Any:
        """Превратить черновик в заявку на поставку с выбранным таймслотом."""
        details = {
            "draft_id": draft_id,
            "warehouse_id": warehouse_id,
            "timeslot": [timeslot_from, timeslot_to],
        }
        self.guard.check("supply.create", details, apply=apply, confirm=confirm)
        result = self.post(
            "/v1/draft/supply/create",
            body={
                "draft_id": draft_id,
                "warehouse_id": warehouse_id,
                "timeslot": {"from_in_timezone": timeslot_from, "to_in_timezone": timeslot_to},
            },
        )
        self.guard.audit("supply.create", details, applied=True)
        return result

    def timeslot_update(
        self,
        *,
        supply_order_id: int,
        timeslot_from: str,
        timeslot_to: str,
        apply: bool = False,
        confirm: bool = False,
    ) -> Any:
        """Перенести поставку на другой интервал."""
        details = {"supply_order_id": supply_order_id, "timeslot": [timeslot_from, timeslot_to]}
        self.guard.check("supply.timeslot_update", details, apply=apply, confirm=confirm)
        result = self.post(
            "/v1/supply-order/timeslot/update",
            body={
                "supply_order_id": supply_order_id,
                "timeslot": {"from_in_timezone": timeslot_from, "to_in_timezone": timeslot_to},
            },
        )
        self.guard.audit("supply.timeslot_update", details, applied=True)
        return result

    def cancel_supply(self, supply_order_id: int, *, apply: bool = False, confirm: bool = False) -> Any:
        """Отменить заявку на поставку."""
        details = {"supply_order_id": supply_order_id}
        self.guard.check("supply.cancel", details, apply=apply, confirm=confirm)
        result = self.post("/v1/supply-order/cancel", body={"supply_order_id": supply_order_id})
        self.guard.audit("supply.cancel", details, applied=True)
        return result

    # ------------------------------------------------------------------- прочее

    def call(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        """Любой метод Seller API по документации — на случай, когда обёртки нет."""
        return self.request(method, path, body=body)

    def ping(self) -> str:
        """Проверка ключей: дешёвый вызов, который отвечает при любых правах."""
        self.post("/v1/warehouse/list", body={})
        return "Seller API отвечает, ключ принят."
