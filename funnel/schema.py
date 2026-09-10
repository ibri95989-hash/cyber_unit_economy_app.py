"""Канонический вид воронки и разбор выгрузок WB.

Внутри всё считается по одному набору колонок (см. STAGES/FIELDS), а откуда
пришли данные — из API продавца или из выгруженного Excel — уже неважно.
"""
from __future__ import annotations

import csv
from typing import Optional

import numpy as np
import pandas as pd

# Этапы воронки по порядку. Показы есть только в отчётах по рекламе и поисковым
# запросам, поэтому этап необязательный — воронка тогда начинается с карточки.
STAGES = ["impressions", "open_card", "add_to_cart", "orders", "buyouts"]

STAGE_LABELS = {
    "impressions": "Показы",
    "open_card": "Переходы в карточку",
    "add_to_cart": "Положили в корзину",
    "orders": "Заказали, шт",
    "buyouts": "Выкупили, шт",
}

# Переходы между этапами: ключ -> (из, в, подпись).
TRANSITIONS = {
    "ctr": ("impressions", "open_card", "CTR: показ → карточка"),
    "cr_cart": ("open_card", "add_to_cart", "Карточка → корзина"),
    "cr_order": ("add_to_cart", "orders", "Корзина → заказ"),
    "cr_buyout": ("orders", "buyouts", "Заказ → выкуп"),
}

ID_FIELDS = ["nm_id", "vendor_code", "name", "brand", "subject"]
MONEY_FIELDS = ["orders_rub", "buyouts_rub"]
EXTRA_FIELDS = ["cancels", "stocks"]

# Как называются те же колонки в выгрузке «Воронка продаж» из ЛК продавца.
# Сопоставление по подстроке в нижнем регистре, первый подошедший вариант.
ALIASES = {
    "nm_id": ["артикул wb", "номенклатура", "nmid", "nm id"],
    "vendor_code": ["артикул продавца", "артикул поставщика", "ваш артикул", "sku"],
    "name": ["наименование", "название"],
    "brand": ["бренд"],
    "subject": ["предмет", "категория"],
    "impressions": ["показы", "показов"],
    "open_card": ["переходы в карточку", "переход в карточку", "открытия карточки", "просмотры карточки"],
    "add_to_cart": ["положили в корзину", "добавили в корзину", "в корзину, шт", "корзина, шт"],
    "orders": ["заказали, шт", "заказов, шт", "заказали товаров", "заказы, шт"],
    "orders_rub": ["заказали на сумму", "сумма заказов", "заказали, руб"],
    "buyouts": ["выкупили, шт", "выкупов, шт", "выкупили товаров", "продажи, шт"],
    "buyouts_rub": ["выкупили на сумму", "сумма выкупов", "выкупили, руб"],
    "cancels": ["отменили", "отмены", "возврат"],
    "stocks": ["остатки", "остаток"],
}

NUMERIC_FIELDS = STAGES + MONEY_FIELDS + EXTRA_FIELDS


def guess_column(columns, keywords) -> Optional[str]:
    """Первая колонка, в названии которой встретилось одно из ключевых слов."""
    lower_map = {c: str(c).strip().lower() for c in columns}
    for keyword in keywords:
        for col, lower in lower_map.items():
            if keyword in lower:
                return col
    return None


def guess_mapping(columns) -> dict:
    """Автосопоставление колонок выгрузки с каноническими полями."""
    mapping = {}
    used: set = set()
    for field, keywords in ALIASES.items():
        col = guess_column([c for c in columns if c not in used], keywords)
        if col is not None:
            mapping[field] = col
            used.add(col)
    return mapping


def clean_numeric(val) -> float:
    """«1 234,5», «12%», «—» → float. Всё непонятное превращается в NaN."""
    if pd.isna(val):
        return np.nan
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace("\xa0", "").replace(" ", "")
    s = s.replace("%", "").replace("₽", "").replace(",", ".")
    if not s or s in {"-", "—", "–"}:
        return np.nan
    try:
        return float(s)
    except ValueError:
        return np.nan


