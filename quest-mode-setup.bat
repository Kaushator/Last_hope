@echo off
:: Last Hope MCP Server - Quest Mode Startup Script for Windows
:: This script configures and starts the MCP server optimally for Qoder Quest Mode

echo.
echo 🚀================================🚀
echo    Last Hope - Qoder Quest Mode
echo 🚀================================🚀
echo.

:: Load environment variables from .env file
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%a"=="#" (
            set "%%a=%%b"
        )
    )
    echo ✅ Environment variables loaded from .env
) else (
    echo ⚠️  .env file not found - using default configuration
)

:: Set Quest Mode specific variables
set QUEST_MODE=true
set NODE_ENV=development
set DEBUG=mcp:*
set LOG_LEVEL=debug

echo.
echo 🔧 Quest Mode Configuration:
echo    - Hot Reload: ✅ Enabled
echo    - Debug Logging: ✅ Enabled
echo    - MCP Server Port: 4000
echo    - Development Mode: ✅ Enabled
echo    - Windows Environment: ✅ Ready
echo.

echo 🛠️  Available Commands:
echo    npm run quest:start    - Start Quest Mode MCP Server
echo    npm run quest:dev      - Start Quest Mode with Hot Reload  
echo    npm run health         - Check server health
echo    npm test               - Run test suite
echo.

:: Start health check endpoint
echo 🏥 Starting health check...
call npm run health 2>nul || echo ⚠️  Server not running yet

echo.
echo 🎯 Quest Mode Ready! Start the MCP server with:
echo    npm run quest:start
echo.
echo 🔗 Connect Qoder IDE to: http://localhost:4000
echo.

:: Keep window open
if "%1"=="auto" goto :eof
pause