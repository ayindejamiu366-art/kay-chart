@echo off
cd /d "%~dp0"
echo ========================================
echo   Nocturne Music - Development Mode
echo ========================================
echo.
echo Starting backend + frontend concurrently...
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3001
echo   Health:   http://localhost:3001/api/health
echo.
npx concurrently --kill-others --names server,vite --prefix-colors blue,green "node server/index.cjs" "vite"
