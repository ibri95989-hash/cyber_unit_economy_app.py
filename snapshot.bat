@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Снимок кабинета Ozon

echo.
echo   ============================================
echo     СНИМОК КАБИНЕТА ДЛЯ CLAUDE
echo   ============================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo   [!] Сначала запустите start_ozon.bat.
  echo.
  pause
  exit /b 1
)

echo   Проверяю обновления...
".venv\Scripts\python.exe" -m ozon.update --keep-launchers --quiet

echo   Спрашиваю Ozon...
".venv\Scripts\python.exe" -m ozon.snapshot
if errorlevel 1 goto :error

echo.
echo   Открываю папку с файлом. Перетащите ozon_snapshot.json
echo   прямо в переписку с Claude - и он увидит ваши данные.
echo.

if exist "ozon_snapshot.json" explorer /select,"%CD%\ozon_snapshot.json"

pause
exit /b 0

:error
echo.
echo   [!] Собрать не получилось - причина выше.
echo       Чаще всего дело в ключах: проверьте, что панель их видит.
echo.
pause
exit /b 1
