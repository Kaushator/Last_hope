# Last Hope MCP Server - Deployment Checklist

This checklist ensures a smooth and secure deployment of the Last Hope MCP Server infrastructure on Google Cloud Platform.

## Pre-Deployment Checklist

### ✅ Prerequisites Verification

- [ ] **Google Cloud SDK installed and configured**
  ```bash
  gcloud version
  gcloud auth list
  gcloud config list
  ```

- [ ] **Terraform installed (>= 1.5)**
  ```bash
  terraform version
  ```

- [ ] **Docker installed and running**
  ```bash
  docker info
  ```

- [ ] **Make utility available (optional but recommended)**
  ```bash
  make --version
  ```

- [ ] **Python 3.7+ available (for testing scripts)**
  ```bash
  python3 --version
  ```

### ✅ GCP Project Setup

- [ ] **GCP Project created with billing enabled**
  ```bash
  gcloud projects list
  gcloud billing projects describe PROJECT_ID
  ```

- [ ] **Required APIs enabled**
  ```bash
  gcloud services enable cloudbuild.googleapis.com
  gcloud services enable run.googleapis.com
  gcloud services enable artifactregistry.googleapis.com
  gcloud services enable secretmanager.googleapis.com
  gcloud services enable monitoring.googleapis.com
  gcloud services enable logging.googleapis.com
  ```

- [ ] **Service account created with proper permissions**
  ```bash
  gcloud iam service-accounts list
  gcloud projects get-iam-policy PROJECT_ID
  ```

- [ ] **Service account key downloaded**
  ```bash
  ls -la service-account-key.json
  ```

### ✅ Configuration Setup

- [ ] **terraform.tfvars file created and configured**
  ```bash
  cp terraform.tfvars.example terraform.tfvars
  # Edit terraform.tfvars with your values
  ```

- [ ] **Environment-specific values set**
  - [ ] `project_id` - Your GCP project ID
  - [ ] `region` - Target GCP region (e.g., us-central1)
  - [ ] `environment` - Environment name (dev/staging/prod)
  - [ ] Resource limits appropriate for environment

- [ ] **Feature flags configured**
  - [ ] `enable_monitoring` - Set based on requirements
  - [ ] `enable_logging` - Set based on requirements
  - [ ] `enable_public_access` - Set based on security requirements

## Deployment Process

### ✅ Phase 1: Validation

- [ ] **Terraform configuration validation**
  ```bash
  terraform init
  terraform validate
  terraform fmt -check
  ```

- [ ] **Security scan (if tfsec available)**
  ```bash
  tfsec .
  ```

- [ ] **Python test suite**
  ```bash
  ./test_infrastructure.py --test=validate
  ```

### ✅ Phase 2: Planning

- [ ] **Terraform plan review**
  ```bash
  terraform plan -out=tfplan
  # Carefully review all planned changes
  ```

- [ ] **Resource count verification**
  - [ ] Expected number of resources to be created
  - [ ] No unexpected resource deletions
  - [ ] Resource naming follows conventions

- [ ] **Cost estimation review**
  - [ ] Estimated monthly costs within budget
  - [ ] Resource sizing appropriate for environment

### ✅ Phase 3: Deployment

- [ ] **Initial deployment**
  ```bash
  terraform apply tfplan
  # Or use: make deploy
  ```

- [ ] **Deployment output verification**
  - [ ] `service_url` - Cloud Run service URL obtained
  - [ ] `docker_repository` - Artifact Registry URL
  - [ ] `storage_bucket` - Cloud Storage bucket name
  - [ ] `service_account_email` - Service account created

- [ ] **Infrastructure validation**
  ```bash
  ./validate.sh test
  ```

### ✅ Phase 4: Secret Configuration

- [ ] **HTX API credentials configured**
  ```bash
  echo "YOUR_HTX_API_KEY" | gcloud secrets versions add htx-api-key-ENVIRONMENT --data-file=-
  echo "YOUR_HTX_SECRET" | gcloud secrets versions add htx-api-secret-ENVIRONMENT --data-file=-
  ```

