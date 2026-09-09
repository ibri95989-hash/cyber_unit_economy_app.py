@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Подключение Ozon к Claude

echo.
echo   ============================================
echo     ПОДКЛЮЧЕНИЕ КАБИНЕТА К CLAUDE
echo   ============================================
echo.
echo   После этого можно спрашивать словами:
echo     "какой остаток на складах"
echo     "что заканчивается"
echo     "покажи заявки на поставку"
echo.

if not exist ".venv\Scripts\python.exe" (
  echo   [!] Сначала запустите start_ozon.bat - он поставит всё нужное.
  echo.
  pause
  exit /b 1
)

echo   Проверяю обновления...
".venv\Scripts\python.exe" -m ozon.update --keep-launchers --quiet

REM --- Путь первый: командная строка Claude Code ----------------------------
where claude >nul 2>nul
if not errorlevel 1 (
  echo   Нашёл Claude Code, регистрирую сервер...
  call claude mcp add --scope user ozon -- "%CD%\.venv\Scripts\python.exe" "%CD%\mcp_launch.py"
  if not errorlevel 1 (
    echo.
    echo   Готово. Откройте Claude и спросите: "какой у меня остаток".
    echo   Проверить: claude mcp list     Отключить: claude mcp remove ozon
    echo.
    pause
    exit /b 0
  )
  echo   Через командную строку не вышло, пробую настройки приложения...
)

REM --- Путь второй: настройки приложения Claude -----------------------------
echo   Прописываю сервер в настройки приложения Claude...
".venv\Scripts\python.exe" -m ozon.claude_setup
if not errorlevel 1 goto :done

echo.
echo   Файл настроек не читается. Копия уже сохранена рядом (.backup),
echo   переписываю его начисто...
".venv\Scripts\python.exe" -m ozon.claude_setup --force
if errorlevel 1 goto :manual

:done

echo.
echo   Готово. ЗАКРОЙТЕ приложение Claude полностью и откройте заново -
echo   только тогда оно увидит новый сервер.
echo.
echo   Потом спросите: "какой у меня остаток".
echo.
pause
exit /b 0

:manual
echo.
echo   [!] Автоматически не получилось - причина выше.
echo.
if exist "%APPDATA%\Claude" (
  echo   Папка настроек Claude на месте, значит приложение установлено.
  echo   Запустите check_claude.bat - он покажет, что именно мешает.
  echo   Если файл настроек не разбирается, можно переписать его начисто:
  echo.
  echo     .venv\Scripts\python.exe -m ozon.claude_setup --force
  echo.
) else (
  echo   Папки настроек Claude нет - похоже, приложение не установлено.
  echo   Поставьте его со страницы https://claude.com/claude-code
  echo   и запустите этот файл заново.
  echo.
)
pause
exit /b 1
