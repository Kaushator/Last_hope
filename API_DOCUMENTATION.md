# API Documentation - HTX Exchange Interface & CSV Data Loader

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [HTX Agent Endpoints](#htx-agent-endpoints)
- [CSV Agent Endpoints](#csv-agent-endpoints)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Overview

The Last Hope MCP Server provides a unified API for cryptocurrency market data retrieval from HTX exchange and CSV data processing capabilities. All endpoints follow RESTful conventions with standardized JSON responses.

**Base URL**: `http://localhost:4000`

---

## Authentication

### API Key Encryption

HTX API keys must be encrypted using Fernet encryption before use:

```bash
# Using the provided encryption tool
python tools/encrypt_api_key.py
```

The encrypted key is then used in API requests to the HTX agent.

---

## HTX Agent Endpoints

### 1. Verify Keys

Validates HTX API credentials and tests connectivity.

**Endpoint**: `POST /agent/htx/verifyKeys`

**Request Body**:
```json
{
  "encrypted_key": "string (required) - Fernet-encrypted HTX API key"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "keyValid": true,
    "timestamp": 1640995200,
    "connectivity": "verified"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "endpoint": "verifyKeys",
    "apiVersion": "v1"
  }
}
```

**Validation Rules**:
- `encrypted_key`: Required, base64-encoded Fernet token, minimum 10 characters

---

### 2. Fetch Markets

Retrieves trading pairs and ticker data from HTX exchange.

**Endpoint**: `POST /agent/htx/fetchMarkets`

**Request Body**:
```json
{
  "limit": 100,        // Optional: 1-1000, default 100
  "filter": "usdt"     // Optional: currency filter (usdt, btc, etc.)
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "markets": [
      {
        "symbol": "btcusdt",
        "baseCurrency": "btc",
        "quoteCurrency": "usdt",
        "state": "online",
        "price": 45000.50,
        "volume": 1234.56,
        "high": 46000.00,
        "low": 44000.00,
        "change": 2.15
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "totalReturned": 100,
    "totalAvailable": 850,
    "filter": "usdt",
    "limit": 100,
    "endpoint": "fetchMarkets"
  }
}
```

**Validation Rules**:
- `limit`: Optional number, 1-1000 range
- `filter`: Optional string, 2-10 characters, alphanumeric only

**Caching**: Responses cached for 5 minutes

---

### 3. Fetch Candles

Retrieves historical OHLCV candle data for a specific trading pair.

**Endpoint**: `POST /agent/htx/fetchCandles`

**Request Body**:
```json
{
  "symbol": "btcusdt",     // Required: trading pair symbol
  "interval": "1hour",     // Optional: candle interval
  "limit": 100             // Optional: number of candles (1-2000)
}
```

**Valid Intervals**:
- `1min`, `5min`, `15min`, `30min`
- `1hour`, `4hour`
- `1day`, `1week`, `1mon`

**Response**:
```json
{
  "success": true,
  "data": {
    "candles": [
      {
        "timestamp": "2024-01-15T10:00:00.000Z",
        "open": 45000.12345678,
        "high": 45123.87654321,
        "low": 44987.11111111,
        "close": 45067.55555555,
        "volume": 123.45678901,
        "amount": 5567890.12345678
      }
    ],
    "symbol": "btcusdt",
    "interval": "1hour",
    "count": 100
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "endpoint": "fetchCandles",
    "dataRange": {
      "start": "2024-01-14T10:00:00.000Z",
      "end": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**Validation Rules**:
- `symbol`: Required string, 6-12 characters, alphanumeric
- `interval`: Optional enum from valid intervals list
- `limit`: Optional number, 1-2000 range

**Caching**: Responses cached for 1 minute

---

### 4. Parse Excel

Parses HTX Excel/CSV report files with security validation.

**Endpoint**: `POST /agent/htx/parseExcel`

**Request Body**:
```json
{
  "filePath": "/path/to/report.csv",    // Required: file path
  "reportType": "trades"                // Optional: report type
}
```

**Valid Report Types**:
- `trades`, `deposits`, `withdrawals`, `orders`, `balances`

**Response**:
```json
{
  "success": true,
  "data": {
    "reportType": "trades",
    "filePath": "/path/to/report.csv",
    "recordCount": 150,
    "headers": ["timestamp", "symbol", "side", "amount", "price"],
    "dateRange": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-15T23:59:59.000Z"
    },
    "fileInfo": {
      "size": 25600,
      "modified": "2024-01-15T09:30:00.000Z",
      "format": "csv"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "endpoint": "parseExcel",
    "processingTime": 1640995200
  }
}
```

**Security Features**:
- Path traversal protection
- File size limits (50MB max)
- Allowed extensions: `.xlsx`, `.xls`, `.csv`
- Content security validation

---

### 5. Agent Summary

Returns comprehensive agent status and capabilities.

**Endpoint**: `GET /agent/htx/summary`

**Response**:
```json
{
  "success": true,
  "data": {
    "agent": "htxAgent",
    "version": "2.0.0",
    "status": "operational",
    "capabilities": {
      "apiVerification": {
        "status": "implemented",
        "features": ["fernet_encryption", "connectivity_test"]
      },
      "marketData": {
        "status": "implemented",
        "features": ["caching", "filtering", "rate_limiting"]
      }
    },
    "endpoints": [
      {
        "name": "verifyKeys",
        "method": "POST",
        "parameters": ["encrypted_key"],
        "rateLimit": "public"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "nodeVersion": "v18.17.0",
    "endpoint": "summary"
  }
}
```

---

## CSV Agent Endpoints

### 1. Parse CSV

Parses CSV files with streaming support for large files.

**Endpoint**: `POST /agent/csv/parseCSV`

**Request Body**:
```json
{
  "filePath": "/path/to/file.csv",    // Required: file path
  "delimiter": ",",                   // Optional: field delimiter
  "hasHeader": true,                  // Optional: has header row
  "encoding": "utf8",                 // Optional: file encoding
  "streaming": false,                 // Optional: force streaming
  "chunkSize": 1000                   // Optional: streaming chunk size
}
```

**Valid Delimiters**: `,`, `;`, `\t`, `|`, ` `
**Valid Encodings**: `utf8`, `utf16le`, `latin1`, `ascii`

**Response**:
```json
{
  "success": true,
  "data": {
    "filePath": "/path/to/file.csv",
    "headers": ["name", "age", "city"],
    "data": [
      {
        "name": "John",
        "age": "30",
        "city": "New York",
        "_rowIndex": 2
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "totalRows": 1000,
    "columns": 3,
    "delimiter": ",",
    "hasHeader": true,
    "encoding": "utf8",
    "fileSize": 25600,
    "processingMethod": "streaming",
    "endpoint": "parseCSV"
  }
}
```

**Auto-Streaming**: Files > 10MB automatically use streaming processing

---

### 2. Transform Data

Applies transformation operations to CSV data.

**Endpoint**: `POST /agent/csv/transformData`

**Request Body**:
```json
{
  "data": [                    // Required: array of data objects
    {"name": "John", "age": 30, "salary": 50000},
    {"name": "Jane", "age": 25, "salary": 60000}
  ],
  "operations": [              // Required: transformation operations
    {
      "type": "filter",
      "condition": "{{age}} > 25"
    },
    {
      "type": "sort",
      "column": "salary",
      "order": "desc"
    }
  ]
}
```

**Operation Types**:

1. **Filter**: Remove rows based on condition
   ```json
   {
     "type": "filter",
     "condition": "{{column_name}} > 100"
   }
   ```

2. **Map**: Transform column values
   ```json
   {
     "type": "map",
     "column": "new_column",
     "value": "{{existing_column}} * 2"
   }
   ```

3. **Sort**: Sort data by column
   ```json
   {
     "type": "sort",
     "column": "column_name",
     "order": "asc" // or "desc"
   }
   ```

4. **Aggregate**: Calculate statistics
   ```json
   {
     "type": "aggregate",
     "column": "numeric_column"
   }
   ```

**Response**:
```json
{
  "success": true,
  "data": {
    "transformedData": [
      {"name": "Jane", "age": 25, "salary": 60000}
    ],
    "appliedOperations": [
      {
        "type": "filter",
        "description": "Filtered rows by: {{age}} > 25",
        "recordsRemoved": 1
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "originalCount": 2,
    "transformedCount": 1,
    "operationsApplied": 1,
    "processingMethod": "in-memory",
    "endpoint": "transformData"
  }
}
```

---

### 3. Validate Data

Validates CSV data against a schema.

**Endpoint**: `POST /agent/csv/validateData`

**Request Body**:
```json
{
  "data": [                    // Required: array of data objects
    {"name": "John", "age": "30", "email": "john@example.com"},
    {"name": "", "age": "invalid", "email": "invalid-email"}
  ],
  "schema": {                  // Optional: validation schema
    "required": ["name", "email"],
    "types": {
      "age": "number",
      "email": "email"
    }
  }
}
```

**Schema Properties**:
- `required`: Array of required field names
- `types`: Object mapping field names to expected types
  - `number`: Numeric values
  - `email`: Valid email format
  - `date`: Valid date format
  - `boolean`: Boolean values

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": false,
    "totalRows": 2,
    "validRows": 1,
    "invalidRows": 1,
    "errors": [
      {
        "row": 2,
        "field": "name",
        "type": "required",
        "message": "Required field 'name' is missing or empty"
      },
      {
        "row": 2,
        "field": "age",
        "type": "datatype",
        "message": "Field 'age' should be of type 'number' but got 'invalid'"
      }
    ],
    "warnings": [],
    "successRate": "50.00"
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "endpoint": "validateData",
    "schema": "provided"
  }
}
```

---

### 4. Export CSV

Exports data to CSV format with security validation.

**Endpoint**: `POST /agent/csv/exportCSV`

**Request Body**:
```json
{
  "data": [                    // Required: array of data objects
    {"name": "John", "age": 30},
    {"name": "Jane", "age": 25}
  ],
  "filePath": "/path/to/output.csv",  // Required: output file path
  "delimiter": ",",                   // Optional: field delimiter
  "includeHeaders": true              // Optional: include header row
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "filePath": "/path/to/output.csv",
    "rowsExported": 2,
    "headers": ["name", "age"],
    "includeHeaders": true
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "fileSize": 45,
    "columns": 2,
    "delimiter": ",",
    "endpoint": "exportCSV"
  }
}
```

---

### 5. Agent Summary

Returns CSV agent status and capabilities.

**Endpoint**: `GET /agent/csv/summary`

**Response**: Similar structure to HTX agent summary with CSV-specific capabilities.

---

## Response Format

All API responses follow a standardized format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Endpoint-specific response data
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "endpoint": "endpoint_name",
    // Additional metadata
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": {
      // Context-specific error details
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Error Handling

### Error Codes

| Code Prefix | Category | Description |
|-------------|----------|-------------|
| `VAL_xxx` | Validation | Input validation errors |
| `AUTH_xxx` | Authentication | API key or authentication errors |
| `RATE_xxx` | Rate Limiting | Rate limit exceeded |
| `SEC_xxx` | Security | Security validation failures |
| `NF_xxx` | Not Found | Resource not found |
| `EXT_xxx` | External API | External service errors |
| `INT_xxx` | Internal | Internal server errors |

### Common Error Codes

- `VAL_001`: Missing required parameter
- `VAL_002`: Invalid parameter value
- `AUTH_001`: Invalid or expired API key
- `RATE_001`: Rate limit exceeded
- `SEC_001`: Security validation failed
- `NF_001`: File not found
- `EXT_001`: External API unavailable
- `INT_001`: Internal processing error

---

## Rate Limiting

### HTX Agent Limits

| Endpoint | Limit | Window |
|----------|--------|---------|
| verifyKeys | 5 requests | 1 minute |
| fetchMarkets | 30 requests | 1 minute |
| fetchCandles | 20 requests | 1 minute |
| parseExcel | 10 requests | 1 minute |

### CSV Agent Limits

| Endpoint | Limit | Window |
|----------|--------|---------|
| parseCSV | 10 requests | 1 minute |
| transformData | 50 requests | 1 minute |
| validateData | 20 requests | 1 minute |
| exportCSV | 5 requests | 1 minute |

### Rate Limit Response
```json
{
  "success": false,
  "error": {
    "code": "RATE_001",
    "message": "Rate limit exceeded for fetchMarkets. Max 30 requests per 60000ms",
    "details": {
      "endpoint": "fetchMarkets",
      "limit": 30,
      "window": 60000,
      "retryAfter": 45
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Examples

### Complete HTX Data Retrieval Workflow

```javascript
// 1. Verify API credentials
const verifyResponse = await fetch('/agent/htx/verifyKeys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    encrypted_key: 'your_encrypted_htx_api_key'
  })
});

// 2. Fetch market data
const marketsResponse = await fetch('/agent/htx/fetchMarkets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    limit: 50,
    filter: 'usdt'
  })
});

// 3. Get historical data for specific symbol
const candlesResponse = await fetch('/agent/htx/fetchCandles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'btcusdt',
    interval: '1hour',
    limit: 100
  })
});
```

### CSV Processing Workflow

```javascript
// 1. Parse CSV file
const parseResponse = await fetch('/agent/csv/parseCSV', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filePath: '/data/trading_data.csv',
    hasHeader: true,
    streaming: true
  })
});

