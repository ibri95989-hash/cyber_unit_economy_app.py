@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ежедневная проверка Ozon

if not exist ".venv\\Scripts\\python.exe" exit /b 1

".venv\\Scripts\\python.exe" -m ozon.update --keep-launchers --quiet
".venv\\Scripts\\python.exe" -m ozon.watch --quiet

REM Код 2 означает «есть срочное» - показываем окно поверх всего.
if errorlevel 2 (
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; $t = Get-Content -Raw -Encoding UTF8 'ozon_daily.txt'; [System.Windows.MessageBox]::Show($t, 'Ozon: требует внимания', 'OK', 'Warning')"
)
exit /b 0