- [ ] **OpenAI API key configured**
  ```bash
  echo "YOUR_OPENAI_KEY" | gcloud secrets versions add openai-api-key-ENVIRONMENT --data-file=-
  ```

- [ ] **CoinGecko API key configured**
  ```bash
  echo "YOUR_COINGECKO_KEY" | gcloud secrets versions add coingecko-api-key-ENVIRONMENT --data-file=-
  ```

- [ ] **Fernet encryption key generated**
  ```bash
  python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" | \
      gcloud secrets versions add fernet-encryption-key-ENVIRONMENT --data-file=-
  ```

- [ ] **Secret access verification**
  ```bash
  gcloud secrets list
  gcloud secrets versions list htx-api-key-ENVIRONMENT
  ```

## Post-Deployment Verification

### ✅ Service Health Checks

- [ ] **Basic connectivity test**
  ```bash
  curl -f $(terraform output -raw service_url)/health
  ```

- [ ] **Service response validation**
  ```bash
  ./validate.sh health
  ```

- [ ] **Comprehensive test suite**
  ```bash
  ./validate.sh test
  ```

### ✅ Monitoring Setup

- [ ] **Alert policies created and enabled**
  ```bash
  gcloud alpha monitoring policies list
  ```

- [ ] **Log sinks configured**
  ```bash
  gcloud logging sinks list
  ```

- [ ] **Monitoring dashboard accessible**
  ```bash
  # Check Cloud Console > Monitoring
  make monitoring
  ```

### ✅ Security Verification

- [ ] **IAM permissions audit**
  ```bash
  gcloud projects get-iam-policy PROJECT_ID
  gcloud run services get-iam-policy SERVICE_NAME --region=REGION
  ```

- [ ] **Secret access controls verified**
  ```bash
  gcloud secrets get-iam-policy SECRET_NAME
  ```

- [ ] **Network security validated**
  - [ ] HTTPS endpoints only
  - [ ] Proper ingress controls
  - [ ] No unnecessary public access

### ✅ Performance Baseline

- [ ] **Response time measurement**
  ```bash
  for i in {1..10}; do
    time curl -s $(terraform output -raw service_url)/health > /dev/null
  done
  ```

- [ ] **Load testing (optional for production)**
  ```bash
  # Use appropriate load testing tools
  # Monitor resource usage during tests
  ```

- [ ] **Scaling behavior verification**
  - [ ] Cold start performance acceptable
  - [ ] Auto-scaling triggers working
  - [ ] Resource limits appropriate

## Environment-Specific Checklists

### 🔧 Development Environment

- [ ] **Cost optimization settings**
  - [ ] `min_instances = 0` (scales to zero)
  - [ ] `max_instances = 3`
  - [ ] `cpu_limit = "500m"`
  - [ ] `memory_limit = "256Mi"`

- [ ] **Development-friendly configuration**
  - [ ] Detailed logging enabled
  - [ ] Debug endpoints accessible (if any)
  - [ ] Relaxed security for testing

### 🚀 Staging Environment

- [ ] **Production-like settings**
  - [ ] `min_instances = 1`
  - [ ] `max_instances = 5`
  - [ ] `cpu_limit = "1000m"`
  - [ ] `memory_limit = "512Mi"`

- [ ] **Pre-production validation**
  - [ ] All production APIs available
  - [ ] Monitoring fully configured
  - [ ] Security policies enforced

### 🏢 Production Environment

- [ ] **High availability configuration**
  - [ ] `min_instances = 2`
  - [ ] `max_instances = 10`
  - [ ] `cpu_limit = "2000m"`
  - [ ] `memory_limit = "1Gi"`

- [ ] **Production hardening**
  - [ ] All monitoring enabled
  - [ ] Comprehensive logging
  - [ ] Security alerts configured
  - [ ] Backup procedures in place

