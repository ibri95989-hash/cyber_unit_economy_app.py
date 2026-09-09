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

where claude >nul 2>nul
if errorlevel 1 (
  echo   [!] Claude Code на компьютере не найден.
  echo.
  echo   Установите его со страницы https://claude.com/claude-code
  echo   затем запустите этот файл заново.
  echo.
  echo   Если Claude Code уже стоит, но не находится - откройте его
  echo   и выполните там команду вручную:
  echo.
  echo     claude mcp add --scope user ozon -- "%CD%\.venv\Scripts\python.exe" "%CD%\mcp_launch.py"
  echo.
  pause
  exit /b 1
)

echo   Регистрирую сервер...
call claude mcp add --scope user ozon -- "%CD%\.venv\Scripts\python.exe" "%CD%\mcp_launch.py"
if errorlevel 1 goto :error

echo.
echo   Готово. Откройте Claude Code и спросите: "какой у меня остаток".
echo.
echo   Проверить, что сервер на месте:  claude mcp list
echo   Отключить:                       claude mcp remove ozon
echo.
pause
exit /b 0

:error
echo.
echo   [!] Зарегистрировать не удалось. Скопируйте текст выше и покажите Claude.
echo.
pause
exit /b 1
