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


def read_config_text(path: Path) -> str:
    """Прочитать файл настроек, что бы в нём ни лежало.

    Встречается всякое: нулевые байты после аварийного завершения Windows,
    UTF-16 вместо UTF-8, метка порядка байтов в начале. Всё это не поломка
    настроек, а особенность записи, и разбирать её должны мы, а не человек.
    Возвращается осмысленный текст; пустая строка означает «содержимого нет».
    """
    raw = path.read_bytes()
    for bom, encoding in ((b"\xff\xfe", "utf-16-le"), (b"\xfe\xff", "utf-16-be")):
        if raw.startswith(bom):
            text = raw[len(bom):].decode(encoding, errors="replace")
            break
    else:
        text = raw.decode("utf-8-sig", errors="replace")

    return text.replace("\x00", "").replace("\ufffd", "").strip().lstrip("\ufeff")


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


def install(config_path: Optional[Path] = None, *, force: bool = False) -> Path:
    """Добавить сервер в настройки Claude. Возвращает изменённый файл."""
    if config_path is None:
        candidates = config_candidates()
        if not candidates:
            raise RuntimeError("Не удалось определить, где лежат настройки Claude.")
        config_path = candidates[0]

    data: dict = {}
    if config_path.exists():
        # Копия рядом: настройки чужие, ошибиться в них нельзя.
        shutil.copy2(config_path, config_path.with_suffix(".json.backup"))
        text = read_config_text(config_path)
        if not text:
            # Пустой файл — не поломка: приложение так и оставляет его до
            # первой настройки. Терять там нечего, пишем с нуля.
            data = {}
        else:
            try:
                data = json.loads(text) or {}
            except json.JSONDecodeError as exc:
                if not force:
                    raise RuntimeError(
                        f"Файл настроек Claude не разбирается ({exc}): {config_path}. "
                        "Копия сохранена рядом с расширением .backup. Чтобы переписать "
                        "файл начисто, запустите с ключом --force."
                    ) from exc
                data = {}

    servers = data.setdefault("mcpServers", {})
    if not isinstance(servers, dict):
        raise RuntimeError("В настройках Claude раздел mcpServers имеет неожиданный вид.")
    servers[SERVER_NAME] = server_entry()

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return config_path


def report() -> List[str]:
    """Почему Claude не видит инструменты: проверяем всю цепочку по шагам."""
    import subprocess

    lines: List[str] = []
    launcher = ROOT / "mcp_launch.py"
    python = python_path()

    lines.append(f"Папка проекта:   {ROOT}")
    lines.append(f"Python сервера:  {python} — {'есть' if python.exists() else 'НЕ НАЙДЕН'}")
    lines.append(f"Файл запуска:    {launcher} — {'есть' if launcher.exists() else 'НЕ НАЙДЕН'}")

    # 1. Что записано в настройках приложения.
    for path in config_candidates():
        if not path.exists():
            lines.append(f"Настройки Claude: {path} — файла нет")
            continue
        text = read_config_text(path)
        if not text:
            size = path.stat().st_size
            lines.append(
                f"Настройки Claude: {path} — файл ПУСТОЙ"
                + (f" ({size} байт, но внутри только нули)" if size else " (0 байт)")
            )
            lines.append("  Запустите setup_claude.bat — он заполнит его.")
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            lines.append(f"Настройки Claude: {path} — файл не разбирается ({exc})")
            lines.append("  Переписать начисто: python -m ozon.claude_setup --force")
            continue
        entry = (data.get("mcpServers") or {}).get(SERVER_NAME)
        if not entry:
            lines.append(f"Настройки Claude: {path} — записи «{SERVER_NAME}» НЕТ")
        else:
            same = entry == server_entry()
            lines.append(
                f"Настройки Claude: {path} — запись есть"
                + ("" if same else " (но пути отличаются от текущей папки!)")
            )
            lines.append(f"  команда: {entry.get('command')}")
            lines.append(f"  аргумент: {(entry.get('args') or [''])[0]}")

    # 2. Может ли этот питон вообще запустить сервер.
    if python.exists() and launcher.exists():
        probe = subprocess.run(
            [str(python), "-c", "import mcp; from ozon.mcp_server import server; print('OK')"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )
        if probe.returncode == 0 and "OK" in probe.stdout:
            lines.append("Запуск сервера:  собирается без ошибок")
        else:
            error = (probe.stderr or probe.stdout).strip().splitlines()
            lines.append("Запуск сервера:  ОШИБКА")
            for line in error[-4:]:
                lines.append(f"  {line}")
    return lines


def main(argv: Optional[List[str]] = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if "--check" in args:
        for line in report():
            print("  " + line)
        return 0
    return _install_and_report(force="--force" in args)


def _install_and_report(force: bool = False) -> int:
    try:
        path = install(force=force)
    except Exception as exc:  # noqa: BLE001 - пользователю нужен текст, а не трейсбек
        print(f"  [!] {exc}")
        return 1
    # Сразу перечитываем: если приложение управляет этим файлом само, запись
    # может не пережить его запуск, и об этом лучше узнать сейчас.
    try:
        written = json.loads(path.read_text(encoding="utf-8-sig") or "{}")
        confirmed = (written.get("mcpServers") or {}).get(SERVER_NAME) == server_entry()
    except (OSError, json.JSONDecodeError):
        confirmed = False

    print(f"  Сервер добавлен в настройки Claude: {path}")
    print(f"  Проверка записи: {'запись на месте' if confirmed else 'ЗАПИСЬ НЕ СОХРАНИЛАСЬ'}")
    print(f"  Запуск: {python_path()}")
    print("  Перезапустите приложение Claude, чтобы оно увидело сервер.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
