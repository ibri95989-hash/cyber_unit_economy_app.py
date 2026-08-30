@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Установка Reels Kit. Это займёт около 10 минут.
echo.
python install.py
if errorlevel 1 (
  echo.
  echo Не получилось. Проверьте, что установлен Python 3.9 или новее:
  echo   https://www.python.org/downloads/  ^(при установке отметьте "Add Python to PATH"^)
)
echo.
pause
