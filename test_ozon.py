"""Проверки интеграции с Ozon без обращения к сети.

Запуск: python -m unittest test_ozon
"""
from __future__ import annotations

import json
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


class ProxyTest(unittest.TestCase):
    """Запросы к Ozon можно увести через отдельный прокси."""

    def test_proxy_is_applied_when_set(self) -> None:
        with mock.patch.dict(os.environ, {"OZON_PROXY": "http://127.0.0.1:8080"}):
            client = ApiClient()
        self.assertEqual(client.session.proxies["https"], "http://127.0.0.1:8080")

    def test_no_proxy_by_default(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            client = ApiClient()
        self.assertFalse(client.session.proxies)


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


class FakeOzon:
    """Подделка Seller API по схеме, снятой со swagger Ozon.

    Отвечает только на то, что документировано, и жалуется ровно так же, как
    настоящий сервер: по этим ошибкам и восстанавливалась схема.
    """

    SORT_FIELDS = {"ORDER_CREATION", "ORDER_STATE_UPDATED_AT", "TIMESLOT_FROM_UTC", "TIMESLOT_FROM_LOCAL"}

    def __init__(self) -> None:
        self.calls: list = []

    def body(self, path: str):
        """Тело последнего запроса к указанному методу."""
        for called, body in reversed(self.calls):
            if called == path:
                return body
        raise AssertionError(f"К {path} не обращались. Были: {[p for p, _ in self.calls]}")

    def paths(self, *, skip_counter: bool = True) -> list:
        """Пути запросов; служебный счётчик статусов обычно не интересен."""
        return [
            path
            for path, _ in self.calls
            if not (skip_counter and path.endswith("status/counter"))
        ]

    # Подставляется вместо метода класса, поэтому self сюда не приходит.
    def __call__(self, method, path, *, body=None, **kwargs):
        self.calls.append((path, body))
        handler = {
            "/v3/supply-order/list": self.list_orders,
            "/v3/supply-order/get": self.get_orders,
            "/v1/supply-order/timeslot/get": self.timeslots,
            "/v1/cluster/list": self.clusters,
            "/v1/draft/direct/create": self.draft,
            "/v1/supply-order/status/counter": self.counter,
        }.get(path)
        if handler is None:
            raise OzonApiError("404 page not found", status=404, path=path)
        return handler(body or {})

    def counter(self, body):
        # Так отвечает настоящий кабинет: рядом с кодом статуса лежат его
        # человеческое название и сокращение, не принадлежащее перечислению.
        return {
            "items": [
                {"state": "ORDER_STATE_DATA_FILLING", "status": "DATA_FILLING",
                 "title": "Заполнение данных", "count": 2},
                {"state": "ORDER_STATE_IN_TRANSIT", "status": "IN_TRANSIT",
                 "title": "В пути", "count": 1},
            ]
        }

    def list_orders(self, body):
        limit = body.get("limit")
        if not isinstance(limit, int) or not 1 <= limit <= 100:
            raise OzonApiError(
                "Request validation error: invalid SupplyOrderListRequest.Limit: "
                "value must be inside range [1, 100]",
                status=400,
                path="/v3/supply-order/list",
            )
        if body.get("sort_by") not in self.SORT_FIELDS:
            raise OzonApiError(
                "Request validation error: invalid SupplyOrderListRequest.SortBy: "
                "value must not be in list [0]",
                status=400,
                path="/v3/supply-order/list",
            )
        states = (body.get("filter") or {}).get("states")
        if not states:
            raise OzonApiError(
                "Request validation error: invalid SupplyOrderListRequest.Filter: embedded "
                "message failed validation | caused by: invalid SupplyOrderListRequest_Filter."
                "States: value must contain at least 1 item(s)",
                status=400,
                path="/v3/supply-order/list",
            )
        return {"order_ids": ["4321"], "last_id": "4321"}

    def get_orders(self, body):
        ids = body.get("order_ids")
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise OzonApiError("invalid OrderIds: must be strings", status=400, path="/v3/supply-order/get")
        return {"orders": [{"order_id": int(i), "state": "ORDER_STATE_DATA_FILLING"} for i in ids]}

    def timeslots(self, body):
        if "supply_order_id" not in body:
            raise OzonApiError("invalid SupplyOrderId", status=400, path="/v1/supply-order/timeslot/get")
        return {"timeslots": [{"from": "2026-09-15T10:00:00Z", "to": "2026-09-15T12:00:00Z"}]}

    def clusters(self, body):
        if body.get("cluster_type") != "CLUSTER_TYPE_OZON":
            raise OzonApiError("invalid ClusterType", status=400, path="/v1/cluster/list")
        return {
            "clusters": [
                {
                    "id": 5,
                    "name": "Москва",
                    "macrolocal_cluster_id": 77,
                    "logistic_clusters": [{"warehouses": [{"warehouse_id": 42, "name": "Хоругвино"}]}],
                }
            ]
        }

    def draft(self, body):
        info = body.get("cluster_info") or {}
        if not str(info.get("macrolocal_cluster_id", "")).isdigit():
            raise OzonApiError("invalid ClusterInfo", status=400, path="/v1/draft/direct/create")
        if body.get("deletion_sku_mode") not in ("FULL", "PARTIAL"):
            raise OzonApiError("invalid DeletionSkuMode", status=400, path="/v1/draft/direct/create")
        return {"draft_id": 777, "errors": []}


class SupplyOrderRequestShapeTest(unittest.TestCase):
    """Форма запросов к поставкам — по схеме, а не по догадкам."""

    def api(self) -> SellerApi:
        creds = Credentials(seller_client_id="id", seller_api_key="key")
        return SellerApi(creds, guard=WriteGuard())

    def test_list_passes_validation_of_the_real_schema(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            result = self.api().supply_orders(limit=50)
        body = ozon.body("/v3/supply-order/list")
        self.assertEqual(body["limit"], 50)
        self.assertEqual(body["sort_by"], "ORDER_CREATION")
        self.assertEqual(body["sort_dir"], "DESC")
        self.assertIn("filter", body)
        self.assertEqual(result["order_ids"], ["4321"])

    def test_states_are_taken_from_the_status_counter(self) -> None:
        """Фильтр без статусов Ozon отвергает, поэтому спрашиваем их у него же."""
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_orders(limit=10)
        self.assertEqual(ozon.calls[0][0], "/v1/supply-order/status/counter")
        states = ozon.body("/v3/supply-order/list")["filter"]["states"]
        # Из счётчика берутся только коды перечисления: «DATA_FILLING» без
        # префикса и русские названия туда попасть не должны.
        self.assertEqual(states[:2], ["ORDER_STATE_DATA_FILLING", "ORDER_STATE_IN_TRANSIT"])
        self.assertTrue(all(state.startswith("ORDER_STATE_") for state in states))
        self.assertEqual(len(states), len(set(states)))

    def test_states_are_asked_once_per_client(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            api = self.api()
            api.supply_orders()
            api.supply_orders()
        counters = [path for path, _ in ozon.calls if path.endswith("status/counter")]
        self.assertEqual(len(counters), 1)

    def test_explicit_states_win_over_discovery(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_orders(states=["ORDER_STATE_IN_TRANSIT"])
        self.assertNotIn("/v1/supply-order/status/counter", [path for path, _ in ozon.calls])
        self.assertEqual(
            ozon.body("/v3/supply-order/list")["filter"]["states"], ["ORDER_STATE_IN_TRANSIT"]
        )

    def test_known_states_are_used_when_the_counter_is_silent(self) -> None:
        ozon = FakeOzon()
        ozon.counter = lambda body: {"items": []}
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_orders()
        states = ozon.body("/v3/supply-order/list")["filter"]["states"]
        self.assertEqual(states, list(SellerApi.KNOWN_STATES))

    def test_counter_without_enum_codes_does_not_poison_the_filter(self) -> None:
        """Ozon отбрасывает неизвестные значения — фильтр остался бы пустым."""
        ozon = FakeOzon()
        ozon.counter = lambda body: {"items": [{"status": "DATA_FILLING", "title": "Заполнение"}]}
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_orders()
        states = ozon.body("/v3/supply-order/list")["filter"]["states"]
        self.assertNotIn("DATA_FILLING", states)
        self.assertIn("ORDER_STATE_DATA_FILLING", states)

    def test_fbo_warehouses_send_supply_types(self) -> None:
        """Метод не принимает пустой список типов поставки."""
        ozon = FakeOzon()
        ozon.calls.clear()

        def fake(self_, method, path, *, body=None, **kwargs):
            ozon.calls.append((path, body))
            if not (body or {}).get("filter_by_supply_type"):
                raise OzonApiError(
                    "invalid DraftGetWarehouseFboListRequest.FilterBySupplyType: "
                    "value must contain at least 1 item(s)",
                    status=400,
                    path=path,
                )
            return {"warehouses": []}

        with mock.patch.object(SellerApi, "request", fake):
            self.api().supply_warehouses()
        self.assertTrue(ozon.calls[0][1]["filter_by_supply_type"])

    def test_limit_above_hundred_is_clamped(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_orders(limit=500)
        self.assertEqual(ozon.body("/v3/supply-order/list")["limit"], 100)

    def test_unknown_sort_field_falls_back_to_a_valid_one(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_orders(sort_by="ПОПУЛЯРНОСТЬ")
        self.assertEqual(ozon.body("/v3/supply-order/list")["sort_by"], "ORDER_CREATION")

    def test_get_sends_string_ids(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().supply_order([4321])
        self.assertEqual(ozon.body("/v3/supply-order/get"), {"order_ids": ["4321"]})

    def test_detailed_listing_joins_both_calls(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            orders = self.api().supply_orders_detailed(limit=10)
        self.assertEqual(ozon.paths(), ["/v3/supply-order/list", "/v3/supply-order/get"])
        self.assertEqual(orders[0]["order_id"], 4321)

    def test_empty_listing_does_not_ask_for_details(self) -> None:
        ozon = FakeOzon()
        ozon.list_orders = lambda body: {"order_ids": []}
        with mock.patch.object(SellerApi, "request", ozon):
            self.assertEqual(self.api().supply_orders_detailed(), [])
        self.assertEqual(ozon.paths(), ["/v3/supply-order/list"])

    def test_timeslots_ask_by_order_only(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            self.api().timeslots(4321)
        self.assertEqual(ozon.body("/v1/supply-order/timeslot/get"), {"supply_order_id": 4321})

    def test_real_error_is_reported_not_swallowed(self) -> None:
        def fake(self_, method, path, *, body=None, **kwargs):
            raise OzonApiError("склад не найден", status=404, path=path)

        with mock.patch.object(SellerApi, "request", fake):
            with self.assertRaises(OzonApiError) as caught:
                self.api().supply_orders()
        self.assertIn("склад не найден", str(caught.exception))

    def test_body_complaint_wins_over_disabled_versions(self) -> None:
        def fake(self_, method, path, *, body=None, **kwargs):
            if path.startswith("/v3"):
                raise OzonApiError("invalid Filter: required", status=400, path=path)
            raise OzonApiError("404 page not found", status=404, path=path)

        with mock.patch.object(SellerApi, "request", fake):
            with self.assertRaises(OzonApiError) as caught:
                self.api().supply_orders()
        self.assertIn("invalid Filter", str(caught.exception))
        self.assertEqual(caught.exception.attempts[-1][1], 404)


class SupplyWorkflowTest(unittest.TestCase):
    """Черновик поставки по схеме /v1/draft/direct/create."""

    def api(self, *, writes: bool = True) -> SellerApi:
        creds = Credentials(seller_client_id="id", seller_api_key="key")
        return SellerApi(creds, guard=WriteGuard(writes_allowed=writes))

    def setUp(self) -> None:
        patcher = mock.patch("ozon.safety.AUDIT_FILE", Path(tempfile.mkdtemp()) / "audit.jsonl")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_draft_is_created_from_the_cluster(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            plan = plan_supply(self.api(), items=[{"sku": 1, "quantity": 10}])
        self.assertEqual(plan.draft_id, 777)
        self.assertEqual(plan.units, 10)
        self.assertEqual(plan.warehouses[0]["warehouse_id"], 42)
        draft_body = ozon.body("/v1/draft/direct/create")
        self.assertEqual(draft_body["cluster_info"]["macrolocal_cluster_id"], 77)
        self.assertEqual(draft_body["deletion_sku_mode"], "FULL")

    def test_draft_errors_are_reported(self) -> None:
        ozon = FakeOzon()
        ozon.draft = lambda body: {"errors": [{"code": "SKU_NOT_FOUND"}]}
        with mock.patch.object(SellerApi, "request", ozon):
            with self.assertRaises(OzonApiError) as caught:
                plan_supply(self.api(), items=[{"sku": 1, "quantity": 10}])
        self.assertIn("SKU_NOT_FOUND", str(caught.exception))

    def test_writes_off_blocks_even_the_draft(self) -> None:
        ozon = FakeOzon()
        with mock.patch.object(SellerApi, "request", ozon):
            with self.assertRaises(OzonWriteBlocked):
                plan_supply(self.api(writes=False), items=[{"sku": 1, "quantity": 10}])

    def test_bad_position_is_rejected_before_any_call(self) -> None:
        with mock.patch.object(SellerApi, "request") as request:
            with self.assertRaises(OzonApiError):
                plan_supply(self.api(), items=[{"sku": 1, "quantity": 0}])
            request.assert_not_called()

    def test_create_needs_confirmation(self) -> None:
        plan = SupplyPlan(draft_id=777, operation_id="", items=[{"sku": 1, "quantity": 10}])
        with mock.patch.object(SellerApi, "request", FakeOzon()):
            with self.assertRaises(OzonWriteBlocked):
                create_supply(
                    self.api(),
                    plan,
                    warehouse_id=42,
                    timeslot_from="2026-09-15T10:00:00Z",
                    timeslot_to="2026-09-15T12:00:00Z",
                    confirm=False,
                )

    def test_ambiguous_warehouse_is_not_guessed(self) -> None:
        plan = SupplyPlan(
            draft_id=777,
            operation_id="",
            items=[{"sku": 1, "quantity": 10}],
            warehouses=[{"warehouse_id": 42}, {"warehouse_id": 43}],
        )
        with mock.patch.object(SellerApi, "request", FakeOzon()):
            with self.assertRaises(OzonApiError):
                create_supply(self.api(), plan, confirm=True)


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


class UpdaterTest(unittest.TestCase):
    """Обновление не должно уносить с собой ключи и журнал."""

    def archive(self) -> bytes:
        import io
        import zipfile

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("proj-branch/ozon_app.py", "новая панель")
            archive.writestr("proj-branch/ozon/version.py", 'VERSION = "тест"')
            archive.writestr("proj-branch/start_ozon.bat", "новый запускатель")
            archive.writestr("proj-branch/update_ozon.bat", "новый апдейтер")
        return buffer.getvalue()

    def setUp(self) -> None:
        import io
        import zipfile

        from ozon import update as updater

        self.root = Path(tempfile.mkdtemp())
        (self.root / ".env").write_text("OZON_API_KEY=секрет", encoding="utf-8")
        (self.root / "ozon_audit.jsonl").write_text('{"action": "ads.set_bid"}', encoding="utf-8")
        (self.root / "start_ozon.bat").write_text("старый запускатель", encoding="utf-8")
        (self.root / "update_ozon.bat").write_text("старый апдейтер", encoding="utf-8")
        (self.root / ".venv").mkdir()
        (self.root / ".venv" / "python.exe").write_text("не трогать", encoding="utf-8")

        self.updater = updater
        patches = [
            mock.patch.object(updater, "ROOT", self.root),
            mock.patch.object(updater, "_download", lambda: zipfile.ZipFile(io.BytesIO(self.archive()))),
        ]
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_personal_files_survive(self) -> None:
        self.updater.update(exclude=self.updater.SELF, quiet=True)
        self.assertEqual((self.root / ".env").read_text(encoding="utf-8"), "OZON_API_KEY=секрет")
        self.assertIn("ads.set_bid", (self.root / "ozon_audit.jsonl").read_text(encoding="utf-8"))
        self.assertEqual((self.root / ".venv" / "python.exe").read_text(encoding="utf-8"), "не трогать")

    def test_program_files_are_replaced(self) -> None:
        changed = self.updater.update(exclude=self.updater.SELF, quiet=True)
        self.assertIn("ozon_app.py", changed)
        self.assertEqual((self.root / "ozon_app.py").read_text(encoding="utf-8"), "новая панель")

    def test_running_launcher_is_not_overwritten(self) -> None:
        """Windows читает .bat на ходу — заменять работающий файл нельзя."""
        self.updater.update(exclude=self.updater.BOTH_LAUNCHERS, quiet=True)
        self.assertEqual((self.root / "start_ozon.bat").read_text(encoding="utf-8"), "старый запускатель")

    def test_manual_update_refreshes_the_launcher_but_not_itself(self) -> None:
        self.updater.update(exclude=self.updater.SELF, quiet=True)
        self.assertEqual((self.root / "start_ozon.bat").read_text(encoding="utf-8"), "новый запускатель")
        self.assertEqual((self.root / "update_ozon.bat").read_text(encoding="utf-8"), "старый апдейтер")

    def test_second_run_changes_nothing(self) -> None:
        self.updater.update(exclude=self.updater.SELF, quiet=True)
        self.assertEqual(self.updater.update(exclude=self.updater.SELF, quiet=True), [])


class DiagnosticsTest(unittest.TestCase):
    """Самопроверка должна пережить любой ответ Ozon и всё показать."""

    def rows(self, request) -> list:
        from ozon.diagnostics import run_checks

        creds = Credentials(seller_client_id="id", seller_api_key="key")
        with mock.patch.object(SellerApi, "request", request):
            return run_checks(creds)

    def test_working_cabinet_is_all_green(self) -> None:
        rows = self.rows(FakeOzon())
        checks = [row for row in rows if row["метод"] != "—"]
        failed = [row for row in checks if row["результат"] == "ошибка"]
        # Часть методов подделка не знает — важно, что они помечены, а не роняют прогон.
        self.assertTrue(any(row["результат"] == "ок" for row in checks))
        self.assertTrue(all(row["подробности"] for row in failed))

    def test_broken_api_does_not_raise(self) -> None:
        def dead(self_, method, path, **kwargs):
            raise OzonApiError("сервис недоступен", status=503, path=path)

        rows = self.rows(dead)
        by_name = {row["проверка"]: row for row in rows}
        # Всё, что ходит в сеть, помечено ошибкой — и с объяснением.
        for name in ("Ключ принят", "Заявки на поставку", "Остатки", "Кластеры"):
            self.assertEqual(by_name[name]["результат"], "ошибка", name)
            self.assertIn("сервис недоступен", by_name[name]["подробности"])
        # А статусы есть и без счётчика: иначе фильтр заявок вообще не собрать.
        self.assertEqual(by_name["Статусы поставок"]["результат"], "ок")

    def test_version_is_reported_first(self) -> None:
        from ozon.version import VERSION

        rows = self.rows(FakeOzon())
        self.assertEqual(rows[0]["подробности"], VERSION)


class McpServerTest(unittest.TestCase):
    """Сервер для Claude должен собираться на любой версии пакета mcp."""

    def setUp(self) -> None:
        try:
            import mcp  # noqa: F401
        except ImportError:
            self.skipTest("пакет mcp не установлен")

    def test_tools_are_registered(self) -> None:
        from ozon import mcp_server

        tools = [name for name in dir(mcp_server) if name.startswith("ozon_")]
        self.assertIn("ozon_stocks", tools)
        self.assertIn("ozon_supply_orders", tools)
        self.assertIn("ozon_plan_supply", tools)
        self.assertGreaterEqual(len(tools), 15)

    def test_launcher_imports_the_server(self) -> None:
        source = Path("mcp_launch.py").read_text(encoding="utf-8")
        self.assertIn("from ozon.mcp_server import main", source)

    def test_read_tools_survive_a_dead_api(self) -> None:
        """Ошибка Ozon должна вернуться Claude текстом, а не уронить сервер."""
        from ozon import mcp_server

        def dead(self_, method, path, **kwargs):
            raise OzonApiError("сервис недоступен", status=503, path=path)

        with mock.patch.dict(os.environ, {"OZON_CLIENT_ID": "id", "OZON_API_KEY": "key"}):
            with mock.patch.object(SellerApi, "request", dead):
                result = mcp_server._safe(lambda: SellerApi().stocks())
        self.assertIn("сервис недоступен", result["error"])


class ClaudeSetupTest(unittest.TestCase):
    """Регистрация сервера в настройках приложения Claude."""

    def setUp(self) -> None:
        from ozon import claude_setup

        self.setup = claude_setup
        self.config = Path(tempfile.mkdtemp()) / "claude_desktop_config.json"

    def test_creates_config_from_scratch(self) -> None:
        self.setup.install(self.config)
        data = json.loads(self.config.read_text(encoding="utf-8"))
        self.assertIn("mcp_launch.py", data["mcpServers"]["ozon"]["args"][0])

    def test_other_servers_and_settings_survive(self) -> None:
        self.config.write_text(
            json.dumps({"mcpServers": {"чужой": {"command": "x"}}, "theme": "dark"}),
            encoding="utf-8",
        )
        self.setup.install(self.config)
        data = json.loads(self.config.read_text(encoding="utf-8"))
        self.assertIn("чужой", data["mcpServers"])
        self.assertEqual(data["theme"], "dark")

    def test_previous_config_is_backed_up(self) -> None:
        self.config.write_text(json.dumps({"theme": "dark"}), encoding="utf-8")
        self.setup.install(self.config)
        backup = self.config.with_suffix(".json.backup")
        self.assertEqual(json.loads(backup.read_text(encoding="utf-8")), {"theme": "dark"})

    def test_repeated_run_does_not_duplicate(self) -> None:
        self.setup.install(self.config)
        self.setup.install(self.config)
        data = json.loads(self.config.read_text(encoding="utf-8"))
        self.assertEqual(list(data["mcpServers"]), ["ozon"])

    def test_report_names_the_missing_entry(self) -> None:
        self.config.write_text(json.dumps({"mcpServers": {}}), encoding="utf-8")
        with mock.patch.object(self.setup, "config_candidates", lambda: [self.config]):
            lines = "\n".join(self.setup.report())
        self.assertIn("записи «ozon» НЕТ", lines)

    def test_report_notices_a_stale_path(self) -> None:
        """Папку могли перенести — тогда в настройках остаётся старый путь."""
        self.config.write_text(
            json.dumps({"mcpServers": {"ozon": {"command": "старый.exe", "args": ["старый.py"]}}}),
            encoding="utf-8",
        )
        with mock.patch.object(self.setup, "config_candidates", lambda: [self.config]):
            lines = "\n".join(self.setup.report())
        self.assertIn("пути отличаются", lines)

    def test_report_survives_a_broken_config(self) -> None:
        self.config.write_text("{это не json", encoding="utf-8")
        with mock.patch.object(self.setup, "config_candidates", lambda: [self.config]):
            lines = "\n".join(self.setup.report())
        self.assertIn("повреждён", lines)

    def test_broken_config_is_not_overwritten(self) -> None:
        self.config.write_text("{это не json", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            self.setup.install(self.config)
        self.assertEqual(self.config.read_text(encoding="utf-8"), "{это не json")


class ImportKeysTest(unittest.TestCase):
    """Разбор заметки с ключами: форматы у всех разные."""

    def parse(self, text: str) -> dict:
        from ozon.import_keys import parse

        return parse(text)

    def test_sections_separate_the_two_cabinets(self) -> None:
        keys = self.parse(
            "Seller API\n"
            "Client-Id: 1234567\n"
            "Api-Key: 8f2b1c9a-7d3e-4f10-9b2c-5a6d7e8f9012\n"
            "\n"
            "Performance API (реклама)\n"
            "Client ID: 55-175000-abc@advertising.performance.ozon.ru\n"
            "Client Secret: qZ7XmK0kL9vB2nT4wS6yH8jF\n"
        )
        self.assertEqual(keys["OZON_CLIENT_ID"], "1234567")
        self.assertEqual(keys["OZON_API_KEY"], "8f2b1c9a-7d3e-4f10-9b2c-5a6d7e8f9012")
        self.assertTrue(keys["OZON_PERF_CLIENT_ID"].endswith("ozon.ru"))
        self.assertEqual(keys["OZON_PERF_CLIENT_SECRET"], "qZ7XmK0kL9vB2nT4wS6yH8jF")

    def test_advertising_id_is_recognised_without_a_section(self) -> None:
        """Почтовый вид Client ID рекламы важнее любых заголовков."""
        keys = self.parse(
            "client_id=1234567\n"
            "api_key=8f2b1c9a-7d3e\n"
            "client_id=55-175000-abc@advertising.performance.ozon.ru\n"
            "client_secret=секретсекрет\n"
        )
        self.assertEqual(keys["OZON_CLIENT_ID"], "1234567")
        self.assertIn("@advertising", keys["OZON_PERF_CLIENT_ID"])

    def test_json_note_is_understood(self) -> None:
        keys = self.parse(
            '{\n  "client_id": "1234567",\n  "api_key": "8f2b1c9a",\n'
            '  "client_secret": "секрет"\n}\n'
        )
        self.assertEqual(keys["OZON_CLIENT_ID"], "1234567")
        self.assertEqual(keys["OZON_API_KEY"], "8f2b1c9a")

    def test_comments_and_empty_values_are_skipped(self) -> None:
        keys = self.parse("# заметка\nClient-Id:\nApi-Key: живой-ключ\n")
        self.assertEqual(keys, {"OZON_API_KEY": "живой-ключ"})

    def test_first_value_wins_over_later_duplicates(self) -> None:
        keys = self.parse("Api-Key: первый\nApi-Key: второй\n")
        self.assertEqual(keys["OZON_API_KEY"], "первый")

    def test_meaningless_file_is_reported(self) -> None:
        from ozon.import_keys import import_file

        path = Path(tempfile.mkdtemp()) / "keys.txt"
        path.write_text("просто заметка без ключей", encoding="utf-8")
        with self.assertRaises(ValueError):
            import_file(path)

    def test_missing_file_is_reported(self) -> None:
        from ozon.import_keys import import_file

        with self.assertRaises(FileNotFoundError):
            import_file(Path(tempfile.mkdtemp()) / "нет-такого.txt")

    def test_import_writes_env_and_returns_what_it_found(self) -> None:
        import ozon.config as config
        from ozon.import_keys import import_file

        folder = Path(tempfile.mkdtemp())
        note = folder / "keys.txt"
        note.write_text("Client-Id: 42\nApi-Key: ключ\n", encoding="utf-8")
        with mock.patch.object(config, "ENV_FILE", folder / ".env"):
            found = import_file(note)
            saved = config._read_env_file(folder / ".env")
        self.assertEqual(set(found), {"OZON_CLIENT_ID", "OZON_API_KEY"})
        self.assertEqual(saved["OZON_CLIENT_ID"], "42")


if __name__ == "__main__":
    unittest.main()
