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
echo   Ваши ключи (.env) и журнал изменений остаются на месте.
echo.

if not exist ".venv\Scripts\python.exe" (
  echo   [!] Панель ещё ни разу не запускали.
  echo       Сначала запустите start_ozon.bat - он всё поставит и обновит сам.
  echo.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m ozon.update
if errorlevel 1 goto :error

echo.
echo   Готово. Запускайте start_ozon.bat.
echo.
pause
exit /b 0

:error
echo.
echo   [!] Обновиться не удалось - проверьте интернет и попробуйте ещё раз.
echo       Ничего не сломалось: панель работает на прежней версии.
echo.
pause
exit /b 1
