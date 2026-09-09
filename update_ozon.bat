@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Обновление панели Ozon

echo.
echo   ============================================
echo     ОБНОВЛЕНИЕ ПАНЕЛИ
echo   ============================================
echo.
echo   Скачаю свежую версию и заменю файлы программы.
echo   Ваши ключи (.env) и журнал изменений останутся на месте.
echo.

if not exist "ozon_app.py" (
  echo   [!] Рядом с этим файлом нет ozon_app.py.
  echo       Положите update_ozon.bat в папку с панелью.
  echo.
  pause
  exit /b 1
)

set "URL=https://github.com/ibri95989-hash/cyber_unit_economy_app.py/archive/refs/heads/claude/ozon-api-integration-m313iz.zip"
set "WORK=%TEMP%\ozon_update"

if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"

echo   Скачиваю...
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%URL%' -OutFile '%WORK%\proj.zip'"
if errorlevel 1 goto :error
if not exist "%WORK%\proj.zip" goto :error

echo   Распаковываю...
powershell -NoProfile -Command "Expand-Archive -Path '%WORK%\proj.zip' -DestinationPath '%WORK%' -Force"
if errorlevel 1 goto :error

set "SRC="
for /d %%D in ("%WORK%\cyber_unit_economy_app.py-*") do set "SRC=%%D"
if not defined SRC goto :error

echo   Заменяю файлы...
robocopy "%SRC%" "%CD%" /E /XF .env ozon_audit.jsonl /XD .venv .git >nul
if errorlevel 8 goto :error

rmdir /s /q "%WORK%"

echo.
echo   Готово. Запускайте start_ozon.bat как обычно.
echo.
pause
exit /b 0

:error
echo.
echo   [!] Обновиться не удалось - проверьте интернет и попробуйте ещё раз.
echo       Ничего не сломалось: панель работает на прежней версии.
echo.
if exist "%WORK%" rmdir /s /q "%WORK%"
pause
exit /b 1
