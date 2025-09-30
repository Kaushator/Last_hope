# Integration Guide - HTX Analytics & FinGPT

This guide describes the integration between HTX analytics data and FinGPT predictions, with optional persistence to Google Cloud Storage.

## Overview

The integration allows:
- **Standalone Operation**: HTX and FinGPT can work independently
- **Combined Analytics**: Generate insights by combining HTX market data with FinGPT predictions
- **Flexible Storage**: Persist reports to GCS, MinIO, or local filesystem
- **Feature Flags**: Enable/disable components via environment variables

## Architecture

```
┌─────────────────┐      ┌─────────────────┐
│   HTX Agent     │      │  FinGPT Agent   │
│  (Market Data)  │      │  (Predictions)  │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └────────┬───────────────┘
                  │
         ┌────────▼─────────┐
         │  Analytics       │
         │  Summary         │
         │  Endpoint        │
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │   GCS Service    │
         │  (Optional)      │
         └────────┬─────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼────┐   ┌───▼────┐   ┌───▼────┐
│  GCS   │   │ MinIO  │   │ Local  │
│(Cloud) │   │(Dev)   │   │(File)  │
└────────┘   └────────┘   └────────┘
```

## Environment Variables

### Feature Flags

```bash
# Enable/disable HTX API integration
ENABLE_HTX_API=true

# Enable/disable FinGPT predictions
ENABLE_FINGPT=false

# Enable/disable GCS storage
ENABLE_GCS=false
```

### GCS Configuration

```bash
# GCS bucket name
GCS_BUCKET_NAME=last-hope-analytics

# Path to GCS service account key file (optional)
GCS_KEY_FILE=/path/to/service-account-key.json

# Use MinIO for local development
USE_MINIO=false
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Local storage fallback path
LOCAL_STORAGE_PATH=./data/reports
```

## API Endpoints

### 1. Generate Analytics Summary

**Endpoint**: `GET /analytics/summary`

**Query Parameters**:
- `persist` (optional): Set to `true` to save report to storage

**Response**:
```json
{
  "reportId": "report-1234567890",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "featureFlags": {
    "htx": true,
    "fingpt": false,
    "gcs": false
  },
  "markets": {
    "data": [...],
    "count": 10
  },
  "predictions": {
    "disabled": true,
    "message": "FinGPT is disabled"
  },
  "insights": {
    "generated": true,
    "summary": "Combined HTX market data with FinGPT predictions",
    "recommendations": []
  },
  "storage": {
    "success": false,
    "error": "GCS is disabled",
    "localPath": "./data/reports/report-1234567890.json"
  }
}
```

**Example**:
```bash
# Generate summary without persistence
curl http://localhost:4000/analytics/summary

# Generate and persist summary
curl http://localhost:4000/analytics/summary?persist=true
```

### 2. Retrieve Saved Report

**Endpoint**: `GET /analytics/report/:id`

**Parameters**:
- `id`: Report ID to retrieve

**Response**:
```json
{
  "reportId": "report-1234567890",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "markets": {...},
  "predictions": {...}
}
```

**Example**:
```bash
curl http://localhost:4000/analytics/report/report-1234567890
```

### 3. List All Reports

**Endpoint**: `GET /analytics/reports`

**Response**:
```json
{
  "success": true,
  "count": 5,
  "reports": [
    {
      "reportId": "report-1234567890",
      "fileName": "reports/report-1234567890.json",
      "size": 2048,
      "created": "2024-01-01T12:00:00.000Z",
      "updated": "2024-01-01T12:00:00.000Z",
      "contentType": "application/json",
      "source": "local"
    }
  ],
  "source": "local"
}
```

**Example**:
```bash
curl http://localhost:4000/analytics/reports
```

### 4. Delete Report

**Endpoint**: `DELETE /analytics/report/:id`

**Parameters**:
- `id`: Report ID to delete

**Response**:
```json
{
  "success": true,
  "reportId": "report-1234567890",
  "message": "Report deleted from local storage"
}
```

**Example**:
```bash
curl -X DELETE http://localhost:4000/analytics/report/report-1234567890
```

## Feature Flag Scenarios

### Scenario 1: All Features Enabled
```bash
ENABLE_HTX_API=true
ENABLE_FINGPT=true
ENABLE_GCS=true
```

