@echo off
chcp 65001 >nul
cd /d "%~dp0"
if "%~1"=="" (
  echo Перетащите файл озвучки ^(mp3^) на этот значок мышью.
  echo Или укажите его в командной строке:  make_reel.bat voice.mp3
  echo.
  pause
  exit /b
)
python make_reel.py "%~1" %2 %3 %4 %5 %6 %7 %8 %9
echo.
pause
