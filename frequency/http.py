"""Сетевой слой: единые таймауты, ретраи, заголовки браузера и прокси.

Прокси задаётся один раз через configure() и после этого используется всеми
источниками — и теми, что ходят через request_json(), и теми, что берут
готовую сессию через session().
"""
from __future__ import annotations

import os
import threading
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

# Куда стучимся, когда проверяем прокси: лёгкая страница, отвечает всем.
PROBE_URL = "https://trends.google.com/trends/?geo=RU"

_lock = threading.Lock()
_proxy: Optional[str] = None
_trust_env: bool = True


class SourceError(RuntimeError):
    """Источник недоступен или ответил неожиданным форматом."""


def configure(proxy: Optional[str] = None, trust_env: bool = True) -> None:
    """Задать прокси для всех источников.

    proxy — строка вида ``http://host:port``, ``http://user:pass@host:port``
    или ``socks5://user:pass@host:port`` (для SOCKS нужен пакет PySocks).
    Пустое значение убирает явный прокси; trust_env=False дополнительно
    запрещает подхватывать HTTP_PROXY/HTTPS_PROXY из окружения.
    """
    global _proxy, _trust_env
    with _lock:
        _proxy = (proxy or "").strip() or None
        _trust_env = trust_env


def current_proxy() -> Optional[str]:
    """Прокси, который сейчас используется: явный либо из окружения."""
    if _proxy:
        return _proxy
    if _trust_env:
        return os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    return None


def proxies() -> Optional[dict]:
    if not _proxy:
        return None
    return {"http": _proxy, "https": _proxy}


def session() -> requests.Session:
    """Новая сессия с общими заголовками и настроенным прокси."""
    sess = requests.Session()
    sess.headers.update(DEFAULT_HEADERS)
    sess.trust_env = _trust_env
    mapping = proxies()
    if mapping:
        sess.proxies.update(mapping)
    return sess


def check_connection(url: str = PROBE_URL) -> tuple[bool, str]:
    """Проверить, что через текущие настройки есть выход в интернет."""
    where = current_proxy() or "напрямую, без прокси"
    try:
        resp = session().get(url, timeout=TIMEOUT)
    except requests.exceptions.ProxyError as exc:
        return False, f"Прокси не пропускает запрос ({where}): {exc}"
    except requests.RequestException as exc:
        return False, f"Нет соединения ({where}): {exc}"
    if resp.status_code >= 400:
        return False, f"Соединение есть ({where}), но сайт ответил HTTP {resp.status_code}."
    return True, f"Соединение работает ({where}), ответ HTTP {resp.status_code}."


def request_json(
    method: str,
    url: str,
    *,
    headers: Optional[dict] = None,
    params: Optional[dict] = None,
    json_body: Any = None,
    attempts: int = 3,
) -> Any:
    sess = session()
    if headers:
        sess.headers.update(headers)

    last: Optional[Exception] = None
    for i in range(attempts):
        try:
            resp = sess.request(
                method,
                url,
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
