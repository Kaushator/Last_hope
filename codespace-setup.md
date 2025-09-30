# Codespace Setup Instructions for Last Hope MCP Server

## 🚀 Quick Setup Commands

Run these commands in your Codespace terminal:

### 1. Install Dependencies
```bash
cd /workspaces/Last_hope
npm install
```

### 2. Setup Environment Variables
```bash
# Create .env file (if not exists)
cp .env.example .env 2>/dev/null || echo "PORT=4000
NODE_ENV=development
ENABLE_HTX_API=true
ENABLE_FINGPT=true
ENABLE_GCS=false
LOG_LEVEL=info" > .env
```

### 3. Start the MCP Server
```bash
npm start
```

### 4. Test the Server
```bash
# In a new terminal tab
curl http://localhost:4000/health
```

## 🔧 Expected Output
When the server starts successfully, you should see:
```
⚡ MCP Server running on port 4000
📊 Agents loaded: htx, fingpt, csv, infra, ci, orchestrator
🔧 Feature flags: HTX=true, FinGPT=true, GCS=false
🔒 Security: Rate limiting enabled, Input validation active
```

## 🌐 Port Forwarding
Your Codespace will automatically forward port 4000. You can access the server at:
- Internal: `http://localhost:4000`
- External: `https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev`

## 🔗 Available Endpoints
- `/health` - Server health check
- `/analytics/summary` - Market data summary
- `/tests` - Generate tests
- `/lint` - Code linting
- `/agent/:agentName/:task` - Dynamic agent routing

## 🛠️ Available Agents
- **htxAgent**: Market data, API verification
- **csvAgent**: CSV parsing and transformation
- **finGPTAgent**: AI predictions, Docker builds
- **infraAgent**: Terraform infrastructure
- **ciAgent**: Testing and CI/CD
- **orchestratorAgent**: Pipeline orchestration

## 🔧 Development Commands
```bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Generate test coverage
npm run coverage

# Lint code
npm run lint
```

## 🚨 Troubleshooting
If you encounter issues:

1. **Port conflicts**: Change PORT in .env file
2. **Dependencies missing**: Run `npm install` again
3. **Permission issues**: Check file permissions with `ls -la`
4. **Agent failures**: Check logs for specific error messages

## 🔄 Connecting Qoder
To connect Qoder to your Codespace MCP server, update your local Qoder configuration to point to:
```
https://psychic-pancake-g4wqqvwgv55vc9jj6-4000.app.github.dev
```

Instead of `localhost:4000`.