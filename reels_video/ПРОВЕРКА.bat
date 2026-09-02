@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Проверка установки
set PY=
where py >nul 2>&1
if not errorlevel 1 set PY=py
if defined PY goto run
where python >nul 2>&1
if not errorlevel 1 set PY=python
:run
if not defined PY (
  echo   [!] Python не найден. Запустите СТАРТ.bat
  echo.
  pause
  exit /b
)
%PY% make_reel.py --check
echo.
pause