def find_header_row(raw: pd.DataFrame) -> int:
    """Строка с заголовками: в выгрузках WB выше неё бывает служебная шапка."""
    best_row, best_hits = 0, 0
    for i in range(min(10, len(raw))):
        cells = " ".join(str(c).strip().lower() for c in raw.iloc[i] if pd.notna(c))
        hits = sum(1 for kws in ALIASES.values() for kw in kws if kw in cells)
        if hits > best_hits:
            best_row, best_hits = i, hits
    return best_row if best_hits >= 3 else 0


def read_table(uploaded_file, sheet_name: Optional[str] = None) -> pd.DataFrame:
    """Прочитать CSV/Excel выгрузку, сняв служебную шапку над заголовками."""
    name = getattr(uploaded_file, "name", "").lower()
    if name.endswith((".xlsx", ".xls")):
        excel = pd.ExcelFile(uploaded_file)
        raw = excel.parse(sheet_name or excel.sheet_names[0], header=None)
        return _apply_header(raw)

    raw_bytes = uploaded_file.getvalue() if hasattr(uploaded_file, "getvalue") else uploaded_file
    text = _decode(raw_bytes)
    best: Optional[pd.DataFrame] = None
    for sep in (";", ",", "\t"):
        table = _rows_to_frame(text, sep)
        if table is not None and (best is None or table.shape[1] > best.shape[1]):
            best = table
    if best is None:
        raise ValueError("Не удалось прочитать файл: проверьте кодировку и разделитель.")
    return _apply_header(best)


def _decode(raw_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode("utf-8", errors="replace")


def _rows_to_frame(text: str, sep: str) -> Optional[pd.DataFrame]:
    """Разбор CSV своими руками: в выгрузках WB строки шапки короче заголовка,
    и pandas на такой «рваной» таблице спотыкается."""
    rows = [row for row in csv.reader(text.splitlines(), delimiter=sep) if any(c.strip() for c in row)]
    if not rows:
        return None
    width = max(len(row) for row in rows)
    if width < 2:
        return None
    padded = [row + [""] * (width - len(row)) for row in rows]
    return pd.DataFrame(padded)


def _apply_header(raw: pd.DataFrame) -> pd.DataFrame:
    header_row = find_header_row(raw)
    df = raw.iloc[header_row + 1:].reset_index(drop=True)
    df.columns = [str(c).strip() for c in raw.iloc[header_row]]
    return df.loc[:, [c for c in df.columns if c and c.lower() != "nan"]]


def normalize(df: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    """Привести произвольную таблицу к каноническим колонкам воронки."""
    out = pd.DataFrame(index=df.index)
    for field in ID_FIELDS:
        col = mapping.get(field)
        out[field] = df[col].astype(str).str.strip() if col in df.columns else ""
    for field in NUMERIC_FIELDS:
        col = mapping.get(field)
        if col in df.columns:
            out[field] = df[col].map(clean_numeric)
        elif field in STAGES and field != "impressions":
            out[field] = np.nan
    if "impressions" not in out.columns:
        out["impressions"] = np.nan

    # Ключ товара: артикул WB, иначе артикул продавца, иначе название.
    key = out["nm_id"].replace({"": np.nan, "nan": np.nan})
    key = key.fillna(out["vendor_code"].replace({"": np.nan}))
    key = key.fillna(out["name"].replace({"": np.nan}))
    out["item_key"] = key.fillna("—")

    numeric_present = [c for c in NUMERIC_FIELDS if c in out.columns]
    # Пустые строки (итоги, разделители) выкидываем, но только если этапы
    # действительно размечены — иначе таблица схлопнулась бы в ноль строк.
    anchors = [c for c in ("open_card", "orders") if out.get(c) is not None and out[c].notna().any()]
    if anchors:
        out = out.dropna(subset=anchors, how="all")
    out[numeric_present] = out[numeric_present].fillna(0.0)
    return out.reset_index(drop=True)
