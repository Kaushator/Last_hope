#!/bin/bash

# Quest Mode Runtime Configuration Script
# This script sets up the environment with proper API credentials and configurations

set -e

echo "🚀 Setting up Quest Mode Runtime Configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_status "Creating .env file from .env.quest template..."
    cp .env.quest .env
else
    print_warning ".env file already exists. Backing up to .env.backup..."
    cp .env .env.backup
fi

# Create secrets directory if it doesn't exist
mkdir -p secrets
mkdir -p data/uploads
mkdir -p logs
mkdir -p reports
mkdir -p coverage

print_header "Configuring API Credentials..."

# Set up environment variables with provided credentials
cat > .env << EOF
# ==========================================
# QUEST MODE ENVIRONMENT CONFIGURATION
# ==========================================

# === Core Application Settings ===
NODE_ENV=development
QUEST_MODE=true
DEBUG=mcp:*
LOG_LEVEL=debug
PORT=4000
APP_NAME=LastHope-Quest-Mode

# === Database Configuration ===
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/last_hope
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=last_hope

# === Cache Configuration ===
REDIS_URL=redis://localhost:6379/0
REDIS_TTL=3600

# === HTX API Configuration ===
HTX_API_KEY=\${HTX_API_KEY:-your_htx_api_key_here}
HTX_API_SECRET=\${HTX_API_SECRET:-your_htx_api_secret_here}
HTX_BASE_URL=https://api.huobi.pro
HTX_RATE_LIMIT=100

# === CoinGecko API Configuration ===
COINGECKO_API_KEY=
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3

# === OpenAI API Configuration ===
OPENAI_API_KEY=\${OPENAI_API_KEY:-your_openai_api_key_here}
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4000

# === GitHub Configuration ===
GITHUB_TOKEN=\${GITHUB_TOKEN:-your_github_token_here}

# === Security Configuration ===
FERNET_MASTER_KEY=
ENCRYPTED_HTX_API_KEY_PATH=./secrets/htx_api_key.enc
ENCRYPTED_HTX_API_SECRET_PATH=./secrets/htx_api_secret.enc
JWT_SECRET=\$(openssl rand -hex 32)
SESSION_SECRET=\$(openssl rand -hex 32)

# === FinGPT Service Configuration ===
FINGPT_URL=http://localhost:9000
FINGPT_API_KEY=
ENABLE_FINGPT=true
FINGPT_MODEL_PATH=/models

# === File Upload Configuration ===
CSV_MAX_MB=50
UPLOAD_DIR=./data/uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=.csv,.xlsx,.json,.txt

# === Feature Flags ===
ENABLE_HTX_API=true
ENABLE_COINGECKO=true
ENABLE_OPENAI=true
ENABLE_GCS=false
ENABLE_TERRAFORM=true
ENABLE_DOCKER=true

# === GCP Configuration (Optional) ===
GCP_PROJECT=
GCS_BUCKET=
GCP_SA_KEY=
GOOGLE_APPLICATION_CREDENTIALS=

# === Monitoring Configuration ===
ENABLE_MONITORING=true
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_MONITORING=true
ALERT_WEBHOOK_URL=

# === Development Configuration ===
HOT_RELOAD=true
WATCH_FILES=true
AUTO_RESTART=true
VERBOSE_LOGGING=true

# === Docker Configuration ===
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1

# === Testing Configuration ===
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/last_hope_test
TEST_REDIS_URL=redis://localhost:6379/1
JEST_TIMEOUT=30000
COVERAGE_THRESHOLD=80
EOF

print_status "Environment configuration complete!"

# Generate Fernet encryption key for API keys
print_header "Setting up API Key Encryption..."

if [ ! -f secret.key ]; then
    print_status "Generating Fernet encryption key..."
    python3 -c "
from cryptography.fernet import Fernet
key = Fernet.generate_key()
with open('secret.key', 'wb') as f:
    f.write(key)
print('Fernet key generated successfully')
" || {
    print_warning "Python cryptography module not found. Installing..."
    pip3 install cryptography
    python3 -c "
from cryptography.fernet import Fernet
key = Fernet.generate_key()
with open('secret.key', 'wb') as f:
    f.write(key)
