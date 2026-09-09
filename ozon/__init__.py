"""Интеграция с Ozon: Seller API (товары, остатки, поставки) и Performance API (реклама).

Ключи никогда не хранятся в коде — только в окружении или в .env (см. config.py).
Все изменяющие вызовы проходят через safety.WriteGuard: по умолчанию сухой прогон.
"""
from __future__ import annotations

from .config import Credentials, load_credentials
from .errors import OzonApiError, OzonAuthError, OzonWriteBlocked
from .performance import PerformanceApi
from .seller import SellerApi

__all__ = [
    "Credentials",
    "load_credentials",
    "OzonApiError",
    "OzonAuthError",
    "OzonWriteBlocked",
    "PerformanceApi",
    "SellerApi",
]
