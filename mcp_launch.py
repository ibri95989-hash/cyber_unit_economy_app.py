"""Запуск MCP-сервера Ozon для Claude.

Отдельный файл в корне проекта: Python сам добавляет папку скрипта в пути
импорта, поэтому сервер стартует из любой рабочей директории — а Claude
запускает его из своей.
"""
from __future__ import annotations

import sys

from ozon.mcp_server import main

if __name__ == "__main__":
    main(sys.argv[1:])
