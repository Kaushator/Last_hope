# Last Hope MCP Server - Terraform Infrastructure Documentation

## Overview

This directory contains the complete Terraform infrastructure configuration for deploying the Last Hope MCP Server on Google Cloud Platform (GCP). The infrastructure is designed to be robust, scalable, and secure, supporting multiple environments (dev, staging, production) with comprehensive monitoring and logging.

## Architecture

The infrastructure implements a serverless architecture using Google Cloud Run, with supporting services for storage, secrets management, and monitoring:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloud Run     │───▶│  Artifact        │    │   Secret        │
│   Service       │    │  Registry        │    │   Manager       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloud         │    │  Cloud Storage   │    │   Monitoring    │
│   Logging       │    │  Bucket          │    │   & Alerting    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Directory Structure

```
terraform/
├── main.tf                    # Main infrastructure configuration
├── variables.tf               # Variable definitions
├── outputs.tf                 # Output definitions
├── terraform.tfvars.example   # Example configuration
├── GCP_SETUP_GUIDE.md        # Setup instructions
├── deploy.sh                 # Deployment automation script
├── validate.sh               # Validation and testing script
├── test_infrastructure.py    # Python-based testing suite
├── Makefile                  # Make targets for common operations
├── README.md                 # This file
└── tests/
    ├── terraform_test.go     # Go-based Terratest suite
    └── go.mod               # Go module definition
```

## Quick Start

### Prerequisites

1. **Google Cloud SDK**: Install and authenticate
2. **Terraform**: Version 1.5 or later
3. **Docker**: For container image building
4. **Make**: For using the Makefile commands

### Setup Process

1. **Copy configuration template:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. **Edit configuration:**
   ```bash
   nano terraform.tfvars
   ```
   Fill in your GCP project ID and desired settings.

3. **Follow setup guide:**
   ```bash
   cat GCP_SETUP_GUIDE.md
   ```

4. **Deploy using Make:**
   ```bash
   make deploy          # Full deployment
   make dev-deploy      # Deploy to dev environment
   make staging-deploy  # Deploy to staging environment
   make prod-deploy     # Deploy to production environment
   ```

### Alternative Deployment Methods

**Using the deployment script:**
```bash
./deploy.sh deploy      # Full deployment with interactive setup
./deploy.sh plan        # Plan only
./deploy.sh test        # Test existing deployment
```

**Using Terraform directly:**
```bash
terraform init
terraform plan
terraform apply
```

## Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `project_id` | GCP Project ID | `my-gcp-project` |
| `region` | GCP Region | `us-central1` |
| `environment` | Environment name | `dev`, `staging`, `prod` |

### Environment-Specific Settings

The infrastructure automatically configures resources based on the environment:

#### Development Environment
- **Min Instances**: 0 (cost optimization)
- **Max Instances**: 3
- **CPU Limit**: 500m
- **Memory Limit**: 256Mi
- **Log Retention**: 30 days

#### Staging Environment
- **Min Instances**: 1 (reliability)
- **Max Instances**: 5
- **CPU Limit**: 1000m
- **Memory Limit**: 512Mi
- **Log Retention**: 60 days

#### Production Environment
- **Min Instances**: 2 (high availability)
- **Max Instances**: 10
- **CPU Limit**: 2000m
- **Memory Limit**: 1Gi
- **Log Retention**: 90 days

### Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `enable_monitoring` | Enable Cloud Monitoring alerts | `true` |
| `enable_logging` | Enable structured logging | `true` |
| `enable_secrets` | Enable Secret Manager | `true` |
| `enable_public_access` | Allow unauthenticated access | `true` |

## Infrastructure Components

### Core Services

1. **Cloud Run Service**
   - Serverless container hosting
   - Auto-scaling based on demand
   - Health checks and probes configured
   - Environment-specific resource limits

2. **Artifact Registry**
   - Docker container image storage
   - Integrated with Cloud Build
   - Automatic image versioning

