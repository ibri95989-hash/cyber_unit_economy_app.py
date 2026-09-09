"""Откуда берутся ключи Ozon.

Порядок поиска — от самого явного к самому удобному:

1. переменные окружения процесса;
2. файл ``.env`` в корне репозитория (в git не попадает, см. .gitignore);
3. ``st.secrets`` — если код запущен внутри Streamlit.

Ключи не печатаются целиком нигде: для показа есть mask().
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"

# Имя переменной -> ключ в st.secrets (там принято нижнее подчёркивание).
KEYS = {
    "OZON_CLIENT_ID": "ozon_client_id",
    "OZON_API_KEY": "ozon_api_key",
    "OZON_PERF_CLIENT_ID": "ozon_perf_client_id",
    "OZON_PERF_CLIENT_SECRET": "ozon_perf_client_secret",
}


def mask(value: Optional[str]) -> str:
    """Ключ в виде, который не страшно показать в логе или в чате."""
    if not value:
        return "—"
    value = value.strip()
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}…{value[-4:]} ({len(value)} симв.)"


def _read_env_file(path: Optional[Path] = None) -> Dict[str, str]:
    """Простейший разбор .env: KEY=value, кавычки и комментарии игнорируются."""
    path = path or ENV_FILE
    if not path.exists():
        return {}
    out: Dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, raw = line.partition("=")
        value = raw.strip().strip('"').strip("'")
        if value:
            out[key.strip()] = value
    return out


def _read_streamlit_secrets() -> Dict[str, str]:
    try:
        import streamlit as st  # noqa: PLC0415 - опциональная зависимость
    except Exception:  # noqa: BLE001 - вне Streamlit это норма
        return {}
    out: Dict[str, str] = {}
    for env_name, secret_name in KEYS.items():
        try:
            value = st.secrets[secret_name]  # type: ignore[index]
        except Exception:  # noqa: BLE001 - секрета просто нет
            continue
        if value:
            out[env_name] = str(value)
    return out


def value(name: str) -> Optional[str]:
    """Значение одной настройки по всем источникам."""
    found = os.environ.get(name) or _read_env_file().get(name) or _read_streamlit_secrets().get(name)
    return found.strip() if isinstance(found, str) and found.strip() else None


@dataclass(frozen=True)
class Credentials:
    """Пара ключей Seller API и пара ключей Performance API."""

    seller_client_id: Optional[str] = None
    seller_api_key: Optional[str] = None
    perf_client_id: Optional[str] = None
    perf_client_secret: Optional[str] = None

    @property
    def has_seller(self) -> bool:
        return bool(self.seller_client_id and self.seller_api_key)

    @property
    def has_performance(self) -> bool:
        return bool(self.perf_client_id and self.perf_client_secret)

    def report(self) -> str:
        """Что именно нашлось — без раскрытия самих ключей."""
        lines = [
            f"Seller API      Client-Id: {mask(self.seller_client_id)}",
            f"Seller API      Api-Key:   {mask(self.seller_api_key)}",
            f"Performance API Client-Id: {mask(self.perf_client_id)}",
            f"Performance API Secret:    {mask(self.perf_client_secret)}",
        ]
        return "\n".join(lines)


def save_env(values: Dict[str, str], path: Optional[Path] = None) -> Path:
    """Записать ключи в .env, сохранив остальные строки файла.

    Файл создаётся с правами 600 — читать его сможет только владелец. Пустые
    значения не затирают то, что уже сохранено: так форма не требует вводить
    все четыре ключа заново ради правки одного.
    """
    path = path or ENV_FILE
    existing: Dict[str, str] = {}
    order: list[str] = []
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, _, raw = line.partition("=")
                key = key.strip()
                if key not in existing:
                    order.append(key)
                existing[key] = raw.strip()

    for key, value in values.items():
        value = (value or "").strip()
        if not value:
            continue
        if key not in existing:
            order.append(key)
        existing[key] = value

    body = "\n".join(f"{key}={existing[key]}" for key in order)
    path.write_text(
        "# Ключи Ozon. Файл не попадает в git и никуда не отправляется.\n" + body + "\n",
        encoding="utf-8",
    )
    try:
        path.chmod(0o600)
    except OSError:  # noqa: PERF203 - на Windows прав может не быть
        pass
    return path


def load_credentials() -> Credentials:
    """Собрать ключи из окружения, .env и секретов Streamlit."""
    return Credentials(
        seller_client_id=value("OZON_CLIENT_ID"),
        seller_api_key=value("OZON_API_KEY"),
        perf_client_id=value("OZON_PERF_CLIENT_ID"),
        perf_client_secret=value("OZON_PERF_CLIENT_SECRET"),
    )
