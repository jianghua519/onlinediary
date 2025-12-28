@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

REM =========================
REM Config
REM =========================
set "BACKEND_DIR=backend"
set "FRONTEND_DIR=frontend"
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=5173"

REM =========================
REM Kill ports (dev)
REM =========================
for %%P in (%BACKEND_PORT% %FRONTEND_PORT%) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo Killing PID %%A on port %%P...
    taskkill /PID %%A /F >nul 2>&1
  )
)

REM =========================
REM Start backend (npm run dev)
REM =========================
if exist "%BACKEND_DIR%\package.json" (
  echo Starting backend (npm run dev)...
  start "OnlineDiary Backend (dev)" cmd /k ^
    "cd /d %BACKEND_DIR% && npm run dev"
) else (
  echo Backend package.json not found
)

REM =========================
REM Start frontend (npm run dev)
REM =========================
if exist "%FRONTEND_DIR%\package.json" (
  echo Starting frontend (npm run dev)...
  start "OnlineDiary Frontend (dev)" cmd /k ^
    "cd /d %FRONTEND_DIR% && npm run dev"
) else (
  echo Frontend package.json not found
)

echo.
echo ===============================
echo Dev services started
echo Backend  : http://localhost:%BACKEND_PORT%
echo Frontend : http://localhost:%FRONTEND_PORT%
echo ===============================
echo.

endlocal