3. **Secret Manager**
   - Secure API key storage
   - Automatic secret rotation support
   - Fine-grained access controls

4. **Cloud Storage**
   - Data persistence and log storage
   - Lifecycle policies for cost optimization
   - Versioning enabled

### Security Features

1. **IAM Service Accounts**
   - Dedicated service account for Cloud Run
   - Minimal required permissions
   - Environment-specific isolation

2. **Secret Management**
   - All sensitive data stored in Secret Manager
   - No hardcoded secrets in configuration
   - Environment-specific secret isolation

3. **Network Security**
   - HTTPS/TLS encryption for all traffic
   - Optional public access controls
   - VPC-native networking ready

### Monitoring & Observability

1. **Health Monitoring**
   - Startup, liveness, and readiness probes
   - Automated health check endpoints
   - Service availability monitoring

2. **Performance Alerts**
   - High error rate detection (>5%)
   - Response time monitoring (>5s threshold)
   - Resource utilization alerts (CPU >80%, Memory >80%)

3. **Logging**
   - Structured application logs
   - Error log separation
   - Log retention policies
   - Health check log filtering

## Operations

### Deployment Commands

| Command | Description |
|---------|-------------|
| `make deploy` | Full deployment with validation |
| `make plan` | Generate deployment plan |
| `make apply` | Apply planned changes |
| `make test` | Run infrastructure tests |
| `make validate` | Quick health check |
| `make destroy` | Destroy infrastructure |

### Monitoring Commands

| Command | Description |
|---------|-------------|
| `make logs` | View service logs |
| `make monitoring` | Open monitoring dashboard |
| `make info` | Show service information |

### Maintenance Commands

| Command | Description |
|---------|-------------|
| `make clean` | Clean temporary files |
| `make fmt` | Format Terraform code |
| `make security-scan` | Run security analysis |

### Secret Management

**Adding API Keys:**
```bash
# HTX API credentials
echo "your-htx-api-key" | gcloud secrets versions add htx-api-key-dev --data-file=-
echo "your-htx-secret" | gcloud secrets versions add htx-api-secret-dev --data-file=-

# OpenAI API key
echo "your-openai-key" | gcloud secrets versions add openai-api-key-dev --data-file=-

# CoinGecko API key  
echo "your-coingecko-key" | gcloud secrets versions add coingecko-api-key-dev --data-file=-

# Generate Fernet encryption key
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" | \
    gcloud secrets versions add fernet-encryption-key-dev --data-file=-
```

**Updating Secrets:**
```bash
# Update existing secret
echo "new-api-key" | gcloud secrets versions add htx-api-key-dev --data-file=-

# List secret versions
gcloud secrets versions list htx-api-key-dev

# Access secret value
gcloud secrets versions access latest --secret="htx-api-key-dev"
```

## Testing

### Automated Testing

The infrastructure includes comprehensive testing suites:

**Python Test Suite:**
```bash
./test_infrastructure.py            # Run all tests
./test_infrastructure.py --test=validate  # Validation only
./test_infrastructure.py --test=security  # Security tests only
```

**Go Test Suite (Terratest):**
```bash
cd tests/
go test -v -timeout 30m
```

**Validation Script:**
```bash
./validate.sh test      # Full validation
./validate.sh health    # Quick health check
./validate.sh info      # Service information
```

### Manual Testing

**Health Check:**
```bash
curl https://your-service-url/health
```

**Service Logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit=50
```

**Monitoring Dashboard:**
```bash
gcloud monitoring dashboards list
```

## Troubleshooting

### Common Issues

#### 1. Deployment Fails with Permission Errors

**Problem**: Insufficient IAM permissions for service account.

**Solution**:
```bash
# Check current permissions
gcloud projects get-iam-policy PROJECT_ID

# Add required roles
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:terraform-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/editor"
```

#### 2. Docker Build Fails

**Problem**: Docker authentication or build context issues.

**Solution**:
```bash
# Configure Docker authentication
gcloud auth configure-docker REGION-docker.pkg.dev

