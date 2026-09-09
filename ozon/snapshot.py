"""Снимок кабинета одним файлом — чтобы показать его Claude в любом чате.

MCP-сервер даёт живой доступ, но требует настройки. Снимок работает всегда:
панель собирает остатки, поставки и аналитику в один файл, файл прикладывается
к переписке. Ключи в него не попадают — только данные из кабинета.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .config import Credentials, load_credentials
from .errors import OzonApiError
from .performance import PerformanceApi
from .seller import SellerApi
from .version import VERSION

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_FILE = ROOT / "ozon_snapshot.json"
STOCKS_CSV = ROOT / "ozon_stocks.csv"


def desktop() -> Optional[Path]:
    """Рабочий стол пользователя, если он есть.

    Снимок кладётся туда же: рядом с запускающими файлами его легко перепутать
    с ними, а на рабочем столе он один такой.
    """
    home = Path.home()
    for candidate in (home / "Desktop", home / "OneDrive" / "Desktop", home / "Рабочий стол"):
        if candidate.is_dir():
            return candidate
    return None

# Ничего похожего на ключи в снимок попасть не должно, даже случайно.
FORBIDDEN = ("api_key", "api-key", "client_secret", "client-secret", "authorization", "access_token")


def _rows(payload: Any) -> List[Dict[str, Any]]:
    """Достать список записей из ответа Ozon, какой бы ни была вложенность."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for value in payload.values():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                return value
            if isinstance(value, dict):
                nested = _rows(value)
                if nested:
                    return nested
    return []


def _clean(value: Any) -> Any:
    """Выбросить всё, что похоже на секрет. Снимок уходит наружу."""
    if isinstance(value, dict):
        return {
            key: _clean(item)
            for key, item in value.items()
            if not any(mark in str(key).lower() for mark in FORBIDDEN)
        }
    if isinstance(value, list):
        return [_clean(item) for item in value]
    return value


def _part(name: str, call: Callable[[], Any]) -> Dict[str, Any]:
    try:
        payload = call()
    except OzonApiError as exc:
        return {"раздел": name, "ошибка": str(exc).splitlines()[0]}
    rows = _rows(payload)
    return {"раздел": name, "записей": len(rows), "данные": _clean(rows or payload)}


def _campaign_ids(payload: Any) -> List[int]:
    """Номера кампаний из ответа рекламного кабинета."""
    ids: List[int] = []
    for row in _rows(payload):
        raw = row.get("id") or row.get("campaignId") or row.get("campaign_id")
        if str(raw).isdigit():
            ids.append(int(raw))
    return ids


def _advertising(creds: Credentials) -> List[Dict[str, Any]]:
    """Разделы рекламного кабинета. Без ключей — один поясняющий раздел."""
    if not creds.has_performance:
        return [
            {
                "раздел": "Реклама",
                "ошибка": "Нет ключей Performance API — введите их в панели, "
                "раздел «Ключи Ozon», нижние два поля.",
            }
        ]

    ads = PerformanceApi(creds)
    parts = [_part("Рекламные кампании", lambda: ads.campaigns())]

    try:
        rows = ads.campaign_rows()
    except OzonApiError:
        return parts

    # Реферальные кампании (блогеры, ВК) товарами и ставками не управляют —
    # спрашивать у них состав бессмысленно, метод отвечает «не найдена».
    sku = ads.campaigns_of_type(ads.PRODUCT_TYPES)
    search = ads.campaigns_of_type(ads.SEARCH_TYPES)
    referral = ads.campaigns_of_type(ads.REFERRAL_TYPES)

    parts.append(
        {
            "раздел": "Кампании по видам",
            "записей": len(rows),
            "данные": {
                "товарные": sku,
                "продвижение_в_поиске": search,
                "реферальные_ссылки": referral,
                "работают": [r.get("id") for r in rows if r.get("state") == "CAMPAIGN_STATE_RUNNING"],
            },
        }
    )

    if sku:
        parts.append(
            _part("Товары и ставки в трафаретах", lambda: {str(c): ads.products(c) for c in sku[:5]})
        )
    if search:
        parts.append(
            _part(
                "Товары в продвижении в поиске",
                lambda: {str(c): ads.search_promo_products(c) for c in search[:5]},
            )
        )

    paid = sku + search
    if paid:
        def report() -> Any:
            task = ads.statistics(paid[:10])
            uuid = (task or {}).get("UUID") or (task or {}).get("uuid")
            return ads.statistics_wait(str(uuid)) if uuid else task

        parts.append(_part("Отчёт по кампаниям за 14 дней", report))
        parts.append(_part("Поисковые фразы за 30 дней", lambda: ads.phrases(campaign_ids=paid)))

    return parts


def collect(credentials: Optional[Credentials] = None, *, limit: int = 500) -> Dict[str, Any]:
    """Собрать снимок кабинета: товары, поставки и реклама."""
    creds = credentials or load_credentials()
    if not creds.has_seller and not creds.has_performance:
        raise OzonApiError("Ключей нет — собирать нечего.")

    sections: List[Dict[str, Any]] = []
    if creds.has_seller:
        api = SellerApi(creds)
        sections += [
            _part("Остатки по складам FBO", lambda: api.stocks_on_warehouses(limit=limit)),
            _part("Остатки по товарам", lambda: api.stocks(limit=min(limit, 100))),
            _part("Товары", lambda: api.product_list(limit=min(limit, 100))),
            _part("Счётчик статусов поставок", api.supply_status_counter),
            _part("Заявки на поставку", lambda: api.supply_orders_detailed(limit=50)),
            _part("Аналитика продаж за 30 дней", lambda: api.analytics(limit=min(limit, 500))),
        ]
    else:
        sections.append({"раздел": "Кабинет продавца", "ошибка": "Нет ключей Seller API."})

    sections += _advertising(creds)

    snapshot = {
        "снято": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "версия_панели": VERSION,
        "разделы": sections,
    }
    # Выводы считаются здесь же: они нужны и в панели, и в файле.
    from .insights import analyse

    snapshot["выводы"] = analyse(snapshot)
    return snapshot


def stocks_table(snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Остатки отдельной таблицей — её удобнее читать и человеку, и Claude."""
    for part in snapshot.get("разделы", []):
        if part.get("раздел", "").startswith("Остатки по складам") and part.get("данные"):
            data = part["данные"]
            return data if isinstance(data, list) else []
    return []


def save(snapshot: Optional[Dict[str, Any]] = None) -> List[Path]:
    """Записать снимок рядом с панелью. Возвращает созданные файлы."""
    import csv

    snapshot = snapshot or collect()
    SNAPSHOT_FILE.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    written = [SNAPSHOT_FILE]

    # Копия на рабочий стол: оттуда её не спутать с batch-файлами.
    place = desktop()
    if place:
        copy = place / SNAPSHOT_FILE.name
        try:
            copy.write_text(SNAPSHOT_FILE.read_text(encoding="utf-8"), encoding="utf-8")
            written.append(copy)
        except OSError:
            pass

    table = stocks_table(snapshot)
    if table:
        columns: List[str] = []
        for row in table:
            for key in row:
                if key not in columns:
                    columns.append(key)
        with STOCKS_CSV.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(table)
        written.append(STOCKS_CSV)
    return written


def main() -> int:
    try:
        files = save()
    except OzonApiError as exc:
        print(f"[!] {exc}")
        return 1
    print("Снимок собран:")
    for path in files:
        print(f"  {path}")
    print("\nПриложите эти файлы к переписке с Claude — ключей в них нет.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
