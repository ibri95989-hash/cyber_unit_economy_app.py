"""Проверка арифметики воронки: python test_funnel_metrics.py (или pytest).

Тесты держат в узде именно расчёты — конверсии, эталон, узкое место и перевод
потерь в рубли: интерфейс поверх них уже ничего не считает.
"""
from __future__ import annotations

import pandas as pd

from funnel import schema, wb_api
from funnel.metrics import analyze, benchmarks, funnel_steps, with_conversions

CSV = (
    "Отчёт по воронке продаж;;;;;;\n"
    "Период: 01.08.2026 - 31.08.2026;;;;;;\n"
    "Артикул WB;Артикул продавца;Наименование;Переходы в карточку товара;"
    "Положили в корзину, шт;Заказали, шт;Заказали на сумму, ₽;Выкупили, шт;Выкупили на сумму, ₽\n"
    "12345678;ART-1;Ароматизатор;12 500;1 100;350;420 000,50;300;360 000,00\n"
    "87654321;ART-2;Держатель;3 400;120;40;56 000;28;39 200\n"
)


class _Upload:
    """Заглушка загруженного файла: у Streamlit тот же интерфейс."""

    name = "funnel.csv"

    def getvalue(self) -> bytes:
        return CSV.encode("utf-8")


def _demo_with(extra: dict) -> tuple[pd.DataFrame, dict]:
    """Демо-портфель плюс один искусственный товар; эталон фиксируем по портфелю."""
    demo = wb_api.demo_frame()
    bench = benchmarks(with_conversions(demo))
    row = {
        "nm_id": extra["item_key"], "vendor_code": extra["item_key"], "name": "Тест",
        "brand": "", "subject": "", "impressions": 0.0, "orders_rub": 0.0,
        "cancels": 0.0, "stocks": 0.0, **extra,
    }
    mixed = pd.concat([demo, pd.DataFrame([row])], ignore_index=True)
    result, _ = analyze(mixed, overrides={k: bench[k] for k in ("cr_cart", "cr_order", "cr_buyout")})
    return result[result["item_key"] == extra["item_key"]].iloc[0], bench


def test_upload_is_parsed():
    """Служебная шапка снимается, пробелы и запятые в числах не мешают."""
    raw = schema.read_table(_Upload())
    norm = schema.normalize(raw, schema.guess_mapping(raw.columns))
    assert list(norm["item_key"]) == ["12345678", "87654321"]
    assert norm.loc[0, "open_card"] == 12500
    assert abs(norm.loc[0, "orders_rub"] - 420000.5) < 1e-6


def test_conversions_and_steps():
    raw = schema.read_table(_Upload())
    result, _ = analyze(schema.normalize(raw, schema.guess_mapping(raw.columns)))
    first = result.iloc[0]
    assert abs(first["cr_cart"] - 1100 / 12500) < 1e-9
    assert abs(first["cr_order"] - 350 / 1100) < 1e-9
    assert abs(first["cr_buyout"] - 300 / 350) < 1e-9
    steps = funnel_steps(result)
    assert list(steps["stage"]) == ["open_card", "add_to_cart", "orders", "buyouts"]
    assert steps.loc[0, "value"] == 15900


def test_item_at_benchmark_loses_nothing():
    bench = benchmarks(with_conversions(wb_api.demo_frame()))
    cart = 10000 * bench["cr_cart"]
    orders = cart * bench["cr_order"]
    buyouts = orders * bench["cr_buyout"]
    row, _ = _demo_with({
        "item_key": "AT-BENCH", "open_card": 10000.0, "add_to_cart": cart,
        "orders": orders, "buyouts": buyouts, "buyouts_rub": buyouts * 1000,
    })
    assert abs(row["lost_rub"]) < 1e-6
    assert row["bottleneck"] == "—"


def test_weak_stage_is_found_and_priced():
    """Конверсия корзины вдвое ниже эталона → потенциал равен текущим выкупам."""
    bench = benchmarks(with_conversions(wb_api.demo_frame()))
    cart = 10000 * bench["cr_cart"] / 2
    orders = cart * bench["cr_order"]
    buyouts = orders * bench["cr_buyout"]
    row, _ = _demo_with({
        "item_key": "HALF-CART", "open_card": 10000.0, "add_to_cart": cart,
        "orders": orders, "buyouts": buyouts, "buyouts_rub": buyouts * 1000,
    })
    assert row["bottleneck"] == "Карточка → корзина"
    assert abs(row["lost_buyouts"] - buyouts) < 1e-6
    assert abs(row["lost_rub"] - buyouts * 1000) < 1e-3


def test_zero_stages_do_not_break_math():
    """Трафик есть, продаж нет: узкое место находится, чек берётся по портфелю."""
    row, _ = _demo_with({
        "item_key": "NO-SALES", "open_card": 500.0, "add_to_cart": 0.0,
        "orders": 0.0, "buyouts": 0.0, "buyouts_rub": 0.0,
    })
    assert row["bottleneck"] == "Карточка → корзина"
    assert row["lost_buyouts"] > 0
    assert row["lost_rub"] > 0


if __name__ == "__main__":
    for name, func in sorted(globals().items()):
        if name.startswith("test_") and callable(func):
            func()
            print(f"ok  {name}")
    print("Все проверки пройдены.")