# Check service account key
ls -la service-account-key.json

# Verify Docker is running
docker info
```

#### 3. Service Not Responding

**Problem**: Cloud Run service returns 5xx errors.

**Solution**:
```bash
# Check service logs
make logs

# Verify secrets are set
gcloud secrets list

# Check service configuration
gcloud run services describe SERVICE_NAME --region=REGION
```

#### 4. High Response Times

**Problem**: Service responding slowly or timing out.

**Solution**:
```bash
# Check resource limits
gcloud run services describe SERVICE_NAME --region=REGION

# Scale up resources
terraform apply -var="cpu_limit=2000m" -var="memory_limit=1Gi"

# Check for cold starts
# Consider increasing min_instances
```

### Debug Commands

**Terraform Debug:**
```bash
export TF_LOG=DEBUG
terraform plan    # Verbose Terraform output
```

**GCP Debug:**
```bash
gcloud config list                    # Current configuration
gcloud auth list                      # Authentication status
gcloud projects list                  # Available projects
gcloud services list --enabled        # Enabled APIs
```

**Service Debug:**
```bash
make debug                           # Show debug information
gcloud run services list             # List all services
gcloud run revisions list            # List service revisions
```

## Security Best Practices

### 1. Secret Management
- ✅ All secrets stored in Secret Manager
- ✅ No hardcoded credentials in code
- ✅ Environment-specific secret isolation
- ✅ Automatic secret rotation capability

### 2. Access Control
- ✅ Minimal IAM permissions (principle of least privilege)
- ✅ Service account isolation per environment
- ✅ Resource-level access controls
- ✅ Optional public access controls

### 3. Network Security
- ✅ HTTPS/TLS encryption for all traffic
- ✅ VPC-native networking support
- ✅ Ingress traffic controls
- ✅ Private service connectivity ready

### 4. Monitoring & Auditing
- ✅ Comprehensive logging and monitoring
- ✅ Security event alerting
- ✅ Audit trail for all changes
- ✅ Compliance reporting ready

## Cost Optimization

### Environment-Based Scaling
- **Development**: Min 0 instances (scales to zero)
- **Staging**: Min 1 instance (balanced cost/performance)
- **Production**: Min 2 instances (high availability)

### Resource Optimization
- CPU and memory limits based on environment
- Automatic scaling based on demand
- Log retention policies to manage storage costs
- Storage lifecycle policies for data archival

### Monitoring Costs
```bash
# View current costs
gcloud billing budgets list

# Set up budget alerts
gcloud billing budgets create --display-name="Last Hope Budget" \
    --budget-amount=100USD --threshold-percent=80
```

## Support and Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Review service logs for errors
- Check monitoring alerts
- Verify backup processes

**Monthly:**
- Update Terraform provider versions
- Review and rotate API keys
- Analyze cost reports
- Update documentation

**Quarterly:**
- Security audit and compliance review
- Performance optimization review
- Disaster recovery testing
- Infrastructure cost optimization

### Getting Help

1. **Documentation**: Check this README and setup guides
2. **Logs**: Use `make logs` to check service logs
3. **Validation**: Run `./validate.sh test` for health checks
4. **Monitoring**: Use `make monitoring` to access dashboards

### Contributing

When making changes to the infrastructure:

1. Test changes in development environment first
2. Run validation tests: `./test_infrastructure.py`
3. Update documentation as needed
4. Follow semantic versioning for releases
5. Create pull requests for review

## Version History

- **v1.0**: Initial Terraform infrastructure
- **v1.1**: Added environment-specific configurations
- **v1.2**: Enhanced security and monitoring
- **v1.3**: Added comprehensive testing suite
- **v1.4**: Improved documentation and automation

## License

This infrastructure configuration is part of the Last Hope MCP Server project. See the main project LICENSE file for details.