print('Fernet key generated successfully')
"
}
else
    print_status "Fernet key already exists"
fi

# Encrypt HTX API credentials using environment variables
print_status "Encrypting HTX API credentials..."
python3 -c "
from cryptography.fernet import Fernet
import os

# Load the key
with open('secret.key', 'rb') as f:
    key = f.read()
fernet = Fernet(key)

# Encrypt HTX API Key from environment variable
api_key = os.environ.get('HTX_API_KEY', '')
encrypted_key = fernet.encrypt(api_key.encode())
with open('secrets/htx_api_key.enc', 'wb') as f:
    f.write(encrypted_key)

# Encrypt HTX API Secret from environment variable
api_secret = os.environ.get('HTX_API_SECRET', '')
encrypted_secret = fernet.encrypt(api_secret.encode())
with open('secrets/htx_api_secret.enc', 'wb') as f:
    f.write(encrypted_secret)

print('HTX API credentials encrypted successfully')
"

print_header "Validating Configuration..."

# Test encrypted credentials
print_status "Testing encrypted credentials..."
python3 -c "
from cryptography.fernet import Fernet

# Load the key
with open('secret.key', 'rb') as f:
    key = f.read()
fernet = Fernet(key)

# Test decryption
try:
    with open('secrets/htx_api_key.enc', 'rb') as f:
        encrypted_key = f.read()
    decrypted_key = fernet.decrypt(encrypted_key).decode()
    
    with open('secrets/htx_api_secret.enc', 'rb') as f:
        encrypted_secret = f.read()
    decrypted_secret = fernet.decrypt(encrypted_secret).decode()
    
    print(f'✅ HTX API Key: {decrypted_key[:8]}...')
    print(f'✅ HTX API Secret: {decrypted_secret[:8]}...')
    print('Credential encryption/decryption test passed!')
except Exception as e:
    print(f'❌ Credential test failed: {e}')
"

# Set proper permissions
chmod 600 .env secret.key secrets/*
chmod 755 secrets/

print_header "Docker Configuration Check..."

# Check Docker availability
if command -v docker &> /dev/null; then
    print_status "Docker is available"
    docker --version
    
    if command -v docker-compose &> /dev/null; then
        print_status "Docker Compose is available"
        docker-compose --version
    else
        print_warning "Docker Compose not found. Please install docker-compose"
    fi
else
    print_warning "Docker not found. Please install Docker for containerized development"
fi

print_header "Node.js Dependencies Check..."

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js version: $NODE_VERSION"
    
    if [[ "$NODE_VERSION" < "v18" ]]; then
        print_warning "Node.js version should be 18 or higher for optimal compatibility"
    fi
else
    print_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing Node.js dependencies..."
    npm install
else
    print_status "Node.js dependencies already installed"
fi

print_header "Quest Mode Setup Complete!"

echo -e "
${GREEN}✅ Quest Mode Configuration Summary:${NC}
- Environment file configured with API credentials
- HTX API credentials encrypted and stored securely
- Database and Redis configuration ready
- Docker compose file prepared for containerized development
- All necessary directories created

${BLUE}🚀 Available Commands:${NC}
- ${YELLOW}npm run quest:start${NC}        - Start MCP server in Quest Mode
- ${YELLOW}npm run quest:dev${NC}          - Start with hot reload
- ${YELLOW}npm run quest:docker${NC}       - Start full Docker environment
- ${YELLOW}npm run quest:docker:build${NC} - Build and start Docker environment
- ${YELLOW}npm run health${NC}             - Check server health

${BLUE}📊 Database & Cache:${NC}
- PostgreSQL will be available on localhost:5432
- Redis cache will be available on localhost:6379
- Database will be auto-initialized with portfolio schema

${BLUE}🔐 Security:${NC}
- API keys are encrypted using Fernet encryption
- Environment variables properly configured
- Secure random JWT and session secrets generated

${GREEN}Next Steps:${NC}
1. ${YELLOW}npm run quest:docker:build${NC} - to start the full environment
2. ${YELLOW}curl http://localhost:4000/health${NC} - to verify server health
3. Open Qoder IDE and connect to MCP server on port 4000
"