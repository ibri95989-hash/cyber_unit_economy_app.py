"""Сценарии из нескольких вызовов — например, создание поставки FBO.

Одной кнопки «создать поставку» в API нет: сначала создаётся черновик, Ozon
считает по нему доступные склады, потом выбирается интервал приёмки, и только
после этого появляется заявка. Здесь эта цепочка собрана в два шага:

    plan = plan_supply(api, items=[{"sku": 123, "quantity": 10}])
    print(plan.summary())          # что предлагает Ozon — можно показать человеку
    create_supply(api, plan, warehouse_id=..., confirm=True)

Черновик ничего не отгружает и денег не стоит: его можно бросить. Заявку
создаёт только второй шаг, и он требует отдельного подтверждения.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional

from .errors import OzonApiError
from .seller import SellerApi

POLL_ATTEMPTS = 20
POLL_PAUSE = 2.0
DONE = {"SUCCESS", "OK", "DONE", "CALCULATION_STATUS_SUCCESS"}
FAILED = {"ERROR", "FAILED", "CALCULATION_STATUS_FAILED"}


def _status(payload: Any) -> str:
    """Статус операции из ответа Ozon, в каком бы поле он ни лежал."""
    if not isinstance(payload, dict):
        return ""
    for key in ("status", "state", "operation_status", "result_status"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value.upper()
    return ""


def _walk(node: Any, want: Iterable[str]) -> List[Dict[str, Any]]:
    """Собрать из ответа все словари, где есть все нужные ключи.

    Ozon меняет вложенность между версиями методов, а набор полей внутри
    записи держит: искать по полям надёжнее, чем по пути в JSON.
    """
    want = set(want)
    found: List[Dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if want.issubset(value.keys()):
                found.append(value)
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(node)
    return found


def _poll(call, *, what: str, attempts: int = POLL_ATTEMPTS, pause: float = POLL_PAUSE) -> Any:
    """Дождаться, пока Ozon досчитает операцию."""
    payload: Any = None
    for _ in range(attempts):
        payload = call()
        status = _status(payload)
        if status in FAILED:
            raise OzonApiError(f"{what}: Ozon вернул статус {status}", payload=payload)
        if status in DONE or not status:
            return payload
        time.sleep(pause)
    raise OzonApiError(f"{what}: Ozon не ответил за {int(attempts * pause)} секунд", payload=payload)


@dataclass
class SupplyPlan:
    """Черновик поставки и то, что Ozon по нему предложил."""

    draft_id: int
    operation_id: str
    items: List[Dict[str, Any]]
    warehouses: List[Dict[str, Any]] = field(default_factory=list)
    timeslots: List[Dict[str, Any]] = field(default_factory=list)
    raw_info: Any = None

    @property
    def units(self) -> int:
        return sum(int(item.get("quantity", 0)) for item in self.items)

    def summary(self) -> str:
        """Человекочитаемая сводка — то, что стоит показать перед созданием."""
        lines = [
            f"Черновик №{self.draft_id}: {len(self.items)} позиций, {self.units} шт.",
            f"Складов доступно: {len(self.warehouses)}",
        ]
        for warehouse in self.warehouses[:10]:
            name = warehouse.get("name") or warehouse.get("warehouse_name") or "склад"
            lines.append(f"  • {name} (id {warehouse.get('warehouse_id') or warehouse.get('id')})")
        if self.timeslots:
            first = self.timeslots[0]
            lines.append(
                f"Ближайший интервал: {first.get('from_in_timezone')} — {first.get('to_in_timezone')}"
            )
        else:
            lines.append("Свободных интервалов Ozon пока не предложил.")
        return "\n".join(lines)


def plan_supply(
    api: SellerApi,
    *,
    items: List[Dict[str, Any]],
    cluster_ids: Optional[List[int]] = None,
    drop_off_point_warehouse_id: int = 0,
    days: int = 14,
) -> SupplyPlan:
    """Создать черновик поставки и собрать по нему склады и интервалы.

    items — [{"sku": 123456789, "quantity": 10}, ...].
    Черновик — это ещё не поставка: ничего не едет и ничего не стоит.
    """
    if not items:
        raise OzonApiError("Список товаров пуст — нечего поставлять.")
    for item in items:
        if not item.get("sku") or int(item.get("quantity", 0)) <= 0:
            raise OzonApiError(f"В позиции не хватает sku или количества: {item}")

    if not cluster_ids:
        clusters = _walk(api.clusters(), ["id"])
        cluster_ids = [int(c["id"]) for c in clusters[:1] if str(c.get("id", "")).isdigit()]
        if not cluster_ids:
            raise OzonApiError(
                "Не удалось определить кластер поставки — задайте cluster_ids явно."
            )

    created = api.draft_create(
        cluster_ids=cluster_ids,
        items=items,
        drop_off_point_warehouse_id=drop_off_point_warehouse_id,
        apply=True,
    )
    operation_id = str((created or {}).get("operation_id") or "")
    if not operation_id:
        raise OzonApiError("Ozon не вернул operation_id черновика.", payload=created)

    info = _poll(lambda: api.draft_info(operation_id), what="Расчёт черновика")
    draft_raw = (info or {}).get("draft_id") or (info or {}).get("id")
    if not draft_raw:
        raise OzonApiError("Ozon не вернул draft_id.", payload=info)
    draft_id = int(draft_raw)

    warehouses = _walk(info, ["warehouse_id"]) or _walk(info, ["id", "name"])
    warehouse_ids = []
    for warehouse in warehouses:
        raw = warehouse.get("warehouse_id") or warehouse.get("id")
        if str(raw).isdigit():
            warehouse_ids.append(int(raw))

    timeslots: List[Dict[str, Any]] = []
    if warehouse_ids:
        try:
            slots = api.draft_timeslots(draft_id=draft_id, warehouse_ids=warehouse_ids[:10], days=days)
            timeslots = _walk(slots, ["from_in_timezone", "to_in_timezone"])
        except OzonApiError:
            # Интервалы можно запросить и позже — план от этого не разваливается.
            timeslots = []

    return SupplyPlan(
        draft_id=draft_id,
        operation_id=operation_id,
        items=items,
        warehouses=warehouses,
        timeslots=timeslots,
        raw_info=info,
    )


def create_supply(
    api: SellerApi,
    plan: SupplyPlan,
    *,
    warehouse_id: Optional[int] = None,
    timeslot_from: str = "",
    timeslot_to: str = "",
    confirm: bool = False,
) -> Dict[str, Any]:
    """Превратить черновик в настоящую заявку на поставку.

    Без confirm=True вызов остановится на предохранителе и вернёт объяснение —
    это единственный шаг всей цепочки, который создаёт обязательство перед Ozon.
    """
    if warehouse_id is None:
        ids = [
            int(w.get("warehouse_id") or w.get("id"))
            for w in plan.warehouses
            if str(w.get("warehouse_id") or w.get("id", "")).isdigit()
        ]
        if len(ids) != 1:
            raise OzonApiError(
                "Складов несколько — укажите warehouse_id явно: "
                + ", ".join(str(i) for i in ids[:10])
            )
        warehouse_id = ids[0]

    if not timeslot_from or not timeslot_to:
        slots = [
            slot
            for slot in plan.timeslots
            if not slot.get("warehouse_id") or int(slot["warehouse_id"]) == int(warehouse_id)
        ]
        if not slots:
            raise OzonApiError("Не выбран интервал приёмки и подставить нечего.")
        timeslot_from = str(slots[0]["from_in_timezone"])
        timeslot_to = str(slots[0]["to_in_timezone"])

    created = api.supply_create(
        draft_id=plan.draft_id,
        warehouse_id=int(warehouse_id),
        timeslot_from=timeslot_from,
        timeslot_to=timeslot_to,
        apply=True,
        confirm=confirm,
    )
    operation_id = str((created or {}).get("operation_id") or "")
    result = (
        _poll(lambda: api.supply_create_status(operation_id), what="Создание заявки")
        if operation_id
        else created
    )
    orders = _walk(result, ["supply_order_id"])
    return {
        "supply_order_id": orders[0]["supply_order_id"] if orders else None,
        "warehouse_id": int(warehouse_id),
        "timeslot": [timeslot_from, timeslot_to],
        "units": plan.units,
        "raw": result,
    }
