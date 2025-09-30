# Last Hope MCP Server - PowerShell Environment Setup
# This script loads all environment variables for development

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Last Hope MCP Server - Env Setup" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            $name = $matches[1]
            $value = $matches[2]
            # Remove quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "✅ Loaded $name" -ForegroundColor Green
        }
    }
} else {
    Write-Warning ".env file not found. Please create one with your API keys."
    Write-Host "Expected format:"
    Write-Host "GITHUB_TOKEN=your_github_token"
    Write-Host "HTX_ACCESS_KEY=your_htx_access_key"
    Write-Host "HTX_SECRET_KEY=your_htx_secret_key"
    Write-Host "OPENAI_API_KEY=your_openai_api_key"
    exit 1
}

# Additional environment variables
$env:DEBUG = "mcp:*"
$env:LOG_LEVEL = "debug"
$env:NODE_ENV = "development"

Write-Host "✅ Environment variables loaded successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Yellow
Write-Host "  npm start          - Start MCP server" -ForegroundColor White
Write-Host "  npm run dev:debug  - Start with debug logging" -ForegroundColor White  
Write-Host "  npm run health     - Check server health" -ForegroundColor White
Write-Host "  npm test           - Run test suite" -ForegroundColor White
Write-Host ""
Write-Host "Server will be available at: http://localhost:4000" -ForegroundColor Magenta
Write-Host ""

# Test environment is loaded
Write-Host "Testing environment setup..." -ForegroundColor Yellow
if ($env:GITHUB_TOKEN -and $env:HTX_ACCESS_KEY -and $env:HTX_SECRET_KEY -and $env:OPENAI_API_KEY) {
    Write-Host "✅ All API keys loaded correctly!" -ForegroundColor Green
} else {
    Write-Host "❌ Some API keys missing!" -ForegroundColor Red
    Write-Host "Missing keys:" -ForegroundColor Red
    if (-not $env:GITHUB_TOKEN) { Write-Host "  - GITHUB_TOKEN" -ForegroundColor Red }
    if (-not $env:HTX_ACCESS_KEY) { Write-Host "  - HTX_ACCESS_KEY" -ForegroundColor Red }
    if (-not $env:HTX_SECRET_KEY) { Write-Host "  - HTX_SECRET_KEY" -ForegroundColor Red }
    if (-not $env:OPENAI_API_KEY) { Write-Host "  - OPENAI_API_KEY" -ForegroundColor Red }
}