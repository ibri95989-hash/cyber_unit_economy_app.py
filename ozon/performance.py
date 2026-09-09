"""Performance API Ozon: кампании, ставки, статистика продвижения.

Ключи отдельные от Seller API: Client ID и Client Secret создаются в рекламном
кабинете (Реклама → API-ключи, performance.ozon.ru). Авторизация — OAuth
client_credentials: токен живёт около 30 минут, клиент обновляет его сам.
"""
from __future__ import annotations

import time
from datetime import date, timedelta
import csv
import io
import json
import zipfile
from typing import Any, Dict, Iterable, List, Optional

from .client import ApiClient
from .config import Credentials, load_credentials
from .errors import OzonApiError, OzonAuthError
from .safety import WriteGuard

BASE_URL = "https://api-performance.ozon.ru"


def _unpack_report(raw: bytes) -> Dict[str, List[Dict[str, str]]]:
    """Разобрать zip с отчётами: имя файла — номер кампании и период."""
    out: Dict[str, List[Dict[str, str]]] = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for name in archive.namelist():
            text = archive.read(name).decode("utf-8-sig", errors="replace")
            # Ozon отдаёт csv с точкой с запятой; первая строка бывает служебной.
            rows = list(csv.reader(io.StringIO(text), delimiter=";"))
            rows = [r for r in rows if any(cell.strip() for cell in r)]
            if not rows:
                continue
            header = rows[0] if len(rows[0]) > 1 else (rows[1] if len(rows) > 1 else rows[0])
            body = rows[rows.index(header) + 1:]
            out[name] = [
                {header[i].strip(): cell.strip() for i, cell in enumerate(row) if i < len(header)}
                for row in body
            ]
    return out
TOKEN_PATH = "/api/client/token"
# Обновляем токен заранее, чтобы длинный отчёт не оборвался на середине.
TOKEN_MARGIN = 120


