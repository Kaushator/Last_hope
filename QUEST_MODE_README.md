# 🚀 Qoder Quest Mode - Complete Setup Guide

## Overview

The Last Hope MCP Server is now optimally configured for **Qoder Quest Mode** in a devContainer environment. This setup provides the best possible experience for AI-powered development with the Qoder IDE.

## 🎯 What's Included

### ✅ Core Features
- **Hot Reload Development** - Instant code changes reflection
- **Multi-Agent MCP Architecture** - 6 specialized agents (HTX, FinGPT, CSV, Infrastructure, CI, Orchestrator)
- **Secure API Management** - Environment-based credential loading
- **Comprehensive Testing** - Jest with ES module support
- **DevContainer Integration** - Full Codespace compatibility

### 🔧 Technical Stack
- **Runtime**: Node.js 18 with ES modules
- **Server**: Express.js with rate limiting and CORS
- **Testing**: Jest with 70%+ coverage requirements
- **Security**: Fernet encryption for sensitive data
- **Infrastructure**: Docker + Terraform ready
- **CI/CD**: GitHub Actions configured

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys (configure these values)
# - GITHUB_TOKEN=your_github_token_here
# - HTX_ACCESS_KEY=your_htx_access_key_here
# - HTX_SECRET_KEY=your_htx_secret_key_here
# - OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Quest Mode Activation

#### For Windows (Local):
```cmd
quest-mode-setup.bat
npm run quest:start
```

#### For Linux/Codespace:
```bash
./quest-mode-setup.sh
npm run quest:start
```

### 3. Connect Qoder IDE
- **Local**: `http://localhost:4000`
- **Codespace**: `https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev`

## 🏗️ Architecture Overview

```
Last Hope MCP Server
├── 🔧 Core Infrastructure
│   ├── Express.js API Server (Port 4000)
│   ├── Hot Reload Development
│   └── Health Check Endpoints
├── 🤖 MCP Agents
│   ├── HTX Trading Agent (Market data + Trading)
│   ├── FinGPT Prediction Agent (AI predictions)
│   ├── CSV Analysis Agent (Data processing)
│   ├── Infrastructure Agent (DevOps automation)
│   ├── CI/CD Agent (Pipeline management)
│   └── Orchestrator Agent (Multi-agent coordination)
├── 🔒 Security Layer
│   ├── Fernet Encryption
│   ├── Environment Variable Management
│   └── API Rate Limiting
└── 🧪 Testing Framework
    ├── Jest with ES Modules
    ├── Automated Coverage Reports
    └── Integration Tests
```

## 📋 Available Commands

### Development
```bash
npm run quest:start      # Start Quest Mode MCP Server
npm run quest:dev        # Start with hot reload
npm run dev:debug        # Start with verbose debugging
npm run health           # Check server health
```

### Testing
```bash
npm test                 # Run test suite
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Infrastructure
```bash
npm run compose:up       # Start Docker containers
npm run tf:plan          # Plan Terraform deployment
npm run tf:apply         # Apply infrastructure changes
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `mcp-quest-config.json` | Optimized MCP configuration for Quest Mode |
| `mcp-dev-config.json` | Development configuration with hot reload |
| `mcp-config.json` | Production configuration |
| `.devcontainer/devcontainer.json` | Codespace/DevContainer setup |
| `quest-mode-setup.sh/.bat` | Quest Mode initialization scripts |

## 🌐 DevContainer Features

### Automatic Setup
- ✅ Node.js 18 environment
- ✅ Python 3.11 with cryptography
- ✅ Docker-in-Docker support
- ✅ Terraform CLI
- ✅ Git integration
- ✅ VS Code extensions (Copilot, Docker, Terraform)

### Port Forwarding
- **4000**: MCP Server (Main)
- **3000**: Development Server (Auto-open)
- **8080**: Debug Interface (Silent)

### Environment Variables
```bash
NODE_ENV=development
QUEST_MODE=true
MCP_SERVER_URL=https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev
DEBUG=mcp:*
```

## 🎯 Quest Mode Optimizations

### Performance
- **Caching**: Enabled for API responses
- **Compression**: Gzip compression for large payloads
- **Request Batching**: Optimized multi-request handling
- **Connection Pooling**: Efficient resource utilization

### Reliability
- **Auto-restart**: Server automatically recovers from crashes
- **Health Monitoring**: 30-second interval health checks
- **Retry Logic**: 3 automatic retries for failed operations
- **Timeout Management**: 60-second timeout for complex operations

### Development Experience
- **Hot Reload**: Instant code change reflection
- **Verbose Logging**: Detailed debug information
- **Development Tools**: Enhanced debugging capabilities
- **Qoder IDE Integration**: Native MCP protocol support

## 🔗 Integration URLs

### Local Development
- **MCP Server**: `http://localhost:4000`
- **Health Check**: `http://localhost:4000/health`
- **API Documentation**: `http://localhost:4000/docs`

### Codespace (GitHub)
- **MCP Server**: `https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev`
- **Health Check**: `https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev/health`

## 🛠️ Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check environment variables
npm run health

# Verify API keys
cat .env | grep -E "(GITHUB_TOKEN|HTX_|OPENAI_)"

# Reset and restart
npm run quest:dev
```

#### MCP Connection Issues
```bash
# Verify configuration
cat ~/.config/qoder/mcp-config.json

# Check server logs
DEBUG=mcp:* npm run quest:start
```

#### Port Conflicts
```bash
# Check what's using port 4000
netstat -tulpn | grep :4000

# Kill conflicting processes
pkill -f "node server.js"
```

## 🎉 Quest Mode Ready!

Your Last Hope MCP Server is now optimally configured for Qoder Quest Mode! 

🔗 **Connect Qoder IDE to**: `http://localhost:4000` (local) or `https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev` (Codespace)

Happy coding! 🚀