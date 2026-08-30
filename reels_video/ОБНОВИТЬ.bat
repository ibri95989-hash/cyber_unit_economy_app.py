@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Обновление Reels Kit
echo.
echo   Обновляю программу до последней версии.
echo   Ваши настройки и готовые ролики останутся на месте.
echo.
set PY=
where py >nul 2>&1
if not errorlevel 1 set PY=py
if defined PY goto run
where python >nul 2>&1
if not errorlevel 1 set PY=python
:run
if not defined PY goto nopy
%PY% update.py
echo.
pause
exit /b
:nopy
echo   [!] Python не найден. Сначала запустите СТАРТ.bat
echo.
pause