// 2. Transform the data
const transformResponse = await fetch('/agent/csv/transformData', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: parseResponse.data.data,
    operations: [
      {
        type: 'filter',
        condition: '{{volume}} > 1000'
      },
      {
        type: 'sort',
        column: 'timestamp',
        order: 'desc'
      }
    ]
  })
});

// 3. Export processed data
const exportResponse = await fetch('/agent/csv/exportCSV', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: transformResponse.data.transformedData,
    filePath: '/output/processed_data.csv',
    includeHeaders: true
  })
});
```

### Error Handling Example

```javascript
async function handleApiRequest(endpoint, data) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      // Handle different error types
      switch (result.error.code.substring(0, 3)) {
        case 'VAL':
          console.error('Validation error:', result.error.message);
          break;
        case 'RAT':
          console.error('Rate limited. Retry after:', result.error.details.retryAfter);
          break;
        case 'SEC':
          console.error('Security error:', result.error.message);
          break;
        default:
          console.error('API error:', result.error.message);
      }
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error('Network error:', error.message);
    return null;
  }
}
```

---

## Health Monitoring

### Health Check Endpoint

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 86400000,
  "checks": {
    "htx_agent": {
      "status": "healthy",
      "message": "HTX Agent: operational",
      "duration": 45
    },
    "csv_agent": {
      "status": "healthy", 
      "message": "CSV Agent: operational",
      "duration": 32
    }
  },
  "system": {
    "memory": {
      "usage_percentage": "45.2"
    },
    "process": {
      "uptime": 86400,
      "node_version": "v18.17.0"
    }
  }
}
```

This comprehensive API documentation provides everything needed to integrate with and use the HTX Exchange Interface & CSV Data Loader system effectively.