**Result**: 
- Fetches real market data from HTX
- Generates predictions using FinGPT
- Persists reports to GCS

### Scenario 2: HTX Only (Analytics Without AI)
```bash
ENABLE_HTX_API=true
ENABLE_FINGPT=false
ENABLE_GCS=false
```

**Result**:
- Fetches market data from HTX
- No predictions generated
- Reports stored locally only

### Scenario 3: Development Mode (All Disabled)
```bash
ENABLE_HTX_API=false
ENABLE_FINGPT=false
ENABLE_GCS=false
```

**Result**:
- Returns mock/fallback data
- No external API calls
- Everything stored locally

### Scenario 4: Production with GCS
```bash
ENABLE_HTX_API=true
ENABLE_FINGPT=true
ENABLE_GCS=true
GCS_KEY_FILE=/path/to/key.json
GCS_BUCKET_NAME=production-analytics
```

**Result**:
- Full production setup
- All features enabled
- Reports stored in GCS bucket

## Local Development with MinIO

MinIO provides S3-compatible storage for local development:

### 1. Start MinIO
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

### 2. Configure Environment
```bash
ENABLE_GCS=true
USE_MINIO=true
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
GCS_BUCKET_NAME=local-analytics
```

### 3. Create Bucket
```bash
# Using MinIO client (mc)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/local-analytics
```

## Error Handling

The integration includes comprehensive error handling:

1. **HTX API Unavailable**: Returns mock data with error flag
2. **FinGPT Unavailable**: Returns fallback statistical predictions
3. **GCS Unavailable**: Falls back to local filesystem storage
4. **Invalid Report ID**: Returns 404 with helpful error message

Example error response:
```json
{
  "error": "Report not found",
  "id": "non-existent-report",
  "message": "Report not found in GCS or local storage"
}
```

## Testing

Run integration tests:
```bash
# All tests
npm test

# Analytics tests only
npm test -- --testPathPattern=analytics.test.js

# With coverage
npm run test:coverage
```

## Orchestrator Agent Integration

The orchestrator agent provides high-level operations:

```javascript
// Build dataset from multiple sources
await orchestratorAgent.buildDataset({
  sources: ['htx', 'csv'],
  htx_config: { encrypted_key: '...' }
});

// Call FinGPT for predictions
await orchestratorAgent.callFinGPT({
  data: marketData,
  model: 'fingpt-v1'
});

// Publish comprehensive report
await orchestratorAgent.publishReport({
  title: 'Weekly Market Analysis',
  dataset: datasetId,
  predictions: predictionsData,
  format: 'json'
});
```

## Security Considerations

1. **API Keys**: Store HTX API keys encrypted using Fernet encryption
2. **GCS Credentials**: Use service account key files, never commit to repo
3. **Environment Variables**: Use `.env` file for sensitive configuration
4. **Rate Limiting**: Respect HTX API rate limits
5. **Input Validation**: All endpoints validate input parameters

## Monitoring

Monitor integration health:

```bash
# Check MCP server health
curl http://localhost:4000/health

# Check orchestrator status
curl http://localhost:4000/agent/orchestratorAgent/summary
```

## Troubleshooting

### Issue: GCS Upload Fails

**Solution**: Check credentials and bucket permissions
```bash
# Verify GCS credentials
gcloud auth application-default login

# Check bucket exists
gsutil ls gs://your-bucket-name
```

### Issue: HTX API Returns Errors

**Solution**: Verify API keys are properly encrypted
```bash
# Re-encrypt API key
npm run encrypt:key
```

### Issue: Reports Not Persisting

**Solution**: Ensure storage directory has write permissions
```bash
mkdir -p ./data/reports
chmod 755 ./data/reports
```

## Migration to Production

1. **Enable Feature Flags**:
   ```bash
   ENABLE_HTX_API=true
   ENABLE_FINGPT=true
   ENABLE_GCS=true
   ```

2. **Configure GCS**:
   - Create GCS bucket
   - Generate service account key
   - Set `GCS_KEY_FILE` path

3. **Deploy Infrastructure**:
   ```bash
   cd terraform
   terraform init
   terraform apply
   ```

4. **Test Integration**:
   ```bash
   curl http://your-domain/analytics/summary?persist=true
   ```

## Support

For issues or questions:
- Check logs: `./logs/`
- Review tests: `test/integration/analytics.test.js`
- See main docs: `README.md`
