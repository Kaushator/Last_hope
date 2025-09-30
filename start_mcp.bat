@echo off
echo ============================================
echo   Last Hope MCP Server - Quick Start
echo ============================================
echo.

:MENU
echo Choose an option:
echo 1. Start MCP Server (Production)
echo 2. Start MCP Server (Development with Hot Reload)
echo 3. Start MCP Server (Debug Mode)
echo 4. Check Server Health
echo 5. Run Tests
echo 6. View Server Logs
echo 7. Stop All Servers
echo 8. Install Dependencies
echo 9. Exit
echo.
set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto START_PROD
if "%choice%"=="2" goto START_DEV
if "%choice%"=="3" goto START_DEBUG
if "%choice%"=="4" goto HEALTH_CHECK
if "%choice%"=="5" goto RUN_TESTS
if "%choice%"=="6" goto VIEW_LOGS
if "%choice%"=="7" goto STOP_SERVERS
if "%choice%"=="8" goto INSTALL_DEPS
if "%choice%"=="9" goto EXIT

echo Invalid choice. Please try again.
goto MENU

:START_PROD
echo Starting MCP Server in Production Mode...
npm start
goto MENU

:START_DEV
echo Starting MCP Server in Development Mode with Hot Reload...
npm run dev
goto MENU

:START_DEBUG
echo Starting MCP Server in Debug Mode...
npm run dev:debug
goto MENU

:HEALTH_CHECK
echo Checking Server Health...
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:4000/health' -Method GET).Content | ConvertFrom-Json | ConvertTo-Json -Depth 3 } catch { Write-Host 'Server is not running or not responding' -ForegroundColor Red }"
echo.
pause
goto MENU

:RUN_TESTS
echo Running Tests...
npm test
echo.
pause
goto MENU

:VIEW_LOGS
echo Opening server logs...
echo Note: Logs are displayed in the server console window
pause
goto MENU

:STOP_SERVERS
echo Stopping all Node.js servers...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM nodemon.exe 2>nul
echo Servers stopped.
echo.
pause
goto MENU

:INSTALL_DEPS
echo Installing Dependencies...
npm install
echo Dependencies installed.
echo.
pause
goto MENU

:EXIT
echo Goodbye!
exit