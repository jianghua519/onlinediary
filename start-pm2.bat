@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "NGINX_DIR=C:\Users\jiang\Documents\nginx"
set "NGINX_CONF=conf\nginx.conf"
set "BACKEND_ENTRY=backend\dist\index.js"
set "FRONTEND_DIST=frontend\dist"
set "APP_NAME=onlinediary-backend"

REM Stop nginx if running
if exist "%NGINX_DIR%\nginx.exe" (
  tasklist /FI "IMAGENAME eq nginx.exe" | find /I "nginx.exe" >nul 2>&1
  if not errorlevel 1 (
    echo Stopping nginx...
    "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%" -c "%NGINX_CONF%" -s quit >nul 2>&1
    timeout /t 2 >nul
  )
)

REM Stop pm2 app if installed and running
where pm2 >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%A in ('pm2 list ^| findstr /I /C:"%APP_NAME%"') do set "PM2_HAS_APP=1"
  if defined PM2_HAS_APP (
    echo Stopping pm2 app %APP_NAME%...
    pm2 stop %APP_NAME% >nul 2>&1
    pm2 delete %APP_NAME% >nul 2>&1
  )
)

REM Kill processes listening on backend/proxy ports if any
for %%P in (3000 8080) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo Stopping PID %%A on port %%P...
    taskkill /PID %%A /F >nul 2>&1
  )
)

REM Start backend (pm2 if available, otherwise plain node)
if not exist "%BACKEND_ENTRY%" (
  echo Missing backend build: %BACKEND_ENTRY%
  goto start_nginx
)

where pm2 >nul 2>&1
if not errorlevel 1 (
  echo Starting backend with pm2...
  pm2 start "%BACKEND_ENTRY%" --name %APP_NAME% --time --env production
) else (
  echo Starting backend with node...
  start "OnlineDiary Backend" cmd /k "node %BACKEND_ENTRY%"
)

:start_nginx
REM Start nginx to serve frontend build
if not exist "%FRONTEND_DIST%\index.html" (
  echo Missing frontend build: %FRONTEND_DIST%\index.html
)

if exist "%NGINX_DIR%\nginx.exe" (
  echo Starting nginx...
  "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%" -c "%NGINX_CONF%"
) else (
  echo Nginx not found at %NGINX_DIR%
)

echo Build services started.
endlocal
