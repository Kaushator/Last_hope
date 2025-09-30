# GCP Service Account Setup Guide

This guide walks you through setting up the GCP service account and authentication required for the Last Hope MCP Server Terraform deployment.

## Prerequisites

1. **GCP Project**: Ensure you have a GCP project with billing enabled
2. **gcloud CLI**: Install and configure the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
3. **Terraform**: Install [Terraform](https://developer.hashicorp.com/terraform/downloads) (>= 1.5)
4. **Docker**: Install [Docker](https://docs.docker.com/get-docker/) for image building

## Step 1: Authenticate with GCP

```bash
# Login to your Google account
gcloud auth login

# Set your project (replace with your project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com
```

## Step 2: Create Service Account

```bash
# Create service account for Terraform operations
gcloud iam service-accounts create terraform-last-hope \
    --display-name="Terraform Last Hope" \
    --description="Service account for Last Hope Terraform operations"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:terraform-last-hope@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/editor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:terraform-last-hope@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:terraform-last-hope@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:terraform-last-hope@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"
```

## Step 3: Create and Download Service Account Key

```bash
# Create service account key
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=terraform-last-hope@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Move key to terraform directory
mv service-account-key.json terraform/
```

## Step 4: Configure Terraform Variables

```bash
# Copy the example variables file
cd terraform
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your specific values
nano terraform.tfvars
```

**Required variables to update:**
- `project_id`: Your GCP project ID
- `region`: Your preferred GCP region
- `environment`: dev/staging/prod

## Step 5: Initialize Terraform

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment (review changes)
terraform plan

# Apply infrastructure (when ready)
terraform apply
```

## Step 6: Set Up API Keys (After Deployment)

After successful deployment, you need to add your API keys to Secret Manager:

```bash
# Set HTX API key (replace with your actual key)
echo "your-htx-api-key" | gcloud secrets versions add htx-api-key --data-file=-

# Generate and set Fernet encryption key
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" | \
    gcloud secrets versions add fernet-encryption-key --data-file=-
```

## Environment-Specific Configurations

### Development Environment
```
min_instances = 0
max_instances = 3
cpu_limit     = "500m"
memory_limit  = "256Mi"
```

### Staging Environment
```
min_instances = 1
max_instances = 5
cpu_limit     = "1000m"
memory_limit  = "512Mi"
```

### Production Environment
```
min_instances = 2
max_instances = 10
cpu_limit     = "2000m"
memory_limit  = "1Gi"
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Service Account Key**: Keep `service-account-key.json` secure and never commit to version control
2. **Terraform State**: Consider using remote state storage for production
3. **API Keys**: Store sensitive data only in Secret Manager, never in environment variables
4. **Access Control**: Review and minimize IAM permissions regularly

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure service account has necessary roles
2. **API Not Enabled**: Enable all required APIs using `gcloud services enable`
3. **Docker Authentication**: Verify service account key path is correct
4. **Region/Zone Mismatch**: Ensure consistent region/zone configuration

### Useful Commands

```bash
# Check current project
gcloud config get-value project

# List enabled APIs
gcloud services list --enabled

# Check service accounts
gcloud iam service-accounts list

# View secrets
gcloud secrets list

# Check Cloud Run services
gcloud run services list
```

## Next Steps

After successful deployment:

1. Test the service health endpoint
2. Configure monitoring alerts
3. Set up CI/CD pipeline
4. Review security configurations
5. Implement backup strategies

For more information, see the main [README.md](../README.md) and [API_DOCUMENTATION.md](../API_DOCUMENTATION.md).