class PerformanceApi(ApiClient):
    """Чтение кампаний и статистики, при разрешённой записи — правка ставок."""

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
        if not creds.has_performance:
            raise OzonAuthError(
                "Нет ключей Performance API. Задайте OZON_PERF_CLIENT_ID и "
                "OZON_PERF_CLIENT_SECRET в окружении или в .env (см. .env.example)."
            )
        self.client_id = str(creds.perf_client_id)
        self.client_secret = str(creds.perf_client_secret)
        self.guard = guard or WriteGuard.from_env()
        self._token: Optional[str] = None
        self._expires_at: float = 0.0
        # Пока идёт запрос самого токена, авторизацию подставлять нечем.
        self._fetching_token = False

    # --------------------------------------------------------------- авторизация

    def token(self) -> str:
        """Действующий Bearer-токен: берём из кэша или получаем новый."""
        if self._token and time.time() < self._expires_at:
            return self._token
        self._fetching_token = True
        try:
            payload = self.request(
                "POST",
                TOKEN_PATH,
                body={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                },
            )
        finally:
            self._fetching_token = False
        token = (payload or {}).get("access_token")
        if not token:
            raise OzonAuthError("Performance API не вернул access_token — проверьте пару Client ID / Secret.")
        self._token = str(token)
        expires = payload.get("expires_in")
        self._expires_at = time.time() + (float(expires) if expires else 1800) - TOKEN_MARGIN
        return self._token

    def auth_headers(self) -> Dict[str, str]:
        if self._fetching_token:
            return {}
        return {"Authorization": f"Bearer {self.token()}"}

    # ------------------------------------------------------------------ кампании

    def campaigns(self, *, campaign_ids: Iterable[int] = (), state: str = "", adv_object_type: str = "") -> Any:
        """Список рекламных кампаний кабинета."""
        params: Dict[str, Any] = {}
        ids = [str(c) for c in campaign_ids]
        if ids:
            params["campaignIds"] = ids
        if state:
            params["state"] = state
        if adv_object_type:
            params["advObjectType"] = adv_object_type
        return self.get("/api/client/campaign", params=params or None)

    # Что за кампания, видно по advObjectType. Реферальные ссылки на блогеров
    # и ВК товарами не управляют: ставок и SKU у них нет, спрашивать нечего.
    PRODUCT_TYPES = ("SKU", "ALL_SKU_PROMO", "BANNER")
    SEARCH_TYPES = ("SEARCH_PROMO",)
    REFERRAL_TYPES = ("REF_BLOGGER", "REF_VK")

    def campaign_rows(self) -> List[Dict[str, Any]]:
        """Список кампаний в виде записей."""
        payload = self.campaigns() or {}
        rows = payload.get("list") or payload.get("campaigns") or []
        return [row for row in rows if isinstance(row, dict)]

    def campaigns_of_type(self, types: Iterable[str], *, running_only: bool = False) -> List[int]:
        """Номера кампаний нужного вида."""
        wanted = set(types)
        found: List[int] = []
        for row in self.campaign_rows():
            if row.get("advObjectType") not in wanted:
                continue
            if running_only and row.get("state") != "CAMPAIGN_STATE_RUNNING":
                continue
            raw = row.get("id")
            if str(raw).isdigit():
                found.append(int(raw))
        return found

    def campaign_objects(self, campaign_id: int) -> Any:
        """Что рекламируется в кампании."""
        return self.get(f"/api/client/campaign/{campaign_id}/objects")

    def products(self, campaign_id: int) -> Any:
        """Товары кампании вместе с текущими ставками."""
        return self.try_versions(
            "GET",
            [
                f"/api/client/campaign/{campaign_id}/v2/products",
                f"/api/client/campaign/{campaign_id}/products",
            ],
        )

    def search_promo_products(self, campaign_id: int, *, page: int = 0, page_size: int = 100) -> Any:
        """Товары в кампании «Продвижение в поиске» со ставками в процентах."""
        return self.post(
            f"/api/client/campaign/{campaign_id}/search_promo/products",
            body={"page": page, "pageSize": page_size},
        )

    # --------------------------------------------------------------------- ставки

    def current_bids(self, campaign_id: int) -> Dict[int, float]:
        """Карта sku → текущая ставка. Нужна, чтобы считать величину изменения."""
        payload = self.products(campaign_id)
        rows = (payload or {}).get("products") or (payload or {}).get("list") or []
        bids: Dict[int, float] = {}
        for row in rows:
            if not isinstance(row, dict):
                continue
            sku = row.get("sku") or row.get("id")
            bid = row.get("bid") or row.get("bidPrice") or row.get("price")
            try:
                if sku is not None and bid is not None:
                    bids[int(sku)] = float(bid)
            except (TypeError, ValueError):
                continue
        return bids

    def set_bids(
        self,
        campaign_id: int,
        bids: Dict[int, float],
        *,
        apply: bool = False,
        group_id: str = "",
    ) -> Any:
        """Изменить ставки по товарам кампании.

        bids — {sku: ставка}. Каждая позиция проходит через WriteGuard: сухой
        прогон по умолчанию, потолок ставки и лимит на величину шага.
        """
        if not bids:
            raise OzonApiError("Пустой список ставок — нечего менять.")

        previous = self.current_bids(campaign_id)
        for sku, bid in bids.items():
            self.guard.check(
                "ads.set_bid",
                {
                    "campaign_id": campaign_id,
                    "sku": int(sku),
                    "bid": float(bid),
                    "previous_bid": previous.get(int(sku)),
                },
                apply=apply,
            )

        body = {
            "bids": [
                {"sku": str(sku), "bid": str(bid), **({"groupId": group_id} if group_id else {})}
                for sku, bid in bids.items()
            ]
        }
        result = self.try_versions(
            "POST",
            [
                f"/api/client/campaign/{campaign_id}/v2/products",
                f"/api/client/campaign/{campaign_id}/products",
            ],
            body=body,
        )
        self.guard.audit(
            "ads.set_bid",
            {"campaign_id": campaign_id, "bids": {int(k): float(v) for k, v in bids.items()}},
            applied=True,
        )
        return result

    def set_search_promo_bids(self, campaign_id: int, bids: Dict[int, float], *, apply: bool = False) -> Any:
        """Ставки в «Продвижении в поиске» (задаются в процентах от цены)."""
        for sku, bid in bids.items():
            self.guard.check(
                "ads.set_search_promo_bid",
                {"campaign_id": campaign_id, "sku": int(sku), "bid": float(bid)},
                apply=apply,
            )
        result = self.post(
            f"/api/client/campaign/{campaign_id}/search_promo/bids/set",
            body={"bids": [{"sku": str(sku), "bid": str(bid)} for sku, bid in bids.items()]},
        )
        self.guard.audit("ads.set_search_promo_bid", {"campaign_id": campaign_id}, applied=True)
        return result

    def set_daily_budget(
        self, campaign_id: int, budget: float, *, apply: bool = False, confirm: bool = False
    ) -> Any:
        """Дневной бюджет кампании (в рублях)."""
        details = {"campaign_id": campaign_id, "daily_budget": float(budget)}
        self.guard.check("ads.set_daily_budget", details, apply=apply, confirm=confirm)
        # Ozon принимает бюджет в копейках-микро: рубли * 1 000 000.
        result = self.patch_campaign(campaign_id, {"dailyBudget": str(int(budget * 1_000_000))})
        self.guard.audit("ads.set_daily_budget", details, applied=True)
        return result

    def patch_campaign(self, campaign_id: int, fields: Dict[str, Any]) -> Any:
        """Точечное изменение полей кампании."""
        return self.request("PATCH", f"/api/client/campaign/{campaign_id}", body=fields)

    def activate(self, campaign_id: int, *, apply: bool = False) -> Any:
        """Включить кампанию."""
        details = {"campaign_id": campaign_id}
        self.guard.check("ads.activate", details, apply=apply)
        result = self.post(f"/api/client/campaign/{campaign_id}/activate", body={})
        self.guard.audit("ads.activate", details, applied=True)
        return result

    def deactivate(self, campaign_id: int, *, apply: bool = False) -> Any:
        """Выключить кампанию."""
        details = {"campaign_id": campaign_id}
        self.guard.check("ads.deactivate", details, apply=apply)
        result = self.post(f"/api/client/campaign/{campaign_id}/deactivate", body={})
        self.guard.audit("ads.deactivate", details, applied=True)
        return result

    # ---------------------------------------------------------------- статистика

    def statistics(
        self,
        campaign_ids: List[int],
        *,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        group_by: str = "DATE",
    ) -> Any:
        """Заказать отчёт по кампаниям. Возвращает UUID задачи."""
        today = date.today()
        return self.post(
            "/api/client/statistics",
            body={
                "campaigns": [str(c) for c in campaign_ids],
                "from": (date_from or (today - timedelta(days=14)).isoformat()) + "T00:00:00Z",
                "to": (date_to or today.isoformat()) + "T23:59:59Z",
                "groupBy": group_by,
            },
        )

    def statistics_status(self, uuid: str) -> Any:
        """Готов ли отчёт."""
        return self.get(f"/api/client/statistics/{uuid}")

    def statistics_report(self, uuid: str) -> Any:
        """Забрать готовый отчёт.

        По нескольким кампаниям Ozon отдаёт zip с отдельным csv на каждую —
        разбираем его здесь, чтобы наружу уходили обычные записи.
        """
        raw = self.request_raw("GET", "/api/client/statistics/report", params={"UUID": uuid})
        if not raw.startswith(b"PK"):
            try:
                return json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return {"отчёт": raw.decode("utf-8", errors="replace")[:5000]}
        return {"кампании": _unpack_report(raw)}

    def statistics_wait(self, uuid: str, *, attempts: int = 20, pause: float = 3.0) -> Any:
        """Дождаться отчёта и вернуть его содержимое."""
        for _ in range(attempts):
            status = self.statistics_status(uuid)
            state = str((status or {}).get("state") or "").upper()
            if state in ("OK", "DONE", "SUCCESS"):
                return self.statistics_report(uuid)
            if state in ("ERROR", "FAILED"):
                raise OzonApiError(f"Отчёт {uuid} не собрался: {status}")
            time.sleep(pause)
        raise OzonApiError(f"Отчёт {uuid} не готов за {int(attempts * pause)} секунд.")

    def phrases(
        self,
        *,
        campaign_ids: Optional[List[int]] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        page_size: int = 500,
    ) -> Any:
        """Показы и расход по поисковым фразам за период.

        Без кампаний метод отвечает «empty campaign», поэтому по умолчанию
        берём те, где фразы вообще бывают: поиск и трафареты.
        """
        today = date.today()
        ids = campaign_ids or self.campaigns_of_type(self.SEARCH_TYPES + self.PRODUCT_TYPES)
        if not ids:
            raise OzonApiError("В кабинете нет кампаний, у которых бывают поисковые фразы.")
        return self.post(
            "/api/client/statistics/phrases",
            body={
                "campaigns": [str(c) for c in ids],
                "dateFrom": date_from or (today - timedelta(days=30)).isoformat(),
                "dateTo": date_to or today.isoformat(),
                "page": 0,
                "pageSize": page_size,
            },
        )

    # ------------------------------------------------------------------- прочее

    def call(self, method: str, path: str, body: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Any:
        """Любой метод Performance API по документации."""
        return self.request(method, path, body=body, params=params)

    def ping(self) -> str:
        """Проверка ключей: получаем токен и список кампаний."""
        self.token()
        payload = self.campaigns()
        rows = (payload or {}).get("list") or (payload or {}).get("campaigns") or []
        return f"Performance API отвечает, кампаний в кабинете: {len(rows)}."
