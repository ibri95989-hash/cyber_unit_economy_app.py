"""Выводы по кабинету: то, ради чего собираются цифры.

Считается на месте, в панели. Пересылать снимок кому-то, чтобы узнать «что
заканчивается» и «окупается ли реклама», не нужно — ответ виден сразу.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

СРОЧНО = "срочно"
ВНИМАНИЕ = "внимание"
СПОКОЙНО = "спокойно"


def _number(value: Any) -> Optional[float]:
    """Число из ответа Ozon: там встречается и «1 234,56», и обычное 1234.56."""
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    cleaned = value.replace("\xa0", "").replace(" ", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _section(snapshot: Dict[str, Any], name: str) -> Any:
    for part in snapshot.get("разделы", []):
        if part.get("раздел") == name and "данные" in part:
            return part["данные"]
    return None


def _finding(уровень: str, заголовок: str, вывод: str, цифры: str = "") -> Dict[str, str]:
    return {"уровень": уровень, "заголовок": заголовок, "вывод": вывод, "цифры": цифры}


def sales_per_day(snapshot: Dict[str, Any]) -> Dict[int, float]:
    """Продажи в день по каждому SKU из аналитики за 30 дней."""
    rows = _section(snapshot, "Аналитика продаж за 30 дней") or []
    out: Dict[int, float] = {}
    for row in rows if isinstance(rows, list) else []:
        dimensions = row.get("dimensions") or []
        metrics = row.get("metrics") or []
        if not dimensions or not metrics:
            continue
        sku = str(dimensions[0].get("id", ""))
        units = _number(metrics[0])
        if sku.isdigit() and units:
            out[int(sku)] = units / 30
    return out


def stock_findings(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
    """Хватит ли запаса и не везём ли лишнего."""
    rows = _section(snapshot, "Остатки по складам FBO") or []
    if not isinstance(rows, list) or not rows:
        return []

    speed = sales_per_day(snapshot)
    free = sum(_number(r.get("free_to_sell_amount")) or 0 for r in rows)
    coming = sum(_number(r.get("promised_amount")) or 0 for r in rows)
    per_day = sum(speed.values())

    findings: List[Dict[str, str]] = []
    empty = [r["warehouse_name"] for r in rows if not (_number(r.get("free_to_sell_amount")) or 0)]

    if per_day > 0:
        days_now = free / per_day
        days_all = (free + coming) / per_day
        цифры = (
            f"свободно {free:.0f} шт, едет {coming:.0f} шт, "
            f"продажи {per_day:.1f} шт/день"
        )
        if days_now < 14:
            findings.append(
                _finding(СРОЧНО, "Запас кончается",
                         f"На руках хватит на {days_now:.0f} дней. Пора везти.", цифры)
            )
        elif days_all > 120:
            findings.append(
                _finding(ВНИМАНИЕ, "Затоваривание",
                         f"С учётом поставок запаса на {days_all:.0f} дней. "
                         "Больше 120 — это замороженные деньги и платное хранение.", цифры)
            )
        else:
            findings.append(
                _finding(СПОКОЙНО, "Запас в норме",
                         f"Хватит на {days_now:.0f} дней, с поставками — на {days_all:.0f}.", цифры)
            )

    if empty:
        findings.append(
            _finding(ВНИМАНИЕ, "Склады в нуле",
                     "Там нет быстрой доставки, и карточка проседает в выдаче по региону.",
                     ", ".join(sorted(empty))),
        )
    return findings


def product_findings(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
    """Карточки без остатков — они не приносят ни показов, ни продаж."""
    rows = _section(snapshot, "Товары") or []
    if not isinstance(rows, list) or not rows:
        return []
    dead = [r.get("offer_id") for r in rows if not r.get("has_fbo_stocks") and not r.get("has_fbs_stocks")]
    if not dead:
        return []
    return [
        _finding(
            ВНИМАНИЕ,
            "Карточки без товара",
            f"{len(dead)} из {len(rows)} товаров без остатка. Пустая карточка не "
            "набирает показов и рейтинга: либо завозить, либо в архив.",
            ", ".join(str(d) for d in dead[:10]),
        )
    ]


def supply_findings(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
    """Что едет, что ждёт отгрузки и сколько обычно идёт доставка."""
    rows = _section(snapshot, "Заявки на поставку") or []
    if not isinstance(rows, list) or not rows:
        return []

    findings: List[Dict[str, str]] = []
    now = datetime.now(timezone.utc)

    ready = [r for r in rows if r.get("state") == "READY_TO_SUPPLY"]
    for order in ready:
        slot = ((order.get("timeslot") or {}).get("timeslot") or {}).get("from")
        when = ""
        if slot:
            try:
                moment = datetime.fromisoformat(str(slot).replace("Z", "+00:00"))
                hours = (moment - now).total_seconds() / 3600
                when = moment.strftime("%d.%m в %H:%M UTC") + (
                    f" — через {hours:.0f} ч" if 0 < hours < 96 else ""
                )
            except ValueError:
                when = str(slot)
        warehouse = (order.get("drop_off_warehouse") or {}).get("name", "")
        findings.append(
            _finding(СРОЧНО, "Поставка ждёт отгрузки",
                     f"Заявка {order.get('order_number')} — привезти на {warehouse}. "
                     "Не успеете к интервалу — заявка отменится.", when)
        )

    transit = [r for r in rows if r.get("state") == "IN_TRANSIT"]
    if transit:
        findings.append(
            _finding(СПОКОЙНО, "В пути",
                     f"{len(transit)} поставок едет на склады.",
                     ", ".join(str(r.get("order_number")) for r in transit[:6]))
        )

    # Сколько обычно занимает дорога — по завершённым заявкам.
    durations = []
    for order in rows:
        if order.get("state") != "COMPLETED":
            continue
        try:
            created = datetime.fromisoformat(str(order["created_date"]).replace("Z", "+00:00"))
            done = datetime.fromisoformat(str(order["state_updated_date"]).replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        durations.append((done - created).days)
    if durations:
        findings.append(
            _finding(СПОКОЙНО, "Срок доставки",
                     f"От создания заявки до приёмки в среднем {sum(durations) / len(durations):.0f} дней.",
                     f"замеров: {len(durations)}, разброс {min(durations)}–{max(durations)} дней")
        )

    cancelled = [r for r in rows if r.get("state") == "CANCELLED"]
    if len(cancelled) > len(rows) / 2:
        recent = [r for r in cancelled if str(r.get("created_date", ""))[:10] == str(now.date())]
        if len(recent) < len(cancelled):
            findings.append(
                _finding(ВНИМАНИЕ, "Много отмен",
                         f"{len(cancelled)} заявок из {len(rows)} отменены. "
                         "Стоит посмотреть, на каком шаге они срываются.",
                         f"сегодня отменено {len(recent)}")
            )
    return findings


def ads_findings(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
    """Окупается ли реклама: расход против выручки."""
    findings: List[Dict[str, str]] = []

    kinds = _section(snapshot, "Кампании по видам")
    if isinstance(kinds, dict):
        findings.append(
            _finding(СПОКОЙНО, "Состав кабинета",
                     f"Товарных кампаний {len(kinds.get('товарные') or [])}, "
                     f"продвижение в поиске {len(kinds.get('продвижение_в_поиске') or [])}, "
                     f"реферальных ссылок {len(kinds.get('реферальные_ссылки') or [])}.",
                     "у реферальных ссылок ставок нет — это оплата за переходы")
        )

    report = _section(snapshot, "Отчёт по кампаниям за 14 дней")
    files = (report or {}).get("кампании") if isinstance(report, dict) else None
    if not files:
        return findings

    spend_total = 0.0
    orders_total = 0.0
    revenue_total = 0.0
    for name, rows in files.items():
        if not isinstance(rows, list):
            continue
        for row in rows:
            for key, value in row.items():
                low = str(key).lower()
                number = _number(value)
                if number is None:
                    continue
                if "расход" in low or "spend" in low or "затрат" in low:
                    spend_total += number
                elif "заказ" in low and "модел" not in low:
                    orders_total += number
                elif "выручка" in low or "revenue" in low or "продаж" in low:
                    revenue_total += number

    if spend_total:
        цифры = f"расход {spend_total:,.0f} ₽".replace(",", " ")
        if revenue_total:
            drr = spend_total / revenue_total * 100
            цифры += f", выручка с рекламы {revenue_total:,.0f} ₽, ДРР {drr:.0f}%".replace(",", " ")
            уровень = СРОЧНО if drr > 25 else ВНИМАНИЕ if drr > 15 else СПОКОЙНО
            вывод = (
                "Реклама съедает больше четверти выручки — при низком чеке это почти "
                "наверняка минус." if drr > 25 else
                "ДРР высоковат, стоит подрезать ставки." if drr > 15 else
                "ДРР в разумных пределах."
            )
        else:
            уровень, вывод = ВНИМАНИЕ, "Расход есть, а выручки в отчёте нет — проверьте, приносит ли реклама заказы."
        findings.append(_finding(уровень, "Реклама за 14 дней", вывод, цифры))
    return findings


def analyse(snapshot: Dict[str, Any]) -> List[Dict[str, str]]:
    """Все выводы разом, срочное — первым."""
    findings = (
        supply_findings(snapshot)
        + stock_findings(snapshot)
        + product_findings(snapshot)
        + ads_findings(snapshot)
    )
    порядок = {СРОЧНО: 0, ВНИМАНИЕ: 1, СПОКОЙНО: 2}
    return sorted(findings, key=lambda f: порядок.get(f["уровень"], 3))
