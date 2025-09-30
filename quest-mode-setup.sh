#!/bin/bash
# Last Hope MCP Server - Quest Mode Startup Script for devContainer
# This script configures and starts the MCP server optimally for Qoder Quest Mode

echo ""
echo "🚀================================🚀"
echo "   Last Hope - Qoder Quest Mode"
echo "🚀================================🚀"
echo ""

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '#' | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "⚠️  .env file not found - using default configuration"
fi

# Set Quest Mode specific variables
export QUEST_MODE=true
export NODE_ENV=development
export DEBUG=mcp:*
export LOG_LEVEL=debug

# Create Qoder config directory if it doesn't exist
mkdir -p ~/.config/qoder

# Copy Quest Mode MCP configuration for Qoder IDE
if [ -f "mcp-quest-config.json" ]; then
    cp mcp-quest-config.json ~/.config/qoder/mcp-config.json
    echo "✅ Quest Mode MCP configuration installed for Qoder IDE"
fi

echo ""
echo "🔧 Quest Mode Configuration:"
echo "   - Hot Reload: ✅ Enabled" 
echo "   - Debug Logging: ✅ Enabled"
echo "   - MCP Server Port: 4000"
echo "   - Development Mode: ✅ Enabled"
echo "   - Codespace Integration: ✅ Ready"

if [ ! -z "$CODESPACE_NAME" ]; then
    echo "   - Codespace URL: https://$CODESPACE_NAME-4000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
fi

echo ""
echo "🛠️  Available Commands:"
echo "   npm run quest:start    - Start Quest Mode MCP Server"
echo "   npm run quest:dev      - Start Quest Mode with Hot Reload"
echo "   npm run health         - Check server health"
echo "   npm test               - Run test suite"
echo ""

# Start health check endpoint
echo "🏥 Starting health check..."
npm run health 2>/dev/null || echo "⚠️  Server not running yet"

echo ""
echo "🎯 Quest Mode Ready! Start the MCP server with:"
echo "   npm run quest:start"
echo ""
echo "🔗 Connect Qoder IDE to: http://localhost:4000"
if [ ! -z "$CODESPACE_NAME" ]; then
    echo "🌐 External URL: https://$CODESPACE_NAME-4000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
fi
echo ""