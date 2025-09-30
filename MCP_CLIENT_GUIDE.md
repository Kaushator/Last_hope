# Last Hope MCP Server - Client Integration Guide

## 🚀 Quick Start with Qoder IDE

### Configuration

Copy one of these configurations to your Qoder IDE MCP settings:

#### Production Configuration
```json
{
  "mcpServers": {
    "last-hope": {
      "command": "node",
      "args": ["server.js"],
      "cwd": "e:\\Last_hope",
      "name": "Last Hope MCP Server",
      "env": {
        "NODE_ENV": "production",
        "ENABLE_HTX_API": "true",
        "ENABLE_FINGPT": "true"
      }
    }
  }
}
```

#### Development Configuration (with Hot Reload)
```json
{
  "mcpServers": {
    "last-hope-dev": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "e:\\Last_hope",
      "name": "Last Hope MCP Server (Dev)",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "mcp:*",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## 🛠️ Available Tools

### HTX Market Data Tools
- **`htx-verify-keys`** - Verify encrypted HTX API keys
- **`htx-fetch-markets`** - Get current market data
- **`htx-fetch-candles`** - Get historical price data
- **`htx-parse-excel`** - Parse HTX Excel reports

### CSV Processing Tools
- **`csv-parse`** - Parse CSV files with validation
- **`csv-transform`** - Transform and filter data
- **`csv-validate`** - Validate data against schemas
- **`csv-export`** - Export data to CSV format

### FinGPT Integration Tools
- **`fingpt-predict`** - Generate market predictions
- **`fingpt-analyze`** - Analyze market trends
- **`fingpt-build-image`** - Build Docker images

### Infrastructure Tools
- **`infra-terraform-plan`** - Plan infrastructure changes
- **`infra-terraform-apply`** - Apply infrastructure
- **`infra-manage-gcp`** - Manage GCP resources

## 🎯 Example Usage Scenarios

### Scenario 1: Market Data Analysis
```
User: "Get the latest BTCUSDT market data and generate a prediction"

MCP Commands:
1. htx-fetch-markets with filter for BTCUSDT
2. htx-fetch-candles for historical data
3. fingpt-predict using the market data
```

### Scenario 2: CSV Data Processing
```
User: "Parse this trading data CSV and validate it"

MCP Commands:
1. csv-parse to load the file
2. csv-validate against trading schema
3. csv-transform to clean the data
4. csv-export to save results
```

### Scenario 3: Infrastructure Deployment
```
User: "Deploy the application to GCP"

MCP Commands:
1. fingpt-build-image to create Docker image
2. infra-terraform-plan to preview changes
3. infra-terraform-apply to deploy
4. infra-manage-gcp to verify deployment
```

## 📊 Monitoring and Health

### Health Check
The server provides comprehensive health monitoring:
- `/health` - Overall system health
- `/analytics/summary` - Analytics overview
- Agent-specific health checks

### Performance Metrics
- Response time monitoring
- Memory usage tracking
- Agent performance metrics
- Rate limiting status

## 🔒 Security Features

### Input Validation
- Request sanitization
- Schema validation
- File path security

### Rate Limiting
- Per-endpoint limits
- Agent-specific throttling
- Security headers

### Encryption
- Fernet-based API key encryption
- Secure credential management

## 🐛 Troubleshooting

### Common Issues

1. **Server Not Starting**
   ```bash
   cd "e:\Last_hope"
   npm install
   npm start
   ```

2. **Port Already in Use**
   ```bash
   netstat -ano | findstr :4000
   # Kill the process or change PORT environment variable
   ```

3. **Agent Not Responding**
   - Check server logs
   - Verify agent is loaded in startup message
   - Test with `/health` endpoint

4. **Memory Issues**
   - Monitor with `/health` endpoint
   - Restart server if memory > 95%
   - Check for memory leaks in agents

### Debug Mode
Set environment variables for debugging:
```bash
set DEBUG=mcp:*
set LOG_LEVEL=debug
npm run dev
```

## 📝 API Reference

### Health Endpoints
- `GET /health` - System health check
- `GET /analytics/summary` - Analytics overview

### Agent Endpoints
- `POST /agent/:agentName/:task` - Dynamic agent routing
- `POST /tests` - Generate tests
- `POST /lint` - Code linting
- `GET /billing` - Billing information

### Response Format
All responses follow this structure:
```json
{
  "success": true,
  "result": { /* agent-specific data */ },
  "agent": "agentName",
  "task": "taskName",
  "metadata": {
    "timestamp": "2025-09-26T...",
    "endpoint": "taskName"
  }
}
```

## 🔄 Continuous Integration

The server integrates with CI/CD pipelines:
- GitHub Actions support
- Docker containerization
- Terraform infrastructure as code
- Automated testing

## 📞 Support

For issues and questions:
1. Check server logs: `npm start` output
2. Test health endpoint: `http://localhost:4000/health`
3. Review this documentation
4. Check project README and documentation files