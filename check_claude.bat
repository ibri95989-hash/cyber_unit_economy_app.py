@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Проверка подключения к Claude

echo.
echo   ============================================
echo     ПОЧЕМУ CLAUDE НЕ ВИДИТ КАБИНЕТ
echo   ============================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo   [!] Сначала запустите start_ozon.bat.
  echo.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m ozon.claude_setup --check

echo.
echo   Сфотографируйте это окно и пришлите - по нему видно,
echo   на каком шаге цепочка обрывается.
echo.
pause
