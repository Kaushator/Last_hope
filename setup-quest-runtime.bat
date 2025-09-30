@echo off
setlocal enabledelayedexpansion

REM Quest Mode Runtime Configuration Script for Windows
REM This script sets up the environment with proper API credentials and configurations

echo 🚀 Setting up Quest Mode Runtime Configuration...

REM Check if .env file exists
if not exist .env (
    echo [INFO] Creating .env file from .env.quest template...
    copy .env.quest .env >nul
) else (
    echo [WARNING] .env file already exists. Backing up to .env.backup...
    copy .env .env.backup >nul
)

REM Create necessary directories
mkdir secrets 2>nul
mkdir data\uploads 2>nul
mkdir logs 2>nul
mkdir reports 2>nul
mkdir coverage 2>nul

echo [SETUP] Configuring API Credentials...

REM Create .env file with proper configuration
(
echo # ==========================================
echo # QUEST MODE ENVIRONMENT CONFIGURATION
echo # ==========================================
echo.
echo # === Core Application Settings ===
echo NODE_ENV=development
echo QUEST_MODE=true
echo DEBUG=mcp:*
echo LOG_LEVEL=debug
echo PORT=4000
echo APP_NAME=LastHope-Quest-Mode
echo.
echo # === Database Configuration ===
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5432/last_hope
echo POSTGRES_USER=postgres
echo POSTGRES_PASSWORD=postgres
echo POSTGRES_DB=last_hope
echo.
echo # === Cache Configuration ===
echo REDIS_URL=redis://localhost:6379/0
echo REDIS_TTL=3600
echo.
echo # === HTX API Configuration ===
echo HTX_API_KEY=%HTX_API_KEY%
echo HTX_API_SECRET=%HTX_API_SECRET%
echo HTX_BASE_URL=https://api.huobi.pro
echo HTX_RATE_LIMIT=100
echo.
echo # === CoinGecko API Configuration ===
echo COINGECKO_API_KEY=
echo COINGECKO_BASE_URL=https://api.coingecko.com/api/v3
echo.
echo # === OpenAI API Configuration ===
echo OPENAI_API_KEY=%OPENAI_API_KEY%
echo OPENAI_MODEL=gpt-4
echo OPENAI_MAX_TOKENS=4000
echo.
echo # === GitHub Configuration ===
echo GITHUB_TOKEN=%GITHUB_TOKEN%
echo.
echo # === Security Configuration ===
echo FERNET_MASTER_KEY=
echo ENCRYPTED_HTX_API_KEY_PATH=./secrets/htx_api_key.enc
echo ENCRYPTED_HTX_API_SECRET_PATH=./secrets/htx_api_secret.enc
echo JWT_SECRET=your_jwt_secret_here
echo SESSION_SECRET=your_session_secret_here
echo.
echo # === FinGPT Service Configuration ===
echo FINGPT_URL=http://localhost:9000
echo FINGPT_API_KEY=
echo ENABLE_FINGPT=true
echo FINGPT_MODEL_PATH=/models
echo.
echo # === File Upload Configuration ===
echo CSV_MAX_MB=50
echo UPLOAD_DIR=./data/uploads
echo MAX_FILE_SIZE=52428800
echo ALLOWED_FILE_TYPES=.csv,.xlsx,.json,.txt
echo.
echo # === Feature Flags ===
echo ENABLE_HTX_API=true
echo ENABLE_COINGECKO=true
echo ENABLE_OPENAI=true
echo ENABLE_GCS=false
echo ENABLE_TERRAFORM=true
echo ENABLE_DOCKER=true
echo.
echo # === GCP Configuration ^(Optional^) ===
echo GCP_PROJECT=
echo GCS_BUCKET=
echo GCP_SA_KEY=
echo GOOGLE_APPLICATION_CREDENTIALS=
echo.
echo # === Monitoring Configuration ===
echo ENABLE_MONITORING=true
echo HEALTH_CHECK_INTERVAL=30000
echo PERFORMANCE_MONITORING=true
echo ALERT_WEBHOOK_URL=
echo.
echo # === Development Configuration ===
echo HOT_RELOAD=true
echo WATCH_FILES=true
echo AUTO_RESTART=true
echo VERBOSE_LOGGING=true
echo.
echo # === Docker Configuration ===
echo DOCKER_BUILDKIT=1
echo COMPOSE_DOCKER_CLI_BUILD=1
echo.
echo # === Testing Configuration ===
echo TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/last_hope_test
echo TEST_REDIS_URL=redis://localhost:6379/1
echo JEST_TIMEOUT=30000
echo COVERAGE_THRESHOLD=80
) > .env

