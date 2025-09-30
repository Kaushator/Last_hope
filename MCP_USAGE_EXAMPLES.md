# MCP Server Example Usage Scenarios

This document provides practical examples of how to use the Last Hope MCP Server with Qoder IDE.

## 🎯 Scenario 1: HTX Market Data Analysis

### Use Case
A trader wants to analyze Bitcoin market data and get predictions for trading decisions.

### Steps
1. **Get Market Overview**
   ```
   User: "Show me the current cryptocurrency market overview"
   
   MCP Action: htx-fetch-markets
   Parameters: { "limit": 20, "filter": "crypto" }
   ```

2. **Fetch Detailed BTCUSDT Data**
   ```
   User: "Get detailed BTCUSDT price data for the last 24 hours"
   
   MCP Action: htx-fetch-candles
   Parameters: { "symbol": "btcusdt", "interval": "1h", "limit": 24 }
   ```

3. **Generate Prediction**
   ```
   User: "Analyze this data and predict the next price movement"
   
   MCP Action: fingpt-predict
   Parameters: { "symbol": "btcusdt", "timeframe": "4h", "confidence": 0.8 }
   ```

### Expected Results
- Market overview with top cryptocurrencies
- Historical price data with OHLCV values
- AI-generated prediction with confidence score

---

## 📊 Scenario 2: CSV Data Processing Pipeline

### Use Case
A data analyst needs to process trading performance data from CSV files.

### Steps
1. **Parse Trading Data CSV**
   ```
   User: "Parse this trading results CSV file"
   
   MCP Action: csv-parse
   Parameters: { "filePath": "data/trading_results.csv", "encoding": "utf8" }
   ```

2. **Validate Data Quality**
   ```
   User: "Validate the parsed data for completeness"
   
   MCP Action: csv-validate
   Parameters: { 
     "schema": {
       "required": ["date", "symbol", "price", "volume"],
       "types": { "price": "number", "volume": "number" }
     }
   }
   ```

3. **Transform and Filter Data**
   ```
   User: "Filter profitable trades and calculate statistics"
   
   MCP Action: csv-transform
   Parameters: { 
     "filter": { "profit": { "$gt": 0 } },
     "aggregate": ["sum", "avg", "count"]
   }
   ```

4. **Export Results**
   ```
   User: "Export the processed data to a new CSV file"
   
   MCP Action: csv-export
   Parameters: { "filePath": "output/profitable_trades.csv", "includeHeaders": true }
   ```

### Expected Results
- Cleaned and validated trading data
- Filtered profitable trades
- Statistical summary
- Exported CSV with results

---

## 🏗️ Scenario 3: Infrastructure Deployment

### Use Case
A DevOps engineer wants to deploy the MCP server to Google Cloud Platform.

### Steps
1. **Build Docker Image**
   ```
   User: "Build a Docker image for the MCP server"
   
   MCP Action: fingpt-build-image
   Parameters: { "tag": "last-hope:v1.0.0", "push": true }
   ```

2. **Plan Infrastructure Changes**
   ```
   User: "Plan the Terraform deployment to GCP"
   
   MCP Action: infra-terraform-plan
   Parameters: { "workspace": "production", "project": "my-gcp-project" }
   ```

3. **Deploy Infrastructure**
   ```
   User: "Apply the infrastructure changes"
   
   MCP Action: infra-terraform-apply
   Parameters: { "auto-approve": true, "workspace": "production" }
   ```

4. **Verify Deployment**
   ```
   User: "Check the deployment status and resources"
   
   MCP Action: infra-manage-gcp
   Parameters: { "action": "list-resources", "project": "my-gcp-project" }
   ```

### Expected Results
- Built and pushed Docker image
- Terraform plan showing infrastructure changes
- Deployed resources on GCP
- Verification of running services

---

## 🔍 Scenario 4: Performance Monitoring

### Use Case
A system administrator wants to monitor the MCP server performance and health.

### Steps
1. **Check System Health**
   ```
   User: "Check the overall health of the MCP server"
   
   MCP Action: health-check
   Parameters: { "detailed": true }
   ```

2. **Monitor Memory Usage**
   ```
   User: "Show memory usage trends for the last hour"
   
   MCP Action: performance-monitor
   Parameters: { "metric": "memory", "timeframe": "1h" }
   ```

3. **Check Agent Performance**
   ```
   User: "Get performance metrics for all agents"
   
   MCP Action: agent-performance
   Parameters: { "agents": ["htx", "csv", "fingpt"], "includeHistory": true }
   ```

### Expected Results
- Comprehensive health status
- Memory usage charts and trends
- Agent response time metrics
- Performance recommendations

---

## 🛠️ Scenario 5: Development and Testing

### Use Case
A developer wants to test new features and debug issues.

### Steps
1. **Start Development Mode**
   ```
   User: "Start the server in development mode with debugging"
   
   Command: npm run dev:debug
   ```

2. **Test Agent Functionality**
   ```
   User: "Test the HTX agent with sample data"
   
   MCP Action: htx-agent-test
   Parameters: { "mode": "test", "sampleData": true }
   ```

3. **Run Code Quality Checks**
   ```
   User: "Run linting and tests on the codebase"
   
   MCP Action: ci-lint-and-test
   Parameters: { "fix": true, "coverage": true }
   ```

4. **Generate Test Reports**
   ```
   User: "Generate a comprehensive test report"
   
   MCP Action: generate-test-report
   Parameters: { "format": "html", "includeMetrics": true }
   ```

### Expected Results
- Server running with hot reload and debugging
- Agent test results with detailed logs
- Code quality metrics and fixes
- Comprehensive test coverage report

---

## 💡 Advanced Usage Tips

### Chaining Operations
You can chain multiple MCP operations together:
```
User: "Get BTCUSDT data, analyze it, and export the results to CSV"

This would trigger:
1. htx-fetch-candles for BTCUSDT
2. fingpt-analyze for the fetched data
3. csv-export for the analysis results
```

### Error Handling
The MCP server provides detailed error information:
```json
{
  "success": false,
  "error": "HTX API rate limit exceeded",
  "code": "RATE_LIMIT_ERROR",
  "retryAfter": 60,
  "suggestions": ["Use cached data", "Reduce request frequency"]
}
```

### Configuration Override
You can override default configurations per request:
```json
{
  "action": "htx-fetch-markets",
  "config": {
    "timeout": 30000,
    "retries": 3,
    "cache": false
  }
}
```

### Monitoring and Alerts
Set up monitoring for critical operations:
```json
{
  "monitor": {
    "responseTime": {"max": 5000},
    "memoryUsage": {"max": "90%"},
    "errorRate": {"max": "5%"}
  }
}
```