## Post-Deployment Tasks

### ✅ Documentation Updates

- [ ] **Deployment notes documented**
  - [ ] Service URLs recorded
  - [ ] Configuration choices documented
  - [ ] Any deviations from standard noted

- [ ] **Team notification**
  - [ ] Deployment announcement sent
  - [ ] Access information shared
  - [ ] Monitoring dashboard links provided

### ✅ Backup and Recovery

- [ ] **State file backed up**
  ```bash
  make backup-state
  ```

- [ ] **Recovery procedures tested**
  - [ ] State file restoration
  - [ ] Secret recreation
  - [ ] Service rollback procedures

### ✅ Monitoring Setup

- [ ] **Budget alerts configured**
  ```bash
  gcloud billing budgets create --display-name="Last Hope Budget"
  ```

- [ ] **Notification channels setup**
  - [ ] Email notifications
  - [ ] Slack/Teams integration (if required)
  - [ ] On-call rotation (for production)

## Rollback Procedures

### 🔄 If Deployment Fails

- [ ] **Immediate rollback steps**
  ```bash
  terraform destroy -auto-approve
  # Or restore from backup
  cp backup/terraform.tfstate.TIMESTAMP terraform.tfstate
  ```

- [ ] **Investigate failure**
  - [ ] Check Terraform logs
  - [ ] Review GCP error messages
  - [ ] Validate configuration

- [ ] **Fix and retry**
  - [ ] Address root cause
  - [ ] Update configuration
  - [ ] Re-run validation tests

### 🔄 If Service Issues Occur

- [ ] **Service-level rollback**
  ```bash
  gcloud run services update-traffic SERVICE_NAME \
      --to-revisions=PREVIOUS_REVISION=100
  ```

- [ ] **Resource-level fixes**
  ```bash
  terraform taint RESOURCE_NAME
  terraform apply
  ```

## Sign-off Checklist

### ✅ Technical Sign-off

- [ ] **Lead Developer approval**
  - [ ] Code review completed
  - [ ] Architecture approved
  - [ ] Security review passed

- [ ] **DevOps approval**
  - [ ] Infrastructure validated
  - [ ] Monitoring configured
  - [ ] Backup procedures in place

### ✅ Business Sign-off

- [ ] **Stakeholder approval**
  - [ ] Functionality validated
  - [ ] Performance acceptable
  - [ ] Cost within budget

- [ ] **Go-live authorization**
  - [ ] Final deployment approved
  - [ ] Support procedures in place
  - [ ] Rollback plan ready

## Environment Deployment Matrix

| Requirement | Dev | Staging | Prod |
|-------------|-----|---------|------|
| Min Instances | 0 | 1 | 2 |
| Max Instances | 3 | 5 | 10 |
| CPU Limit | 500m | 1000m | 2000m |
| Memory Limit | 256Mi | 512Mi | 1Gi |
| Monitoring | Basic | Full | Full |
| Logging | Debug | Info | Info |
| Alerts | None | Some | All |
| Backup | None | Weekly | Daily |

## Deployment Timeline

### Typical Deployment Duration

- **Prerequisites**: 30-60 minutes (first time)
- **Configuration**: 15-30 minutes
- **Deployment**: 10-20 minutes
- **Validation**: 15-30 minutes
- **Secret Setup**: 10-15 minutes
- **Documentation**: 15-30 minutes

**Total: 1.5-3 hours** (including preparation and validation)

## Emergency Contacts

### Key Personnel

- **Technical Lead**: [Name] - [Contact]
- **DevOps Engineer**: [Name] - [Contact]
- **Project Manager**: [Name] - [Contact]

### Support Resources

- **GCP Support**: [Support Case Process]
- **Internal Documentation**: [Wiki/Confluence Links]
- **Monitoring Dashboards**: [Dashboard URLs]

---

**Remember**: This checklist should be customized for your specific organization's processes and requirements. Always test deployment procedures in a non-production environment first!