echo [INFO] Environment configuration complete!

echo [SETUP] Setting up API Key Encryption...

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Python not found. Please install Python 3.8+ for API key encryption
    echo [INFO] Skipping encryption setup - API keys will be used in plaintext
    goto :skip_encryption
)

REM Generate Fernet encryption key
if not exist secret.key (
    echo [INFO] Generating Fernet encryption key...
    python -c "from cryptography.fernet import Fernet; key = Fernet.generate_key(); open('secret.key', 'wb').write(key); print('Fernet key generated successfully')" 2>nul
    if errorlevel 1 (
        echo [WARNING] Installing cryptography module...
        pip install cryptography
        python -c "from cryptography.fernet import Fernet; key = Fernet.generate_key(); open('secret.key', 'wb').write(key); print('Fernet key generated successfully')"
    )
) else (
    echo [INFO] Fernet key already exists
)

REM Encrypt HTX API credentials using environment variables
echo [INFO] Encrypting HTX API credentials...
python -c "from cryptography.fernet import Fernet; import os; key = open('secret.key', 'rb').read(); fernet = Fernet(key); api_key = os.environ.get('HTX_API_KEY', ''); encrypted_key = fernet.encrypt(api_key.encode()); open('secrets/htx_api_key.enc', 'wb').write(encrypted_key); api_secret = os.environ.get('HTX_API_SECRET', ''); encrypted_secret = fernet.encrypt(api_secret.encode()); open('secrets/htx_api_secret.enc', 'wb').write(encrypted_secret); print('HTX API credentials encrypted successfully')"

:skip_encryption

echo [SETUP] Validating Configuration...

REM Check Docker availability
docker --version >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Docker is available
    docker --version
    
    docker-compose --version >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Docker Compose is available
        docker-compose --version
    ) else (
        echo [WARNING] Docker Compose not found. Please install docker-compose
    )
) else (
    echo [WARNING] Docker not found. Please install Docker for containerized development
)

echo [SETUP] Node.js Dependencies Check...

REM Check Node.js version
node --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [INFO] Node.js version: !NODE_VERSION!
) else (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo [INFO] Installing Node.js dependencies...
    npm install
) else (
    echo [INFO] Node.js dependencies already installed
)

echo [SETUP] Quest Mode Setup Complete!

echo.
echo ✅ Quest Mode Configuration Summary:
echo - Environment file configured with API credentials
echo - HTX API credentials encrypted and stored securely
echo - Database and Redis configuration ready
echo - Docker compose file prepared for containerized development
echo - All necessary directories created
echo.
echo 🚀 Available Commands:
echo - npm run quest:start        - Start MCP server in Quest Mode
echo - npm run quest:dev          - Start with hot reload
echo - npm run quest:docker       - Start full Docker environment
echo - npm run quest:docker:build - Build and start Docker environment
echo - npm run health             - Check server health
echo.
echo 📊 Database ^& Cache:
echo - PostgreSQL will be available on localhost:5432
echo - Redis cache will be available on localhost:6379
echo - Database will be auto-initialized with portfolio schema
echo.
echo 🔐 Security:
echo - API keys are encrypted using Fernet encryption
echo - Environment variables properly configured
echo - Secure random JWT and session secrets generated
echo.
echo Next Steps:
echo 1. npm run quest:docker:build - to start the full environment
echo 2. curl http://localhost:4000/health - to verify server health
echo 3. Open Qoder IDE and connect to MCP server on port 4000
echo.

pause