"""Предохранитель для изменяющих вызовов.

Правило простое: чтение доступно всегда, запись — только когда владелец кабинета
явно разрешил её переменной окружения, и только в пределах заданных лимитов.
Каждая попытка записи пишется в журнал ozon_audit.jsonl.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Set

from .errors import OzonWriteBlocked

ROOT = Path(__file__).resolve().parent.parent
AUDIT_FILE = Path(os.environ.get("OZON_AUDIT_FILE") or ROOT / "ozon_audit.jsonl")

TRUE = {"1", "true", "yes", "on", "да"}

# Действия, которые нельзя отменить кнопкой «назад» или которые стоят денег.
# Для них мало разрешения на запись — нужно ещё явное подтверждение вызова.
CONFIRM_REQUIRED = {
    "supply.create",
    "supply.cancel",
    "supply.timeslot_update",
    "ads.set_daily_budget",
}


def _flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in TRUE


def _number(name: str, default: Optional[float]) -> Optional[float]:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass
class WriteGuard:
    """Разрешение на запись плюс потолки, выше которых вызов не пройдёт.

    writes_allowed — OZON_ALLOW_WRITES=1 в окружении;
    max_bid        — максимальная ставка в рублях (OZON_MAX_BID);
    max_change_pct — насколько сильно за раз можно двинуть ставку (OZON_MAX_BID_CHANGE_PCT);
    max_daily_budget — потолок дневного бюджета кампании (OZON_MAX_DAILY_BUDGET).
    """

    writes_allowed: bool = False
    max_bid: Optional[float] = None
    max_change_pct: Optional[float] = None
    max_daily_budget: Optional[float] = None
    confirm_required: Set[str] = field(default_factory=lambda: set(CONFIRM_REQUIRED))

    @classmethod
    def from_env(cls) -> "WriteGuard":
        raw = os.environ.get("OZON_CONFIRM_ACTIONS")
        confirm = (
            {item.strip() for item in raw.split(",") if item.strip()}
            if raw is not None
            else set(CONFIRM_REQUIRED)
        )
        return cls(
            writes_allowed=_flag("OZON_ALLOW_WRITES"),
            max_bid=_number("OZON_MAX_BID", 500.0),
            max_change_pct=_number("OZON_MAX_BID_CHANGE_PCT", 50.0),
            max_daily_budget=_number("OZON_MAX_DAILY_BUDGET", None),
            confirm_required=confirm,
        )

    def check(
        self,
        action: str,
        details: Dict[str, Any],
        *,
        apply: bool,
        confirm: bool = False,
    ) -> None:
        """Пропустить изменение или объяснить, почему нет.

        apply=False — сухой прогон: вызов не уйдёт в Ozon, но попадёт в журнал.
        confirm — отдельное «да» для необратимых действий из confirm_required.
        """
        self.audit(action, details, applied=False, note="dry-run" if not apply else "requested")
        if not apply:
            raise OzonWriteBlocked(
                f"Сухой прогон: {action} не отправлен — так и задумано, пока изменение не подтверждено."
            )
        if not self.writes_allowed:
            raise OzonWriteBlocked(
                f"Запись запрещена: {action}. Включите тумблер «Разрешить менять кабинет» "
                "в панели или задайте OZON_ALLOW_WRITES=1 в окружении."
            )

        if action in self.confirm_required and not confirm:
            raise OzonWriteBlocked(
                f"«{action}» отменить нельзя, поэтому нужно отдельное подтверждение. "
                "Проверьте параметры и повторите с confirm=true."
            )

        bid = details.get("bid")
        if self.max_bid is not None and isinstance(bid, (int, float)) and bid > self.max_bid:
            raise OzonWriteBlocked(
                f"Ставка {bid} превышает потолок OZON_MAX_BID={self.max_bid:g}."
            )

        old = details.get("previous_bid")
        if (
            self.max_change_pct is not None
            and isinstance(bid, (int, float))
            and isinstance(old, (int, float))
            and old > 0
        ):
            change = abs(bid - old) / old * 100
            if change > self.max_change_pct:
                raise OzonWriteBlocked(
                    f"Ставка меняется на {change:.0f}% (с {old:g} на {bid:g}), "
                    f"а лимит OZON_MAX_BID_CHANGE_PCT={self.max_change_pct:g}%."
                )

        budget = details.get("daily_budget")
        if (
            self.max_daily_budget is not None
            and isinstance(budget, (int, float))
            and budget > self.max_daily_budget
        ):
            raise OzonWriteBlocked(
                f"Дневной бюджет {budget} выше потолка OZON_MAX_DAILY_BUDGET={self.max_daily_budget:g}."
            )

    def audit(self, action: str, details: Dict[str, Any], *, applied: bool, note: str = "") -> None:
        """Дописать строку в журнал изменений."""
        record = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "action": action,
            "applied": applied,
            "note": note,
            "details": details,
        }
        try:
            with AUDIT_FILE.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError:  # noqa: PERF203 - журнал не должен ронять работу
            pass
