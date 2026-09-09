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
if errorlevel 1 goto :manual

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
echo   [!] Автоматически не получилось.
echo.
echo   Похоже, приложения Claude на компьютере тоже нет.
echo   Установите его со страницы https://claude.com/claude-code
echo   и запустите этот файл заново.
echo.
pause
exit /b 1
