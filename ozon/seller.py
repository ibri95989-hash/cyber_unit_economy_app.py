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

import json
import re
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional

from .client import ApiClient
from .config import Credentials, load_credentials
from .errors import OzonApiError, OzonAuthError
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
        # Статусы заявок спрашиваются у Ozon один раз на клиента.
        self._states: Optional[List[str]] = None
        # Сочетание подобрано перебором на живом кабинете: поле называется
        # states, а статусы в фильтре идут без приставки — в отличие от
        # счётчика, который отдаёт их как ORDER_STATE_*. Если Ozon снова
        # поменяет форму, перебор найдёт новую и подставит её сюда.
        self.filter_field: Optional[str] = "states"
        self.state_prefix: str = ""

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

    def turnover(self, *, sku: Optional[List[int]] = None, limit: int = 100) -> Any:
        """Оборачиваемость: за сколько дней распродаётся остаток.

        Прямой ответ на вопрос «не затоварились ли»: Ozon считает её сам и по
        ней же берёт плату за хранение сверх нормы.
        """
        body: Dict[str, Any] = {"limit": max(1, min(int(limit), 1000)), "offset": 0}
        if sku:
            body["sku"] = [str(s) for s in sku]
        return self.try_versions(
            "POST",
            ["/v1/analytics/turnover/stocks", "/v1/analytics/item_turnover"],
            body=body,
        )

    def product_queries(
        self,
        *,
        sku: Optional[List[int]] = None,
        date_from: Optional[str] = None,
        page_size: int = 50,
    ) -> Any:
        """По каким запросам находят ваши товары.

        Показывает спрос словами покупателя: что ищут, сколько раз и куда
        попадает карточка. Основа и для описания, и для ставок в поиске.
        """
        today = date.today()
        body: Dict[str, Any] = {
            "date_from": date_from or (today - timedelta(days=28)).isoformat(),
            "page": 1,
            "page_size": max(1, min(int(page_size), 1000)),
        }
        if sku:
            body["skus"] = [str(s) for s in sku]
        return self.post("/v1/analytics/product-queries", body=body)

    def search_queries(self, *, page_size: int = 50) -> Any:
        """Топ поисковых запросов площадки — что вообще ищут в вашей нише."""
        return self.try_versions(
            "POST",
            ["/v1/search-queries/top", "/v1/search-queries/text"],
            body={"page": 1, "page_size": max(1, min(int(page_size), 1000))},
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
        return self.try_versions("POST", ["/v2/warehouse/list", "/v1/warehouse/list"], body={})

    def clusters(self) -> Any:
        """Кластеры Ozon — крупные регионы, между которыми делится поставка."""
        return self.try_versions(
            "POST",
            ["/v1/cluster/list", "/v2/cluster/list"],
            body={"cluster_type": "CLUSTER_TYPE_OZON"},
        )

    # Метод не принимает пустой список типов поставки. Точные значения Ozon не
    # публикует, поэтому перечисляем оба известных написания: неизвестные он
    # отбросит, как делает это со статусами заявок.
    SUPPLY_TYPES = (
        "CREATE_TYPE_DIRECT",
        "CREATE_TYPE_CROSSDOCK",
        "SUPPLY_TYPE_DIRECT",
        "SUPPLY_TYPE_CROSSDOCK",
    )

    def supply_warehouses(self, search: str = "", *, supply_types: Optional[List[str]] = None) -> Any:
        """Склады Ozon, куда можно везти поставку FBO."""
        return self.post(
            "/v1/warehouse/fbo/list",
            body={
                "search": search,
                "filter_by_supply_type": list(supply_types or self.SUPPLY_TYPES),
            },
        )

    # ------------------------------------------------------------------ поставки

    # Ozon принимает от 1 до 100 заявок за запрос.
    SUPPLY_LIMIT = 100

    # Поля сортировки, которые понимает /v3/supply-order/list.
    SORT_FIELDS = ("ORDER_CREATION", "ORDER_STATE_UPDATED_AT", "TIMESLOT_FROM_UTC", "TIMESLOT_FROM_LOCAL")

    # Статусы заявок. Ozon молча отбрасывает неизвестные значения перечисления,
    # поэтому лишние варианты безопасны: неверные отсеются, верные останутся.
    # Именно это и сбило нас раньше — из счётчика приходили строки, которые
    # выглядели статусами, но перечислению не принадлежали, и фильтр оказывался
    # пустым. Первый в списке подтверждён примером запроса.
    KNOWN_STATES = (
        "ORDER_STATE_DATA_FILLING",
        "ORDER_STATE_READY_TO_SUPPLY",
        "ORDER_STATE_ACCEPTED_AT_SUPPLY_WAREHOUSE",
        "ORDER_STATE_ACCEPTANCE_AT_STORAGE_WAREHOUSE",
        "ORDER_STATE_IN_TRANSIT",
        "ORDER_STATE_COMPLETED",
        "ORDER_STATE_CANCELLED",
        "ORDER_STATE_REPORTS_CONFIRMATION_AWAITING",
        "ORDER_STATE_REPORT_REJECTED",
        "ORDER_STATE_REJECTED_AT_SUPPLY_WAREHOUSE",
    )
    # Нулевое значение перечисления: валидатор Ozon такие обычно не принимает.
    UNSPECIFIED = "ORDER_STATE_UNSPECIFIED"

    # Как может называться поле со статусами и как — сами статусы. Счётчик и
    # фильтр — разные сообщения, и перечисления у них могут не совпадать;
    # приставку поэтому пробуем во всех трёх видах.
    FILTER_FIELDS = ("states", "state", "order_states", "orderStates", "supply_order_states", "statuses")
    STATE_PREFIXES = ("ORDER_STATE_", "", "SUPPLY_ORDER_STATE_")

    @classmethod
    def spell_states(cls, states: List[str], prefix: str) -> List[str]:
        """Переписать коды статусов с нужной приставкой."""
        bare = [s[len("ORDER_STATE_"):] if s.startswith("ORDER_STATE_") else s for s in states]
        return [prefix + name for name in bare]

    def probe_supply_filter(self, *, pause: float = 0.4) -> Dict[str, Any]:
        """Найти сочетание «имя поля + вид статуса», которое Ozon принимает.

        Перебор вместо догадок: комбинаций полтора десятка, а ответ нужен один
        раз — дальше рабочее сочетание запоминается на клиенте.
        """
        import time

        states = self.supply_order_states()
        attempts: List[Dict[str, str]] = []
        for prefix in self.STATE_PREFIXES:
            spelled = self.spell_states(states, prefix)
            for field in self.FILTER_FIELDS:
                body = {
                    "filter": {field: spelled},
                    "limit": 10,
                    "sort_by": "ORDER_CREATION",
                    "sort_dir": "DESC",
                }
                try:
                    self.post("/v3/supply-order/list", body=body)
                except OzonApiError as exc:
                    attempts.append(
                        {
                            "поле": field,
                            "вид": prefix or "без приставки",
                            "ответ": str(exc).splitlines()[0][:120],
                        }
                    )
                    time.sleep(pause)
                    continue
                return {"поле": field, "приставка": prefix, "попыток": len(attempts) + 1}
        return {"поле": "", "приставка": "", "попыток": len(attempts), "попытки": attempts}

    STATE_PATTERN = re.compile(r"ORDER_STATE_[A-Z0-9_]+")

    def supply_order_states(self) -> List[str]:
        """Статусы для фильтра заявок: найденные у кабинета плюс известные.

        Счётчик статусов показывает те, что есть именно у этого продавца, —
        оттуда и берём, вылавливая коды по их виду, а не по имени поля.
        К ним добавляем известные: перечисление шире, чем то, что сейчас
        встречается в кабинете, а лишнее Ozon отбросит сам.
        """
        if self._states is not None:
            return self._states

        found: List[str] = []
        try:
            payload = json.dumps(self.supply_status_counter(), ensure_ascii=False)
        except OzonApiError:
            payload = ""

        if payload:
            found += self.STATE_PATTERN.findall(payload)

        states = [s for s in dict.fromkeys(found + list(self.KNOWN_STATES)) if s != self.UNSPECIFIED]
        self._states = states
        return self._states

    def supply_orders(
        self,
        *,
        states: Optional[List[str]] = None,
        limit: int = 50,
        last_id: str = "",
        sort_by: str = "ORDER_CREATION",
        sort_dir: str = "DESC",
    ) -> Any:
        """Список заявок на поставку. Возвращает номера заявок, без подробностей.

        v3 требует сортировку и не принимает незаданное значение, поэтому
        sort_by и sort_dir передаются всегда.
        """
        limit = max(1, min(int(limit), self.SUPPLY_LIMIT))
        chosen = list(states) if states else self.supply_order_states()
        # Имя поля со статусами Ozon в открытых источниках не показывает, а
        # неизвестные поля отбрасывает молча — отсюда и «список пуст» при
        # заведомо верных значениях. Отправляем все правдоподобные написания
        # сразу: лишние отсеются, нужное сработает.
        if self.filter_field:
            # Сочетание уже подобрано перебором — отправляем ровно его.
            state_filter: Dict[str, Any] = {
                self.filter_field: self.spell_states(chosen, self.state_prefix)
            }
        else:
            state_filter = {name: chosen for name in self.FILTER_FIELDS}
        body: Dict[str, Any] = {
            "filter": state_filter,
            "limit": limit,
            "sort_by": sort_by if sort_by in self.SORT_FIELDS else "ORDER_CREATION",
            "sort_dir": "ASC" if str(sort_dir).upper() == "ASC" else "DESC",
        }
        if last_id:
            body["last_id"] = last_id

        legacy: Dict[str, Any] = {
            "filter": dict(state_filter),
            "paging": {"from_supply_order_id": 0, "limit": limit},
        }
        variants = [("/v3/supply-order/list", body), ("/v2/supply-order/list", legacy)]
        try:
            return self.try_variants("POST", variants)
        except OzonApiError as exc:
            # Фильтр не принят, а рабочее сочетание ещё не подобрано — самое
            # время его найти и повторить, вместо того чтобы возвращать отказ.
            if self.filter_field or "States" not in str(exc):
                raise
            found = self.probe_supply_filter()
            if not found.get("поле"):
                raise
            self.filter_field = found["поле"]
            self.state_prefix = found["приставка"]
            return self.supply_orders(
                states=states, limit=limit, last_id=last_id, sort_by=sort_by, sort_dir=sort_dir
            )

    def supply_order(self, order_ids: Iterable[int]) -> Any:
        """Подробности по заявкам: склад, статус, таймслот, состав."""
        ids = [str(x) for x in order_ids]
        variants: List[Any] = [("/v3/supply-order/get", {"order_ids": ids})]
        if len(ids) == 1:
            # Одиночная заявка доступна и через отдельный метод v1.
            variants.append(("/v1/supply-order/details", {"order_id": int(ids[0])}))
        return self.try_variants("POST", variants)

    def supply_orders_detailed(self, *, limit: int = 50, states: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Заявки вместе с подробностями — то, что показывается таблицей.

        v3 отдаёт только номера заявок, поэтому за содержимым идём вторым
        запросом. Пустой список означает, что активных заявок нет.
        """
        listing = self.supply_orders(limit=limit, states=states) or {}
        ids = listing.get("order_ids") or listing.get("supply_order_id") or []
        if not ids:
            return []
        details = self.supply_order([str(i) for i in ids]) or {}
        orders = details.get("orders") or details.get("supply_orders") or []
        return [order for order in orders if isinstance(order, dict)]

    def supply_status_counter(self) -> Any:
        """Сводка: сколько заявок в каком статусе."""
        return self.post("/v1/supply-order/status/counter", body={})

    def timeslots(self, supply_order_id: int, *, days: int = 14) -> Any:
        """Свободные интервалы приёмки для заявки.

        Период не передаётся: Ozon сам решает, какие интервалы показать.
        Параметр days сохранён для совместимости вызовов.
        """
        return self.post(
            "/v1/supply-order/timeslot/get",
            body={"supply_order_id": int(supply_order_id)},
        )

    def bundle(self, bundle_ids: Iterable[str], *, limit: int = 100) -> Any:
        """Состав поставки: какие товары и в каком количестве в ней едут."""
        return self.post(
            "/v1/supply-order/bundle",
            body={
                "bundle_ids": [str(x) for x in bundle_ids],
                "limit": max(1, min(int(limit), 100)),
                "is_asc": True,
            },
        )

    # ------------------------------------------------------ поставки: изменения

    def draft_create(
        self,
        *,
        macrolocal_cluster_id: int,
        items: List[Dict[str, Any]],
        drop_off_warehouse_id: int = 0,
        seller_warehouse_id: int = 0,
        apply: bool = False,
    ) -> Any:
        """Черновик поставки FBO: кластер, товары и количество.

        items — список вида [{"sku": 123456789, "quantity": 10}, ...].
        Прямая поставка идёт через /direct/create, поставка через точку
        отгрузки — через /crossdock/create с описанием доставки.
        Ответ приходит сразу: {"draft_id": ..., "errors": [...]}.
        """
        cluster_info = {"macrolocal_cluster_id": int(macrolocal_cluster_id), "items": items}
        details = {
            "macrolocal_cluster_id": macrolocal_cluster_id,
            "positions": len(items),
            "units": sum(int(i.get("quantity", 0)) for i in items),
        }
        self.guard.check("supply.draft_create", details, apply=apply)

        if drop_off_warehouse_id or seller_warehouse_id:
            delivery: Dict[str, Any] = {"type": "DROPOFF" if drop_off_warehouse_id else "PICKUP"}
            if drop_off_warehouse_id:
                delivery["drop_off_warehouse"] = {"warehouse_id": str(drop_off_warehouse_id)}
            if seller_warehouse_id:
                delivery["seller_warehouse_id"] = int(seller_warehouse_id)
            result = self.post(
                "/v1/draft/crossdock/create",
                body={
                    "cluster_info": cluster_info,
                    "delivery_info": delivery,
                    "deletion_sku_mode": "FULL",
                },
            )
        else:
            result = self.post(
                "/v1/draft/direct/create",
                body={"cluster_info": cluster_info, "deletion_sku_mode": "FULL"},
            )

        self.guard.audit("supply.draft_create", details, applied=True)
        return result

    def draft_timeslots(
        self,
        *,
        draft_id: int,
        warehouse_ids: List[int],
        days: int = 14,
    ) -> Any:
        """Интервалы приёмки, доступные черновику на выбранных складах."""
        today = date.today()
        return self.try_versions(
            "POST",
            ["/v2/draft/timeslot/info", "/v1/draft/timeslot/info"],
            body={
                "draft_id": draft_id,
                "warehouse_ids": [str(w) for w in warehouse_ids],
                "date_from": today.isoformat() + "T00:00:00Z",
                "date_to": (today + timedelta(days=days)).isoformat() + "T00:00:00Z",
            },
        )

    def supply_create_status(self, operation_id: str) -> Any:
        """Создалась ли заявка из черновика и какой у неё номер."""
        return self.try_versions(
            "POST",
            ["/v2/draft/supply/create/status", "/v1/draft/supply/create/status"],
            body={"operation_id": operation_id},
        )

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
                "supply_order_id": int(supply_order_id),
                "timeslot": {"from": timeslot_from, "to": timeslot_to},
            },
        )
        self.guard.audit("supply.timeslot_update", details, applied=True)
        return result

    def cancel_supply(self, supply_order_id: int, *, apply: bool = False, confirm: bool = False) -> Any:
        """Отменить заявку на поставку."""
        details = {"supply_order_id": supply_order_id}
        self.guard.check("supply.cancel", details, apply=apply, confirm=confirm)
        result = self.post("/v1/supply-order/cancel", body={"order_id": int(supply_order_id)})
        self.guard.audit("supply.cancel", details, applied=True)
        return result

    # ------------------------------------------------------------------- прочее

    def call(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
        """Любой метод Seller API по документации — на случай, когда обёртки нет."""
        return self.request(method, path, body=body)

    def ping(self) -> str:
        """Проверка ключей: дешёвый вызов, доступный даже ключу «только чтение»."""
        self.post("/v1/supply-order/status/counter", body={})
        return "Seller API отвечает, ключ принят."
