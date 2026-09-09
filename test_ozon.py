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


if __name__ == "__main__":
    unittest.main()
