"""Проверки интеграции с Ozon без обращения к сети.

Запуск: python -m unittest test_ozon
"""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from ozon.client import ApiClient
from ozon.config import Credentials, mask
from ozon.errors import OzonApiError, OzonWriteBlocked
from ozon.performance import PerformanceApi
from ozon.safety import WriteGuard
from ozon.seller import SellerApi
from ozon.workflows import SupplyPlan, create_supply, plan_supply


class MaskTest(unittest.TestCase):
    def test_key_is_never_shown_in_full(self) -> None:
        key = "0123456789abcdef"
        shown = mask(key)
        self.assertNotIn(key, shown)
        self.assertTrue(shown.startswith("0123"))

    def test_empty(self) -> None:
        self.assertEqual(mask(None), "—")


class GuardTest(unittest.TestCase):
    def setUp(self) -> None:
        self.audit = Path(tempfile.mkdtemp()) / "audit.jsonl"
        patcher = mock.patch("ozon.safety.AUDIT_FILE", self.audit)
        patcher.start()
        self.addCleanup(patcher.stop)

    def guard(self, **kwargs) -> WriteGuard:
        base = dict(writes_allowed=True, max_bid=500.0, max_change_pct=50.0, max_daily_budget=None)
        base.update(kwargs)
        return WriteGuard(**base)

    def test_dry_run_blocks_and_is_logged(self) -> None:
        guard = self.guard()
        with self.assertRaises(OzonWriteBlocked):
            guard.check("ads.set_bid", {"bid": 30}, apply=False)
        self.assertIn("dry-run", self.audit.read_text(encoding="utf-8"))

    def test_writes_must_be_allowed(self) -> None:
        with self.assertRaises(OzonWriteBlocked):
            self.guard(writes_allowed=False).check("ads.set_bid", {"bid": 30}, apply=True)

    def test_bid_ceiling(self) -> None:
        with self.assertRaises(OzonWriteBlocked):
            self.guard().check("ads.set_bid", {"bid": 900}, apply=True)

    def test_step_limit(self) -> None:
        with self.assertRaises(OzonWriteBlocked):
            self.guard().check("ads.set_bid", {"bid": 60, "previous_bid": 20}, apply=True)

    def test_sane_change_passes(self) -> None:
        self.guard().check("ads.set_bid", {"bid": 24, "previous_bid": 20}, apply=True)

    def test_from_env(self) -> None:
        with mock.patch.dict(os.environ, {"OZON_ALLOW_WRITES": "1", "OZON_MAX_BID": "120"}):
            guard = WriteGuard.from_env()
        self.assertTrue(guard.writes_allowed)
        self.assertEqual(guard.max_bid, 120.0)

    def test_writes_are_off_by_default(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(WriteGuard.from_env().writes_allowed)


class VersionFallbackTest(unittest.TestCase):
    def test_falls_back_to_previous_version(self) -> None:
        client = ApiClient()
        calls: list[str] = []

        def fake(method, path, **kwargs):
            calls.append(path)
            if path.startswith("/v3"):
                raise OzonApiError("нет такого метода", status=404, path=path)
            return {"ok": True}

        with mock.patch.object(ApiClient, "request", side_effect=fake):
            result = client.try_versions("POST", ["/v3/x", "/v2/x"])
        self.assertEqual(result, {"ok": True})
        self.assertEqual(calls, ["/v3/x", "/v2/x"])

    def test_real_error_is_not_swallowed(self) -> None:
        def fake(method, path, **kwargs):
            raise OzonApiError("кривое тело запроса", status=400, path=path)

        with mock.patch.object(ApiClient, "request", side_effect=fake):
            with self.assertRaises(OzonApiError):
                ApiClient().try_versions("POST", ["/v3/x", "/v2/x"])


class PerformanceTokenTest(unittest.TestCase):
    def creds(self) -> Credentials:
        return Credentials(perf_client_id="id", perf_client_secret="secret")

    def test_token_is_cached_and_used_as_bearer(self) -> None:
        api = PerformanceApi(self.creds(), guard=WriteGuard())
        responses = [{"access_token": "T1", "expires_in": 1800}, {"list": []}]

        def fake(method, path, **kwargs):
            # Пока берём токен, заголовка авторизации ещё нет.
            self.assertEqual(api.auth_headers() == {}, path == "/api/client/token")
            return responses.pop(0)

        with mock.patch.object(ApiClient, "request", side_effect=fake):
            api.campaigns()
            self.assertEqual(api.token(), "T1")  # второй раз из кэша, запроса нет
        self.assertEqual(responses, [])

    def test_missing_token_is_an_auth_error(self) -> None:
        api = PerformanceApi(self.creds(), guard=WriteGuard())
        with mock.patch.object(ApiClient, "request", return_value={}):
            with self.assertRaises(OzonApiError):
                api.token()

    def test_bids_are_not_sent_without_apply(self) -> None:
        api = PerformanceApi(self.creds(), guard=WriteGuard(writes_allowed=True))
        with mock.patch.object(PerformanceApi, "current_bids", return_value={1: 20.0}):
            with mock.patch.object(ApiClient, "request") as request:
                with self.assertRaises(OzonWriteBlocked):
                    api.set_bids(7, {1: 22.0}, apply=False)
                request.assert_not_called()


class SupplyOrderRequestShapeTest(unittest.TestCase):
    """Ozon ответил «invalid SupplyOrderListRequest.Limit» — воспроизводим и лечим."""

    def api(self) -> SellerApi:
        creds = Credentials(seller_client_id="id", seller_api_key="key")
        return SellerApi(creds, guard=WriteGuard())

    def strict_ozon(self, calls: list):
        """Сервер, который принимает только v3 с limit на верхнем уровне."""

        def fake(self_, method, path, *, body=None, **kwargs):
            calls.append((path, body))
            if path != "/v3/supply-order/list":
                raise OzonApiError("метод выключен", status=404, path=path)
            limit = (body or {}).get("limit")
            if not isinstance(limit, int) or not 1 <= limit <= 100:
                raise OzonApiError(
                    "Request validation error: invalid SupplyOrderListRequest.Limit: "
                    "value must be inside range [1, 100]",
                    status=400,
                    path=path,
                )
            return {"supply_orders": [{"supply_order_id": 1}]}

        return mock.patch.object(SellerApi, "request", fake)

    def test_limit_goes_to_the_top_level(self) -> None:
        calls: list = []
        with self.strict_ozon(calls):
            result = self.api().supply_orders(limit=50)
        self.assertEqual(calls[0][1]["limit"], 50)
        self.assertEqual(result["supply_orders"][0]["supply_order_id"], 1)

    def test_limit_above_hundred_is_clamped(self) -> None:
        calls: list = []
        with self.strict_ozon(calls):
            self.api().supply_orders(limit=500)
        self.assertEqual(calls[0][1]["limit"], 100)

    def test_falls_back_to_paging_shape_on_old_version(self) -> None:
        """Если v3 выключен, уходим на v2 со старой формой тела."""
        calls: list = []

        def fake(self_, method, path, *, body=None, **kwargs):
            calls.append((path, body))
            if path == "/v3/supply-order/list":
                raise OzonApiError("метод выключен", status=404, path=path)
            if "paging" not in (body or {}):
                raise OzonApiError("нужен paging", status=400, path=path)
            return {"supply_orders": []}

        with mock.patch.object(SellerApi, "request", fake):
            self.api().supply_orders(limit=30)
        # Сначала перебираются формы тела для v3, затем — старая схема с paging.
        self.assertTrue(all(path.startswith("/v3") for path, _ in calls[:-1]))
        self.assertEqual(calls[-1][0], "/v2/supply-order/list")
        self.assertEqual(calls[-1][1]["paging"]["limit"], 30)

    def test_get_tries_both_field_names(self) -> None:
        calls: list = []

        def fake(self_, method, path, *, body=None, **kwargs):
            calls.append((path, body))
            if "supply_order_id" not in (body or {}):
                raise OzonApiError("нужен supply_order_id", status=400, path=path)
            return {"orders": [{"supply_order_id": 7}]}

        with mock.patch.object(SellerApi, "request", fake):
            result = self.api().supply_order([7])
        self.assertEqual(result["orders"][0]["supply_order_id"], 7)
        self.assertEqual(len(calls), 2)

    def test_real_error_is_reported_not_swallowed(self) -> None:
        """Что сказал Ozon, то и должен прочитать человек — даже внутри 404."""

        def fake(self_, method, path, *, body=None, **kwargs):
            raise OzonApiError("склад не найден", status=404, path=path)

        with mock.patch.object(SellerApi, "request", fake):
            with self.assertRaises(OzonApiError) as caught:
                self.api().supply_orders()
        self.assertIn("склад не найден", str(caught.exception))

    def test_body_complaint_wins_over_disabled_versions(self) -> None:
        """Жалоба живого метода важнее, чем 404 от выключенных версий."""

        def fake(self_, method, path, *, body=None, **kwargs):
            if path.startswith("/v3"):
                raise OzonApiError("invalid Filter: required", status=400, path=path)
            raise OzonApiError("404 page not found", status=404, path=path)

        with mock.patch.object(SellerApi, "request", fake):
            with self.assertRaises(OzonApiError) as caught:
                self.api().supply_orders()
        self.assertIn("invalid Filter", str(caught.exception))
        self.assertTrue(caught.exception.attempts)
        self.assertEqual(caught.exception.attempts[-1][1], 404)


class SupplyWorkflowTest(unittest.TestCase):
    """Цепочка «черновик → склады → интервалы → заявка» целиком, без сети."""

    def api(self, *, writes: bool = True) -> SellerApi:
        creds = Credentials(seller_client_id="id", seller_api_key="key")
        return SellerApi(creds, guard=WriteGuard(writes_allowed=writes))

    def responses(self) -> dict:
        return {
            "/v1/cluster/list": {"clusters": [{"id": "5", "name": "Москва"}]},
            "/v1/draft/create": {"operation_id": "op-1"},
            "/v1/draft/create/info": {
                "status": "CALCULATION_STATUS_SUCCESS",
                "draft_id": 777,
                "clusters": [{"warehouses": [{"warehouse_id": 42, "name": "Хоругвино"}]}],
            },
            "/v1/draft/timeslot/info": {
                "drop_off_warehouse_timeslots": [
                    {"warehouse_id": 42, "from_in_timezone": "2026-09-15T10:00:00Z",
                     "to_in_timezone": "2026-09-15T12:00:00Z"}
                ]
            },
            "/v1/draft/supply/create": {"operation_id": "op-2"},
            "/v1/draft/supply/create/status": {"status": "SUCCESS", "supply_order_id": 999},
        }

    def patched(self, responses: dict):
        def fake(self_, method, path, **kwargs):
            if path in responses:
                return responses[path]
            raise OzonApiError("нет такого метода", status=404, path=path)

        return mock.patch.object(SellerApi, "request", fake)

    def setUp(self) -> None:
        patcher = mock.patch("ozon.safety.AUDIT_FILE", Path(tempfile.mkdtemp()) / "audit.jsonl")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_plan_collects_warehouses_and_timeslots(self) -> None:
        with self.patched(self.responses()):
            plan = plan_supply(self.api(), items=[{"sku": 1, "quantity": 10}])
        self.assertEqual(plan.draft_id, 777)
        self.assertEqual(plan.units, 10)
        self.assertEqual(plan.warehouses[0]["warehouse_id"], 42)
        self.assertEqual(len(plan.timeslots), 1)
        self.assertIn("Хоругвино", plan.summary())

    def test_create_needs_confirmation(self) -> None:
        plan = SupplyPlan(draft_id=777, operation_id="op-1", items=[{"sku": 1, "quantity": 10}])
        with self.patched(self.responses()) as request:
            with self.assertRaises(OzonWriteBlocked):
                create_supply(
                    self.api(),
                    plan,
                    warehouse_id=42,
                    timeslot_from="2026-09-15T10:00:00Z",
                    timeslot_to="2026-09-15T12:00:00Z",
                    confirm=False,
                )

    def test_create_with_confirmation_returns_order(self) -> None:
        with self.patched(self.responses()):
            api = self.api()
            plan = plan_supply(api, items=[{"sku": 1, "quantity": 10}])
            result = create_supply(api, plan, confirm=True)
        self.assertEqual(result["supply_order_id"], 999)
        self.assertEqual(result["warehouse_id"], 42)
        self.assertEqual(result["units"], 10)

    def test_writes_off_blocks_even_the_draft(self) -> None:
        with self.patched(self.responses()):
            with self.assertRaises(OzonWriteBlocked):
                plan_supply(self.api(writes=False), items=[{"sku": 1, "quantity": 10}])

    def test_bad_position_is_rejected_before_any_call(self) -> None:
        with mock.patch.object(SellerApi, "request") as request:
            with self.assertRaises(OzonApiError):
                plan_supply(self.api(), items=[{"sku": 1, "quantity": 0}])
            request.assert_not_called()

    def test_ambiguous_warehouse_is_not_guessed(self) -> None:
        responses = self.responses()
        responses["/v1/draft/create/info"] = {
            "status": "SUCCESS",
            "draft_id": 777,
            "clusters": [{"warehouses": [{"warehouse_id": 42}, {"warehouse_id": 43}]}],
        }
        with self.patched(responses):
            api = self.api()
            plan = plan_supply(api, items=[{"sku": 1, "quantity": 10}])
            with self.assertRaises(OzonApiError):
                create_supply(api, plan, confirm=True)


class ConfirmationTierTest(unittest.TestCase):
    def setUp(self) -> None:
        patcher = mock.patch("ozon.safety.AUDIT_FILE", Path(tempfile.mkdtemp()) / "audit.jsonl")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_reversible_action_needs_no_confirmation(self) -> None:
        WriteGuard(writes_allowed=True).check("ads.set_bid", {"bid": 30}, apply=True)

    def test_irreversible_action_needs_confirmation(self) -> None:
        guard = WriteGuard(writes_allowed=True)
        with self.assertRaises(OzonWriteBlocked):
            guard.check("supply.cancel", {}, apply=True)
        guard.check("supply.cancel", {}, apply=True, confirm=True)

    def test_list_is_configurable(self) -> None:
        with mock.patch.dict(os.environ, {"OZON_ALLOW_WRITES": "1", "OZON_CONFIRM_ACTIONS": "ads.set_bid"}):
            guard = WriteGuard.from_env()
        with self.assertRaises(OzonWriteBlocked):
            guard.check("ads.set_bid", {"bid": 30}, apply=True)
        guard.check("supply.cancel", {}, apply=True)


if __name__ == "__main__":
    unittest.main()
