"""Ошибки интеграции."""
from __future__ import annotations

from typing import Any, List, Optional, Tuple


class OzonApiError(RuntimeError):
    """Ozon ответил ошибкой или неожиданным форматом."""

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        path: str = "",
        payload: Any = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.path = path
        self.payload = payload
        # Если до ответа было несколько попыток с разной формой запроса —
        # здесь лежат все: (путь, код, что ответил Ozon).
        self.attempts: List[Tuple[str, Optional[int], str]] = []


class OzonAuthError(OzonApiError):
    """Ключей нет, они истекли или у них не хватает прав."""


class OzonWriteBlocked(RuntimeError):
    """Изменяющий вызов не разрешён: сухой прогон или превышен лимит."""
