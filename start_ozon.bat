@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Панель Ozon

echo.
echo   ============================================
echo     ПАНЕЛЬ OZON
echo   ============================================
echo.

REM --- Шаг 1: ищем Python ---------------------------------------------------
if not exist "ozon_app.py" (
  echo   [!] Рядом с этим файлом нет ozon_app.py.
  echo       Похоже, архив распакован не целиком или файл лежит отдельно.
  echo       Положите start_ozon.bat в ту же папку, где ozon_app.py.
  echo.
  pause
  exit /b 1
)

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)

if not defined PY (
  echo   [!] Python на компьютере не найден.
  echo.
  echo   Что делать:
  echo     1. Откройте https://www.python.org/downloads/
  echo     2. Нажмите жёлтую кнопку "Download Python"
  echo     3. В установщике ОБЯЗАТЕЛЬНО поставьте галочку
  echo        "Add python.exe to PATH" - она внизу первого окна
  echo     4. Нажмите Install Now и дождитесь конца
  echo     5. Закройте это окно и запустите start_ozon.bat заново
  echo.
  pause
  exit /b 1
)

REM --- Шаг 2: своё окружение, чтобы не мешать другим программам -------------
if not exist ".venv\Scripts\python.exe" (
  echo   Первый запуск: готовлю всё нужное. Это займёт 2-3 минуты.
  echo.
  %PY% -m venv .venv
  if errorlevel 1 goto :error
)

set "VPY=.venv\Scripts\python.exe"

REM Streamlit при первом запуске спрашивает почту прямо в окне и ждёт ввода.
REM Новичка это ставит в тупик, поэтому отвечаем за него заранее.
if not exist "%USERPROFILE%\.streamlit" mkdir "%USERPROFILE%\.streamlit"
if not exist "%USERPROFILE%\.streamlit\credentials.toml" (
  > "%USERPROFILE%\.streamlit\credentials.toml" echo [general]
  >> "%USERPROFILE%\.streamlit\credentials.toml" echo email = ""
)

echo   Проверяю обновления...
"%VPY%" -m pip install --quiet --upgrade pip
"%VPY%" -m pip install --quiet -r requirements-ozon.txt
if errorlevel 1 goto :error

REM --- Шаг 3: запускаем панель ---------------------------------------------
echo.
echo   Готово. Открываю панель в браузере.
echo.
echo   ------------------------------------------------------------
echo    Это окно закрывать НЕЛЬЗЯ - пока оно открыто, работает панель.
echo    Чтобы закончить работу: закройте вкладку в браузере,
echo    потом это окно (или нажмите Ctrl+C).
echo   ------------------------------------------------------------
echo.

"%VPY%" -m streamlit run ozon_app.py --server.headless=false
goto :end

:error
echo.
echo   [!] Что-то пошло не так. Скопируйте текст выше и покажите его Claude -
echo       по сообщению об ошибке сразу видно, в чём дело.
echo.
pause
exit /b 1

:end
echo.
echo   Панель остановлена. Окно можно закрыть.
pause
