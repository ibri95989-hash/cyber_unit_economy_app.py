"""Транспорт: единые таймауты, ретраи, разбор ошибок Ozon.

Оба API (Seller и Performance) отличаются только авторизацией и хостом,
поэтому вся сетевая рутина живёт здесь.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Mapping, Optional

import requests

from .errors import OzonApiError, OzonAuthError

log = logging.getLogger("ozon")

TIMEOUT = 30
RETRIES = 3
BACKOFF = 2.0
RETRY_ON = {429, 500, 502, 503, 504}


def _error_text(payload: Any, fallback: str) -> str:
    """Достать человекочитаемое сообщение из ответа Ozon."""
    if isinstance(payload, dict):
        for key in ("message", "error", "error_description", "details"):
            found = payload.get(key)
            if isinstance(found, str) and found:
                return found
            if isinstance(found, list) and found:
                return json.dumps(found, ensure_ascii=False)[:500]
    if isinstance(payload, str) and payload:
        return payload[:500]
    return fallback


class ApiClient:
    """Базовый клиент: знает хост, добавляет заголовки, повторяет временные ошибки."""

    base_url = ""

    def __init__(self, *, timeout: int = TIMEOUT, session: Optional[requests.Session] = None) -> None:
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers.update({"Content-Type": "application/json", "Accept": "application/json"})

    # Наследники добавляют сюда авторизацию.
    def auth_headers(self) -> Dict[str, str]:
        return {}

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[Mapping[str, Any]] = None,
        params: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        """Вызов метода API. Возвращает разобранный JSON, кидает OzonApiError."""
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        merged = {**self.auth_headers(), **(headers or {})}
        last: Optional[Exception] = None

        for attempt in range(RETRIES):
            if attempt:
                time.sleep(BACKOFF ** attempt)
            try:
                response = self.session.request(
                    method.upper(),
                    url,
                    json=dict(body) if body is not None else None,
                    params=dict(params) if params else None,
                    headers=merged,
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                last = exc
                log.warning("%s %s: сеть недоступна (%s), попытка %s", method, path, exc, attempt + 1)
                continue

            if response.status_code in RETRY_ON and attempt < RETRIES - 1:
                wait = response.headers.get("Retry-After")
                log.warning("%s %s: %s, повтор через %s", method, path, response.status_code, wait or "backoff")
                if wait and wait.isdigit():
                    time.sleep(int(wait))
                continue

            try:
                payload: Any = response.json() if response.content else {}
            except ValueError:
                payload = response.text

            if response.status_code in (401, 403):
                raise OzonAuthError(
                    _error_text(payload, "Ozon отклонил ключи — проверьте права ключа и кабинет."),
                    status=response.status_code,
                    path=path,
                    payload=payload,
                )
            if response.status_code >= 400:
                raise OzonApiError(
                    _error_text(payload, f"HTTP {response.status_code}"),
                    status=response.status_code,
                    path=path,
                    payload=payload,
                )
            return payload

        raise OzonApiError(f"{method} {path}: не удалось достучаться до Ozon ({last})", path=path)

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        return self.request("POST", path, **kwargs)

    def try_versions(self, method: str, paths: list[str], **kwargs: Any) -> Any:
        """Пройти по вариантам пути и вернуть ответ первого живого.

        Ozon регулярно выключает старые версии методов (v1 → v2 → v3), поэтому
        сначала пробуем свежую, а на 404/410 откатываемся на предыдущую.
        """
        last: Optional[OzonApiError] = None
        for path in paths:
            try:
                return self.request(method, path, **kwargs)
            except OzonAuthError:
                raise
            except OzonApiError as exc:
                if exc.status not in (404, 410):
                    raise
                last = exc
        raise last or OzonApiError("Ни одна версия метода не ответила: " + ", ".join(paths))
