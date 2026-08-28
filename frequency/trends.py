"""Google Trends без ключей — источник абсолютных оценок спроса.

Trends отдаёт не показы, а относительный индекс интереса (0..100). Чтобы
получить абсолютные цифры, запрос сравнивается в одном запросе к Trends с
опорным словом, месячная частотность которого известна: сколько раз опорное
слово ищут в месяц, знаем заранее, а отношение индексов даёт масштаб.

Публичные эндпоинты Trends не требуют ни токена, ни аккаунта — нужны только
куки, которые выдаёт первая же страница сайта.
"""
from __future__ import annotations

import json
import statistics
from typing import Optional

import requests

from .http import DEFAULT_HEADERS, SourceError

EXPLORE = "https://trends.google.com/trends/api/explore"
MULTILINE = "https://trends.google.com/trends/api/widgetdata/multiline"
HOMEPAGE = "https://trends.google.com/trends/?geo=RU"

TIMEFRAME = "today 12-m"
GEO = "RU"
TZ = "-180"
HL = "ru"

# Опорные запросы: месячная частотность в Яндексе (порядок величины по
# Вордстату, РФ). Список специально покрывает разные масштабы — код сам
# подбирает опору, сопоставимую с проверяемым запросом, иначе Trends
# округлит слабый запрос до нуля.
ANCHORS: list[tuple[str, int]] = [
    ("погода", 60_000_000),
    ("новости", 12_000_000),
    ("кроссовки", 3_000_000),
    ("наушники", 1_800_000),
    ("чехол для телефона", 400_000),
    ("ароматизатор в машину", 150_000),
    ("держатель для телефона в машину", 60_000),
    ("органайзер в багажник", 20_000),
]

# С какой опоры начинаем: середина списка даёт меньше всего итераций.
START_ANCHOR = 4


class TrendsUnavailable(SourceError):
    """Trends не ответил или ограничил частоту запросов."""


def _session() -> requests.Session:
    session = requests.Session()
    session.headers.update({**DEFAULT_HEADERS, "Referer": "https://trends.google.com/"})
    try:
        session.get(HOMEPAGE, timeout=15)
    except requests.RequestException as exc:
        raise TrendsUnavailable(f"Trends недоступен: {exc}") from exc
    return session


def _strip_prefix(text: str) -> dict:
    """Ответы Trends начинаются с антиспуфинг-префикса )]}',"""
    start = text.find("{")
    if start < 0:
        raise TrendsUnavailable("Trends вернул не JSON (вероятно, лимит запросов).")
    return json.loads(text[start:])


def _widget_token(session: requests.Session, keywords: list[str]) -> tuple[dict, str]:
    req = {
        "comparisonItem": [
            {"keyword": kw, "geo": GEO, "time": TIMEFRAME} for kw in keywords
        ],
        "category": 0,
        "property": "",
    }
    resp = session.get(
        EXPLORE,
        params={"hl": HL, "tz": TZ, "req": json.dumps(req, ensure_ascii=False)},
        timeout=20,
    )
    if resp.status_code == 429:
        raise TrendsUnavailable("Trends временно ограничил частоту запросов (429).")
    if resp.status_code >= 400:
        raise TrendsUnavailable(f"Trends: HTTP {resp.status_code}")
    for widget in _strip_prefix(resp.text).get("widgets", []):
        if widget.get("id") == "TIMESERIES":
            return widget["request"], widget["token"]
    raise TrendsUnavailable("Trends не отдал виджет с динамикой.")


def _series(session: requests.Session, keywords: list[str]) -> list[list[float]]:
    """Средний индекс интереса по каждому ключевому слову за 12 месяцев."""
    widget_req, token = _widget_token(session, keywords)
    resp = session.get(
        MULTILINE,
        params={
            "hl": HL,
            "tz": TZ,
            "req": json.dumps(widget_req, ensure_ascii=False),
            "token": token,
        },
        timeout=20,
    )
    if resp.status_code == 429:
        raise TrendsUnavailable("Trends временно ограничил частоту запросов (429).")
    if resp.status_code >= 400:
        raise TrendsUnavailable(f"Trends: HTTP {resp.status_code}")
    timeline = _strip_prefix(resp.text).get("default", {}).get("timelineData", [])
    if not timeline:
        raise TrendsUnavailable("Trends не вернул динамику по запросу.")
    columns: list[list[float]] = [[] for _ in keywords]
    for point in timeline:
        values = point.get("value") or []
        for i in range(len(keywords)):
            columns[i].append(float(values[i]) if i < len(values) else 0.0)
    return columns


class TrendsDemand:
    """Абсолютная оценка спроса по запросу, полученная без единого ключа."""

    def __init__(self, monthly: int, anchor: str, ratio: float, points: int):
        self.monthly = monthly
        self.anchor = anchor
        self.ratio = ratio
        self.points = points

    @property
    def note(self) -> str:
        return (
            f"Google Trends за 12 месяцев, калибровка по опорному запросу "
            f"«{self.anchor}» (отношение интереса {self.ratio:.3f})."
        )


def _measure(session: requests.Session, query: str, anchor_index: int) -> tuple[float, int]:
    anchor, _ = ANCHORS[anchor_index]
    query_series, anchor_series = _series(session, [query, anchor])
    query_mean = statistics.fmean(query_series) if query_series else 0.0
    anchor_mean = statistics.fmean(anchor_series) if anchor_series else 0.0
    if anchor_mean <= 0:
        raise TrendsUnavailable("Опорный запрос не дал сигнала в Trends.")
    return query_mean / anchor_mean, len(query_series)


def demand(query: str, session: Optional[requests.Session] = None) -> TrendsDemand:
    """Оценить, сколько раз в месяц ищут запрос в России.

    Подбор опоры: если запрос на порядок слабее или сильнее опорного слова,
    Trends огрубляет шкалу, поэтому переходим к более близкой опоре и меряем ещё раз.
    """
    session = session or _session()
    index = START_ANCHOR
    seen: set[int] = set()
    last_error: Optional[Exception] = None

    for _ in range(3):
        if index in seen:
            break
        seen.add(index)
        try:
            ratio, points = _measure(session, query, index)
        except TrendsUnavailable as exc:
            last_error = exc
            break

        anchor, anchor_volume = ANCHORS[index]
        # Слишком слабый сигнал — берём опору поменьше, слишком сильный — побольше.
        if ratio < 0.02 and index + 1 < len(ANCHORS):
            index += 1
            continue
        if ratio > 20 and index - 1 >= 0:
            index -= 1
            continue

        monthly = ratio * anchor_volume
        if monthly <= 0:
            raise TrendsUnavailable("Слишком редкий запрос: Trends показывает нулевой интерес.")
        rounded = int(round(monthly, -2)) if monthly >= 1000 else int(round(monthly, -1))
        return TrendsDemand(max(rounded, 10), anchor, ratio, points)

    if last_error:
        raise TrendsUnavailable(str(last_error))
    raise TrendsUnavailable("Не удалось подобрать опорный запрос для калибровки.")
