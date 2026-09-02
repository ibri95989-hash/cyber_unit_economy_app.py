@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Сборка Reels
cls
echo.
echo   ================================================
echo      REELS KIT - ролик 9:16 из вашей озвучки
echo   ================================================
echo.

rem --- ищем Python -------------------------------------------------
set PY=
where py >nul 2>&1
if not errorlevel 1 set PY=py
if defined PY goto checkpy
where python >nul 2>&1
if not errorlevel 1 set PY=python
:checkpy
if not defined PY goto nopython
%PY% --version >nul 2>&1
if errorlevel 1 goto nopython

rem --- первая установка --------------------------------------------
if exist "src\Montserrat.ttf" goto ready
echo   Первый запуск: устанавливаю всё необходимое.
echo   Это займёт около 10 минут и делается один раз.
echo.
%PY% install.py
if errorlevel 1 goto installfail
cls
echo.
echo   Установка завершена.
echo.

:ready
rem --- файл озвучки ------------------------------------------------
set "AUDIO=%~1"
if not "%AUDIO%"=="" goto gotaudio
echo   Перетащите файл озвучки (mp3) мышью в это окно
echo   и нажмите Enter.
echo.
set /p AUDIO="   Файл: "
:gotaudio
set "AUDIO=%AUDIO:"=%"
if "%AUDIO%"=="" goto nofile
if not exist "%AUDIO%" goto nofile

echo.
echo   Собираю ролик. Не закрывайте окно.
echo.
%PY% make_reel.py "%AUDIO%"
if errorlevel 1 goto renderfail
echo.
echo   Готово. Открываю папку с роликом.
start "" "%~dp0out"
echo.
pause
exit /b

:nopython
echo   [!] На компьютере не найден Python.
echo.
echo   1. Открою сейчас страницу загрузки.
echo   2. Скачайте и запустите установщик.
echo   3. ВАЖНО: отметьте галочку "Add Python to PATH".
echo   4. После установки запустите СТАРТ.bat заново.
echo.
pause
start "" "https://www.python.org/downloads/"
exit /b

:installfail
echo.
echo   [!] Установка не завершилась. Проверьте интернет
echo       и запустите СТАРТ.bat ещё раз.
echo.
pause
exit /b

:nofile
echo.
echo   [!] Файл не найден. Перетащите mp3 мышью прямо в окно,
echo       путь подставится сам.
echo.
pause
exit /b

:renderfail
echo.
echo   [!] Сборка прервалась. Текст ошибки выше.
echo.
pause
exit /b
