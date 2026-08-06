@echo off
REM Double-click this to play.
REM
REM Opening index.html directly does NOT work: the game loads its script from
REM JSON, and browsers block that over file:// for security. It needs a real
REM local server. This starts one and opens the browser at it.

setlocal
cd /d "%~dp0"
set PORT=5173

where python >nul 2>&1 && (set PY=python) || (
  where py >nul 2>&1 && (set PY=py) || (
    echo.
    echo   Python was not found on your PATH.
    echo.
    echo   Either install Python from python.org and tick "Add to PATH",
    echo   or use the VS Code "Live Server" extension on index.html instead.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   Life Is Strange: Exchange
echo   Serving on http://localhost:%PORT%
echo.
echo   Leave this window open while you play.
echo   Close it, or press Ctrl+C, to stop.
echo.

start "" "http://localhost:%PORT%"
%PY% -m http.server %PORT%
