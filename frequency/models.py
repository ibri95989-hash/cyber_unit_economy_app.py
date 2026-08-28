"""Общие структуры данных для всех источников частотности."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Status(str, Enum):
    """Насколько можно доверять числу, которое вернул источник."""

    EXACT = "exact"          # официальный API, реальная частотность
    ESTIMATE = "estimate"    # оценка по косвенным публичным сигналам
    NO_KEY = "no_key"        # источник требует ключ/токен, его нет
    ERROR = "error"          # источник ответил ошибкой


@dataclass
class SourceResult:
    """Результат одного источника по одному запросу."""

    source: str
    query: str
    status: Status
    monthly: Optional[int] = None
    detail: str = ""
    related: list[tuple[str, Optional[int]]] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    @property
    def is_number(self) -> bool:
        return self.monthly is not None

    @property
    def label(self) -> str:
        return {
            Status.EXACT: "точные данные API",
            Status.ESTIMATE: "оценка",
            Status.NO_KEY: "нужен ключ",
            Status.ERROR: "ошибка источника",
        }[self.status]
