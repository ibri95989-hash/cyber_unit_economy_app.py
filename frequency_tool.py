"""Инструмент «частотность запроса» для Telegram-бота.

Обёртка над frequency.collect: превращает результаты источников в короткий
текст, который читает модель. Числа берутся из тех же расчётов, что и в
приложении, поэтому бот и интерфейс отвечают одинаково.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Optional

from frequency import Status, collect
from frequency.http import configure as configure_network

log = logging.getLogger(__name__)

# Сколько держим ответ по запросу: частотность не меняется от минуты к минуте,
# а поход по четырём источникам занимает секунды и лимитируется Trends.
CACHE_TTL = 3600

MAX_RELATED = 8

TOOL = {
    "name": "search_frequency",
    "description": (
        "Сколько раз в месяц ищут заданную фразу на Wildberries, Ozon, в Яндексе "
        "и Google. Вызывай, когда спрашивают про спрос, частотность, объём поиска, "
        "популярность товара или ниши — цифры из головы называть нельзя. "
        "Запрос передавай так, как его вводят покупатели: «ароматизатор в машину», "
        "а не «спрос на ароматизаторы». Для сравнения нескольких товаров вызывай "
        "инструмент отдельно на каждый."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Поисковая фраза, например «магнитный держатель для телефона».",
            }
        },
        "required": ["query"],
        "additionalProperties": False,
    },
    "strict": True,
}

_lock = threading.Lock()
_cache: dict[str, tuple[float, str]] = {}


def configure(proxy: Optional[str] = None) -> None:
    """Отправить источники частотности через тот же прокси, что и бот."""
    configure_network(proxy)


def _fmt(value: Optional[int]) -> str:
    if value is None:
        return "нет данных"
    return f"{value:,}".replace(",", " ")


def _describe(query: str) -> str:
    results = collect(query)
    if not results:
        return "Пустой запрос, измерять нечего."

    lines = [f"Частотность по запросу «{query}» (показов в месяц):"]
    for res in results:
        detail = res.detail.strip()
        if len(detail) > 180:
            detail = detail[:177] + "…"
        line = f"- {res.source}: {_fmt(res.monthly)} — {res.label}"
        if detail:
            line += f" ({detail})"
        lines.append(line)

    total = sum(res.monthly for res in results if res.is_number)
    if total:
        lines.append(f"Суммарно по ответившим источникам: {_fmt(total)}.")

    if not any(res.is_number for res in results):
        lines.append(
            "Ни один источник не ответил — цифр по этому запросу сейчас нет. "
            "Скажи об этом собеседнику и предложи повторить через минуту; "
            "своих чисел не придумывай."
        )
        return "\n".join(lines)

    exact = [res.source for res in results if res.status is Status.EXACT]
    if exact:
        lines.append("Точные данные API: " + ", ".join(exact) + "; остальное — оценка.")
    else:
        lines.append("Все цифры — оценка по открытым данным, а не выгрузка из API площадок.")

    for res in results:
        if res.related:
            phrases = ", ".join(
                f"{phrase} ({_fmt(count)})" if count else phrase
                for phrase, count in res.related[:MAX_RELATED]
            )
            lines.append(f"Похожие запросы ({res.source}): {phrases}")

    return "\n".join(lines)


def run(query: str) -> str:
    """Текст с частотностью для модели. Ошибки тоже возвращаем текстом."""
    query = (query or "").strip()
    if not query:
        return "Не указана фраза для замера — переспроси, что именно измерить."

    key = query.lower()
    now = time.time()
    with _lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < CACHE_TTL:
            return cached[1]

    try:
        text = _describe(query)
    except Exception as exc:  # noqa: BLE001 - модель должна узнать о сбое, а не молчать
        log.warning("Частотность по «%s» не собралась: %s", query, exc)
        return (
            "Источники частотности сейчас недоступны с этого сервера "
            f"({type(exc).__name__}). Скажи об этом собеседнику и не выдумывай цифры."
        )

    with _lock:
        _cache[key] = (now, text)
    return text
