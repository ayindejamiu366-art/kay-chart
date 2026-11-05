@echo off
echo ========================================
echo   Nocturne Music App - Production Mode
echo ========================================
echo.

REM Kill any existing node processes
taskkill /F /IM node.exe >nul 2>&1

echo [1/1] Starting Nocturne (serves API + frontend on port 3001)...
echo.
echo   URL: http://localhost:3001
echo   Health: http://localhost:3001/api/health
echo.
start "Nocturne" cmd /c "cd /d "%~dp0" && node server/index.cjs"
