@echo off
:: Last Hope MCP Server - Windows Environment Setup
:: This script loads all environment variables for development

echo.
echo ========================================
echo  Last Hope MCP Server - Env Setup
echo ========================================
echo.

:: Load environment variables from .env file
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%a"=="#" (
            set "%%a=%%b"
            echo ✅ Loaded %%a
        )
    )
    echo.
    echo ✅ Environment variables loaded successfully!
) else (
    echo ❌ .env file not found. Please create one with your API keys.
    echo Expected format:
    echo GITHUB_TOKEN=your_github_token
    echo HTX_ACCESS_KEY=your_htx_access_key
    echo HTX_SECRET_KEY=your_htx_secret_key
    echo OPENAI_API_KEY=your_openai_api_key
    pause
    exit /b 1
)

echo.
echo Available commands:
echo   npm start          - Start MCP server
echo   npm run dev:debug  - Start with debug logging
echo   npm run health     - Check server health
echo   npm test           - Run test suite
echo.
echo Server will be available at: http://localhost:4000
echo.

:: Test environment is loaded
echo Testing environment setup...
if defined GITHUB_TOKEN if defined HTX_ACCESS_KEY if defined HTX_SECRET_KEY if defined OPENAI_API_KEY (
    echo ✅ All API keys loaded correctly!
) else (
    echo ❌ Some API keys missing!
    if not defined GITHUB_TOKEN echo   - GITHUB_TOKEN
    if not defined HTX_ACCESS_KEY echo   - HTX_ACCESS_KEY  
    if not defined HTX_SECRET_KEY echo   - HTX_SECRET_KEY
    if not defined OPENAI_API_KEY echo   - OPENAI_API_KEY
)
echo.