"""Метрики воронки: конверсии этапов, эталон по портфелю, узкие места.

Логика простая и проверяемая. Конверсия каждого перехода считается по своим
двум этапам. Эталон («бенчмарк») по умолчанию берётся из собственных данных
продавца — суммарная конверсия по всем выбранным товарам, — потому что средние
по рынку у каждой ниши свои и подставлять их вслепую бессмысленно. Узкое место
товара — тот переход, подтягивание которого до эталона даёт больше всего
дополнительных выкупов; отсюда же берётся денежный потенциал.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from .schema import STAGES, TRANSITIONS

# Переходы в порядке движения покупателя.
TRANSITION_ORDER = ["ctr", "cr_cart", "cr_order", "cr_buyout"]


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Доля с защитой от деления на ноль: нет базы — нет и конверсии (NaN)."""
    denom = pd.to_numeric(denominator, errors="coerce").replace(0, np.nan)
    return pd.to_numeric(numerator, errors="coerce") / denom


def has_impressions(df: pd.DataFrame) -> bool:
    """Есть ли в данных этап показов (он приходит не из всех отчётов WB)."""
    return "impressions" in df.columns and pd.to_numeric(df["impressions"], errors="coerce").fillna(0).sum() > 0


def active_transitions(df: pd.DataFrame) -> list[str]:
    """Какие переходы вообще можно посчитать на этих данных."""
    return [t for t in TRANSITION_ORDER if t != "ctr" or has_impressions(df)]


def active_stages(df: pd.DataFrame) -> list[str]:
    return [s for s in STAGES if s != "impressions" or has_impressions(df)]


def with_conversions(df: pd.DataFrame) -> pd.DataFrame:
    """Добавить конверсии этапов, сквозную конверсию и средний чек."""
    out = df.copy()
    for key in TRANSITION_ORDER:
        src, dst, _ = TRANSITIONS[key]
        out[key] = _safe_ratio(out.get(dst), out.get(src))

    entry = "impressions" if has_impressions(out) else "open_card"
    out["cr_e2e"] = _safe_ratio(out["buyouts"], out[entry])
    out["entry_stage"] = entry

    # Средний чек товара; если продаж ещё не было — средний чек по портфелю,
    # иначе товар с трафиком и нулём выкупов оценивался бы в 0 ₽ потенциала.
    price = _safe_ratio(out.get("buyouts_rub"), out.get("buyouts"))
    fallback = _safe_ratio(out.get("orders_rub"), out.get("orders"))
    out["avg_price"] = price.fillna(fallback).fillna(portfolio_price(out))
    return out


def portfolio_price(df: pd.DataFrame) -> float:
    """Средний чек по всему портфелю: выручка выкупов на выкуп, иначе по заказам."""
    agg = totals(df)
    for money, count in (("buyouts_rub", "buyouts"), ("orders_rub", "orders")):
        if agg.get(count):
            return agg.get(money, 0.0) / agg[count]
    return 0.0


def totals(df: pd.DataFrame) -> dict:
    """Суммы по этапам и деньгам — основа сводных KPI и общей воронки."""
    cols = STAGES + ["orders_rub", "buyouts_rub", "cancels"]
    return {
        c: float(pd.to_numeric(df[c], errors="coerce").fillna(0).sum())
        for c in cols
        if c in df.columns
    }


def benchmarks(df: pd.DataFrame, overrides: Optional[dict] = None) -> dict:
    """Эталонные конверсии: агрегат по портфелю плюс ручные переопределения.

    Агрегат (сумма/сумма), а не среднее по товарам: так один артикул с тремя
    переходами и одним заказом не задирает планку для всего портфеля.
    """
    agg = totals(df)
    bench = {}
    for key in TRANSITION_ORDER:
        src, dst, _ = TRANSITIONS[key]
        base = agg.get(src, 0.0)
        bench[key] = (agg.get(dst, 0.0) / base) if base else np.nan
    for key, value in (overrides or {}).items():
        if value is not None and not pd.isna(value):
            bench[key] = float(value)
    return bench


@dataclass
class StageLoss:
    """Сколько выкупов и денег теряет товар на конкретном переходе."""

    transition: str
    conversion: float
    benchmark: float
    lost_buyouts: float
    lost_rub: float


def _effective(value: float, fallback: float) -> float:
    """Конверсию без базы (0 из 0) заменяем эталоном — иначе цепочка обнулится."""
    return fallback if value is None or pd.isna(value) else float(value)


def stage_losses(row: pd.Series, bench: dict, transitions: list[str]) -> list[StageLoss]:
    """Потери товара по каждому переходу при подтягивании его до эталона.

    Считаем цепочкой: входной трафик умножается на конверсии всех переходов.
    Для проверяемого перехода подставляем эталон, остальные оставляем как есть —
    разница в выкупах и есть цена этого узкого места.
    """
    entry_stage = "impressions" if "ctr" in transitions else "open_card"
    entry = float(pd.to_numeric(row.get(entry_stage), errors="coerce") or 0.0)
    if entry <= 0:
        return []

    chain = {t: _effective(row.get(t), bench.get(t, np.nan)) for t in transitions}
    if any(pd.isna(v) for v in chain.values()):
        return []

    price = row.get("avg_price")
    price = 0.0 if price is None or pd.isna(price) else float(price)

    losses = []
    for key in transitions:
        target = bench.get(key, np.nan)
        if pd.isna(target) or target <= chain[key]:
            continue
        others = 1.0
        for other in transitions:
            if other != key:
                others *= chain[other]
        delta = entry * others * (target - chain[key])
        if delta <= 0:
            continue
        losses.append(
            StageLoss(key, chain[key], float(target), float(delta), float(delta * price))
        )
    return sorted(losses, key=lambda l: l.lost_rub, reverse=True)


def analyze(df: pd.DataFrame, overrides: Optional[dict] = None) -> tuple[pd.DataFrame, dict]:
    """Полный разбор: конверсии, эталон, узкое место и потенциал по каждому SKU."""
    enriched = with_conversions(df)
    bench = benchmarks(enriched, overrides)
    transitions = active_transitions(enriched)

    bottleneck, lost_buyouts, lost_rub, gap = [], [], [], []
    for _, row in enriched.iterrows():
        losses = stage_losses(row, bench, transitions)
        if not losses:
            bottleneck.append("—")
            lost_buyouts.append(0.0)
            lost_rub.append(0.0)
            gap.append(np.nan)
            continue
        top = losses[0]
        bottleneck.append(TRANSITIONS[top.transition][2])
        lost_buyouts.append(top.lost_buyouts)
        lost_rub.append(top.lost_rub)
        gap.append(top.conversion - top.benchmark)

    enriched["bottleneck"] = bottleneck
    enriched["lost_buyouts"] = lost_buyouts
    enriched["lost_rub"] = lost_rub
    enriched["bottleneck_gap"] = gap
    return enriched, bench


def funnel_steps(df: pd.DataFrame) -> pd.DataFrame:
    """Таблица для графика-воронки: этап, объём, конверсия из предыдущего."""
    agg = totals(df)
    stages = active_stages(df)
    rows = []
    previous = None
    for stage in stages:
        value = agg.get(stage, 0.0)
        rows.append(
            {
                "stage": stage,
                "value": value,
                "from_prev": (value / previous) if previous else np.nan,
                "from_top": (value / agg.get(stages[0], 0.0)) if agg.get(stages[0]) else np.nan,
            }
        )
        previous = value
    return pd.DataFrame(rows)
