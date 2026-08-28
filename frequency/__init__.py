"""Агрегатор частотности поисковых запросов по WB, Ozon, Яндексу и Google."""
from .models import SourceResult, Status
from .aggregator import collect

__all__ = ["SourceResult", "Status", "collect"]
