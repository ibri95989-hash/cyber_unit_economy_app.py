"""Прописать MCP-сервер Ozon в настройки приложения Claude.

Запасной путь на случай, когда командной строки Claude Code на компьютере нет,
а приложение есть: у него свой файл настроек, куда сервер можно добавить
напрямую. Чужие серверы в файле не трогаются, старый файл сохраняется рядом.
"""
from __future__ import annotations

import json
import os
import platform
import shutil
import sys
from pathlib import Path
from typing import List, Optional

ROOT = Path(__file__).resolve().parent.parent
SERVER_NAME = "ozon"


def config_candidates() -> List[Path]:
    """Где приложение Claude хранит настройки на разных системах."""
    system = platform.system()
    if system == "Windows":
        appdata = os.environ.get("APPDATA")
        return [Path(appdata) / "Claude" / "claude_desktop_config.json"] if appdata else []
    if system == "Darwin":
        return [Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"]
    return [Path.home() / ".config" / "Claude" / "claude_desktop_config.json"]


def python_path() -> Path:
    """Питон из окружения панели: в нём стоят зависимости сервера."""
    windows = ROOT / ".venv" / "Scripts" / "python.exe"
    unix = ROOT / ".venv" / "bin" / "python"
    if windows.exists():
        return windows
    if unix.exists():
        return unix
    return Path(sys.executable)


def server_entry() -> dict:
    return {"command": str(python_path()), "args": [str(ROOT / "mcp_launch.py")]}


def install(config_path: Optional[Path] = None) -> Path:
    """Добавить сервер в настройки Claude. Возвращает изменённый файл."""
    if config_path is None:
        candidates = config_candidates()
        if not candidates:
            raise RuntimeError("Не удалось определить, где лежат настройки Claude.")
        config_path = candidates[0]

    data: dict = {}
    if config_path.exists():
        try:
            data = json.loads(config_path.read_text(encoding="utf-8")) or {}
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Файл настроек Claude повреждён ({exc}). Откройте его и проверьте: {config_path}"
            ) from exc
        # Копия рядом: настройки чужие, ошибиться в них нельзя.
        shutil.copy2(config_path, config_path.with_suffix(".json.backup"))

    servers = data.setdefault("mcpServers", {})
    if not isinstance(servers, dict):
        raise RuntimeError("В настройках Claude раздел mcpServers имеет неожиданный вид.")
    servers[SERVER_NAME] = server_entry()

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return config_path


def main(argv: Optional[List[str]] = None) -> int:
    try:
        path = install()
    except Exception as exc:  # noqa: BLE001 - пользователю нужен текст, а не трейсбек
        print(f"  [!] {exc}")
        return 1
    print(f"  Сервер добавлен в настройки Claude: {path}")
    print(f"  Запуск: {python_path()}")
    print("  Перезапустите приложение Claude, чтобы оно увидело сервер.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
