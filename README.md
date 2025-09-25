# HTX Analytics - Personal Trading Analytics Platform

A comprehensive personal analytics platform for HTX (Huobi) trading with AI-powered insights, built with Next.js, FinGPT, and modern infrastructure tools.

## Features

### 🎯 Core Functionality
- **Personal HTX Trading Analytics** - No actual trading, analysis only
- **Real-time Portfolio Tracking** - Monitor holdings and performance
- **AI-Powered Insights** - FinGPT integration for intelligent analysis
- **CSV Data Import** - Upload and process trading data from various exchanges
- **Risk Assessment** - Comprehensive risk metrics and alerts

### 🛠 Technology Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Node.js
- **AI**: FinGPT in Docker containers
- **Infrastructure**: Terraform + Google Cloud Platform
- **Security**: GCP Secret Manager for credentials
- **Data Processing**: CSV parsing with MCP integration
- **Deployment**: Docker Compose + Cloud Run

### 🔧 Architecture Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js       │    │   MCP Server     │    │   FinGPT AI     │
│   Frontend      │◄──►│   (Port 3001)    │◄──►│   (Port 8080)   │
│   (Port 3000)   │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTX API       │    │   CSV Processing │    │   GCP Services  │
│   Integration   │    │   & Storage      │    │   & Secrets     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- Google Cloud account (for production)
- HTX API credentials (for live data)

### Local Development

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd Last_hope
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Start Development Services**
   ```bash
   # Start all services with Docker Compose
   docker-compose up -d
   
   # Or start individually:
   npm run dev          # Next.js frontend (port 3000)
   cd mcp-server && npm start  # MCP server (port 3001)
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - MCP Server: http://localhost:3001
   - FinGPT API: http://localhost:8080

### Production Deployment

1. **Setup GCP Infrastructure**
   ```bash
   cd terraform
   terraform init
   terraform plan -var="project_id=your-gcp-project"
   terraform apply
   ```

2. **Configure Secrets**
   ```bash
   # Store HTX API credentials in Secret Manager
   gcloud secrets create htx-api-key --data-file=-
   gcloud secrets create htx-secret-key --data-file=-
   ```

3. **Deploy Application**
   ```bash
   # Build and deploy to Cloud Run
   npm run build
   docker build -t gcr.io/your-project/htx-analytics .
   docker push gcr.io/your-project/htx-analytics
   ```

## Configuration

### Environment Variables
```bash
# HTX API Configuration
HTX_API_KEY=your_htx_api_key
HTX_SECRET_KEY=your_htx_secret_key

# Google Cloud Configuration  
GOOGLE_CLOUD_PROJECT=your_gcp_project
GOOGLE_APPLICATION_CREDENTIALS=./secrets/service-account.json

# FinGPT Configuration
FINGPT_DOCKER_IMAGE=fingpt/latest
FINGPT_API_ENDPOINT=http://localhost:8080

# MCP Configuration
MCP_SERVER_ENDPOINT=http://localhost:3001
```

### HTX API Setup
1. Log into your HTX account
2. Go to API Management section
3. Create a new API key with read-only permissions
4. Add the credentials to your environment configuration

## Usage Guide

### 📊 Dashboard Overview
- **Portfolio Summary**: Real-time value, daily changes, performance metrics
- **Holdings View**: Detailed breakdown of current positions
- **Asset Allocation**: Visual representation of portfolio distribution
- **Risk Metrics**: Volatility, Sharpe ratio, maximum drawdown

### 📈 Analytics Features
- **Performance Analysis**: Historical returns, benchmarking
- **Risk Assessment**: VaR calculations, correlation analysis
- **AI Insights**: FinGPT-powered recommendations and alerts

### 📥 Data Management
- **CSV Upload**: Support for HTX, Binance, and custom formats
- **Data Validation**: Automatic error detection and reporting
- **Historical Data**: Import and analyze past trading activity

### 🤖 AI Integration
- **Portfolio Analysis**: Comprehensive AI-powered insights
- **Risk Alerts**: Intelligent risk monitoring and notifications
- **Market Sentiment**: Real-time sentiment analysis for holdings
- **Recommendations**: AI-generated trading suggestions

## API Documentation

### HTX API Endpoints
- `GET /api/htx/ticker?symbol=btcusdt` - Get ticker data
- `GET /api/htx/balance` - Get account balance
- `POST /api/csv/upload` - Upload CSV file

### MCP Server Endpoints
- `POST /mcp/csv/process` - Process CSV files
- `POST /mcp/docker/{operation}` - Docker operations
- `POST /mcp/ai/analyze` - AI analysis requests
- `POST /mcp/cicd/{action}` - CI/CD operations
- `GET /mcp/request/{id}` - Get request status

### FinGPT AI Endpoints
- `POST /analyze` - Portfolio analysis
- `POST /market-sentiment` - Sentiment analysis
- `GET /health` - Service health check

## Development

### Project Structure
```
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/            # API routes
│   │   └── page.tsx        # Main dashboard
│   ├── components/         # React components
│   │   └── ui/            # shadcn/ui components
│   ├── lib/               # Utilities and API clients
│   └── types/             # TypeScript type definitions
├── docker/                # Docker configurations
│   └── fingpt/           # FinGPT AI service
├── terraform/            # Infrastructure as Code
├── mcp-server/           # MCP server implementation
└── docs/                 # Documentation
```

### Key Components
- **HTX API Client** (`src/lib/api/htx.ts`): Handles HTX API integration
- **CSV Processor** (`src/lib/csv-processor.ts`): Processes trading data files
- **MCP Server** (`mcp-server/server.js`): Handles CSV, Docker, AI, CI/CD operations
- **FinGPT Service** (`docker/fingpt/app.py`): AI analysis service

### Adding New Features
1. Create new API routes in `src/app/api/`
2. Add corresponding MCP endpoints if needed
3. Update UI components in `src/components/`
4. Test with both mock and real data

## MCP Integration Points

### CSV Processing
- File upload and validation
- Format detection (HTX, Binance, custom)
- Data normalization and error handling

### Docker Operations
- FinGPT container management
- Service health monitoring
- Deployment automation

### AI Workflows
- Request routing to FinGPT
- Response processing and caching
- Error handling and retries

### CI/CD Pipeline
- Automated testing and deployment
- Infrastructure provisioning
- Monitoring and alerts

## Security & Privacy

- **API Keys**: Stored in GCP Secret Manager
- **Data Isolation**: Personal analytics only, no shared data
- **Secure Communication**: HTTPS/TLS for all API calls
- **Access Control**: Read-only HTX API permissions
- **Local Processing**: Sensitive data processed locally when possible

## Performance & Scalability

- **Caching**: Intelligent caching of API responses
- **Rate Limiting**: Respect HTX API rate limits
- **Lazy Loading**: Efficient data loading strategies
- **Containerization**: Scalable Docker-based architecture

## Troubleshooting

### Common Issues

1. **HTX API Connection**
   ```bash
   # Check credentials
   curl -X GET "https://api.huobi.pro/market/tickers"
   ```

2. **Docker Service Issues**
   ```bash
   # Check service status
   docker-compose ps
   docker-compose logs fingpt
   ```

3. **Build Errors**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check the [troubleshooting](#troubleshooting) section
- Review API documentation
- Create an issue in the repository

---

**Note**: This is a personal analytics platform designed for Windows 11 + WSL2 environments. It focuses on analysis and insights rather than active trading functionality.
