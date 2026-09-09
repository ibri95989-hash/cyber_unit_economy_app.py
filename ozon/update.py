"""Обновление панели: скачать свежую версию и заменить файлы программы.

Личное не трогается: .env с ключами, журнал изменений и виртуальное окружение
остаются на месте. Запускается и руками, и автоматически при старте панели:

    python -m ozon.update            # обновить всё
    python -m ozon.update --quiet    # молча, только при изменениях
"""
from __future__ import annotations

import io
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import List

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_URL = (
    "https://github.com/ibri95989-hash/cyber_unit_economy_app.py"
    "/archive/refs/heads/claude/ozon-api-integration-m313iz.zip"
)

# Личные файлы и то, что нельзя перезаписывать на ходу.
KEEP = {".env", "ozon_audit.jsonl"}
KEEP_DIRS = {".venv", ".git", "__pycache__"}
# Windows читает .bat построчно прямо во время выполнения: перезаписать файл,
# который сейчас работает, значит потерять место в нём. Поэтому запускающий
# скрипт никогда не обновляет сам себя.
BOTH_LAUNCHERS = {"start_ozon.bat", "update_ozon.bat"}
SELF = {"update_ozon.bat"}


def _download() -> zipfile.ZipFile:
    with urllib.request.urlopen(ARCHIVE_URL, timeout=120) as response:
        return zipfile.ZipFile(io.BytesIO(response.read()))


def update(*, exclude: set | None = None, quiet: bool = False) -> List[str]:
    """Заменить файлы программы свежими. Возвращает список обновлённого."""
    exclude = exclude or set()
    archive = _download()
    names = archive.namelist()
    if not names:
        raise RuntimeError("Архив пустой — обновление отменено.")
    top = names[0].split("/")[0] + "/"

    changed: List[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        archive.extractall(tmp)
        source = Path(tmp) / top.rstrip("/")

        for item in source.rglob("*"):
            if item.is_dir():
                continue
            relative = item.relative_to(source)
            if relative.name in KEEP or set(relative.parts) & KEEP_DIRS:
                continue
            if relative.name in exclude:
                continue

            target = ROOT / relative
            fresh = item.read_bytes()
            if target.exists() and target.read_bytes() == fresh:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(fresh)
            changed.append(str(relative))

    if not quiet or changed:
        if changed:
            print(f"  Обновлено файлов: {len(changed)}")
            for name in sorted(changed)[:10]:
                print(f"    {name}")
        else:
            print("  Обновлений нет, версия свежая.")
    return changed


def main(argv: List[str] | None = None) -> int:
    args = set(argv if argv is not None else sys.argv[1:])
    # При запуске панели заняты оба батника, при ручном обновлении — только сам
    # апдейтер: остальное можно спокойно заменять.
    exclude = BOTH_LAUNCHERS if "--keep-launchers" in args else SELF
    try:
        update(exclude=exclude, quiet="--quiet" in args)
    except Exception as exc:  # noqa: BLE001 - обновление не должно мешать запуску
        print(f"  Обновиться не вышло ({exc}). Работаем на текущей версии.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
