@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ежедневная проверка Ozon - настройка

echo.
echo   ============================================
echo     ЕЖЕДНЕВНАЯ ПРОВЕРКА КАБИНЕТА
echo   ============================================
echo.
echo   Компьютер сам будет проверять кабинет каждое утро
echo   и показывать окно, если что-то требует внимания:
echo     - поставку пора везти на точку отгрузки
echo     - запас кончается
echo     - реклама съедает больше четверти выручки
echo.

set /p HOUR=  Во сколько проверять (например 09:00): 
if "%HOUR%"=="" set HOUR=09:00

schtasks /Create /SC DAILY /TN "Проверка Ozon" /TR "\"%CD%\daily_check.bat\"" /ST %HOUR% /F
if errorlevel 1 goto :error

echo.
echo   Готово. Проверка будет запускаться каждый день в %HOUR%.
echo.
echo   Отключить:  schtasks /Delete /TN "Проверка Ozon" /F
echo   Проверить сейчас: запустите daily_check.bat
echo.
pause
exit /b 0

:error
echo.
echo   [!] Создать задание не удалось. Попробуйте запустить этот файл
echo       от имени администратора: правый клик - Запуск от имени администратора.
echo.
pause
exit /b 1
