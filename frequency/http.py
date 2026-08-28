"""Тонкая обёртка над requests: единые таймауты, ретраи и заголовки браузера."""
from __future__ import annotations

import time
from typing import Any, Optional

import requests

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9",
}

TIMEOUT = 15


class SourceError(RuntimeError):
    """Источник недоступен или ответил неожиданным форматом."""


def request_json(
    method: str,
    url: str,
    *,
    headers: Optional[dict] = None,
    params: Optional[dict] = None,
    json_body: Any = None,
    attempts: int = 3,
) -> Any:
    merged = dict(DEFAULT_HEADERS)
    if headers:
        merged.update(headers)

    last: Optional[Exception] = None
    for i in range(attempts):
        try:
            resp = requests.request(
                method,
                url,
                headers=merged,
                params=params,
                json=json_body,
                timeout=TIMEOUT,
            )
            if resp.status_code >= 400:
                raise SourceError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            return resp.json()
        except Exception as exc:  # noqa: BLE001 - наверх отдаём один тип ошибки
            last = exc
            if i < attempts - 1:
                time.sleep(2 ** i)
    raise SourceError(str(last))


def get_json(url: str, **kwargs: Any) -> Any:
    return request_json("GET", url, **kwargs)


def post_json(url: str, **kwargs: Any) -> Any:
    return request_json("POST", url, **kwargs)
