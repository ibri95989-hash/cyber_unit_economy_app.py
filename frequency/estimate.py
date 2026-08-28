"""Модель оценки частотности там, где официальный API недоступен.

Все коэффициенты собраны здесь, чтобы их можно было откалибровать под свою нишу:
если у вас есть реальные цифры хотя бы по десятку запросов, поправьте константы
ниже — оценки по всем остальным запросам сместятся вместе с ними.
"""
from __future__ import annotations

import math
from typing import Optional

# Сколько показов в месяц даёт один товар в выдаче маркетплейса.
# Оценка построена на степенной зависимости: спрос растёт медленнее, чем
# количество товаров, которое продавцы завели под запрос.
MARKETPLACE_ANCHOR = {
    # источник: (множитель, степень)
    "Wildberries": (46.0, 0.78),
    "Ozon": (21.0, 0.76),
}

# Доля рынка поиска в РФ: Google к Яндексу по коммерческим запросам.
GOOGLE_TO_YANDEX = 0.55

# Какая часть поискового спроса из веба доходит до поиска маркетплейса.
# По товарным запросам на WB ищут заметно чаще, чем на Ozon.
MARKETPLACE_SHARE_OF_DEMAND = {
    "Wildberries": 0.85,
    "Ozon": 0.45,
}

# Поправка на длину запроса: у длинного хвоста товаров много, спроса мало.
def _length_factor(query: str) -> float:
    words = max(1, len(query.split()))
    return 1.0 / (1.0 + 0.18 * (words - 1))


def from_product_count(source: str, query: str, products: int) -> Optional[int]:
    """Оценить месячную частотность по числу товаров в выдаче маркетплейса."""
    if products is None or products <= 0:
        return None
    mult, power = MARKETPLACE_ANCHOR.get(source, (25.0, 0.75))
    raw = mult * math.pow(products, power) * _length_factor(query)
    return int(round(raw, -2)) if raw >= 1000 else int(round(raw, -1))


def google_from_yandex(yandex_monthly: Optional[int]) -> Optional[int]:
    """Google в РФ обычно даёт долю от вордстата — считаем от неё."""
    if not yandex_monthly:
        return None
    value = yandex_monthly * GOOGLE_TO_YANDEX
    return int(round(value, -2)) if value >= 1000 else int(round(value, -1))


def from_web_demand(source: str, web_monthly: Optional[int]) -> Optional[int]:
    """Оценить спрос внутри маркетплейса от общего поискового спроса в вебе."""
    if not web_monthly:
        return None
    share = MARKETPLACE_SHARE_OF_DEMAND.get(source, 0.5)
    value = web_monthly * share
    return int(round(value, -2)) if value >= 1000 else int(round(value, -1))


def blend(*values: Optional[int]) -> Optional[int]:
    """Свести несколько независимых оценок в одну (среднее геометрическое).

    Среднее геометрическое, а не арифметическое: оценки живут в разных
    порядках величины, и одна завышенная не должна тянуть результат за собой.
    """
    points = [float(v) for v in values if v]
    if not points:
        return None
    result = math.exp(sum(math.log(v) for v in points) / len(points))
    return int(round(result, -2)) if result >= 1000 else int(round(result, -1))
