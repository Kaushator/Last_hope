# Last Hope MCP Server - Troubleshooting Guide

This guide provides solutions for common issues encountered when deploying and managing the Last Hope MCP Server infrastructure on Google Cloud Platform.

## Table of Contents

1. [Pre-deployment Issues](#pre-deployment-issues)
2. [Deployment Issues](#deployment-issues)
3. [Runtime Issues](#runtime-issues)
4. [Performance Issues](#performance-issues)
5. [Security Issues](#security-issues)
6. [Monitoring and Logging Issues](#monitoring-and-logging-issues)
7. [Cost and Billing Issues](#cost-and-billing-issues)
8. [Recovery Procedures](#recovery-procedures)

## Pre-deployment Issues

### Issue: "gcloud command not found"

**Symptoms:**
```
bash: gcloud: command not found
```

**Solution:**
1. Install Google Cloud SDK:
   ```bash
   # Ubuntu/Debian
   curl https://sdk.cloud.google.com | bash
   source ~/.bashrc
   
   # macOS with Homebrew
   brew install google-cloud-sdk
   
   # Windows
   # Download from https://cloud.google.com/sdk/docs/install
   ```

2. Initialize gcloud:
   ```bash
   gcloud init
   gcloud auth login
   ```

### Issue: "terraform command not found"

**Symptoms:**
```
bash: terraform: command not found
```

**Solution:**
1. Install Terraform:
   ```bash
   # Ubuntu/Debian
   wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install terraform
   
   # macOS with Homebrew
   brew install terraform
   
   # Windows with Chocolatey
   choco install terraform
   ```

### Issue: "Service account key file not found"

**Symptoms:**
```
Error: open service-account-key.json: no such file or directory
```

**Solution:**
1. Create service account and download key:
   ```bash
   # Create service account
   gcloud iam service-accounts create terraform-last-hope \
       --display-name="Terraform Last Hope"
   
   # Grant permissions
   gcloud projects add-iam-policy-binding PROJECT_ID \
       --member="serviceAccount:terraform-last-hope@PROJECT_ID.iam.gserviceaccount.com" \
       --role="roles/editor"
   
   # Create and download key
   gcloud iam service-accounts keys create service-account-key.json \
       --iam-account=terraform-last-hope@PROJECT_ID.iam.gserviceaccount.com
   ```

2. Verify file exists:
   ```bash
   ls -la service-account-key.json
   ```

### Issue: "terraform.tfvars not found"

**Symptoms:**
```
Error: terraform.tfvars file not found
```

**Solution:**
1. Copy example file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit with your values:
   ```bash
   nano terraform.tfvars
   ```

## Deployment Issues

### Issue: "API not enabled" errors

**Symptoms:**
```
Error: Error creating service: googleapi: Error 403: Cloud Run API has not been used
```

**Solution:**
1. Enable required APIs:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable monitoring.googleapis.com
   gcloud services enable logging.googleapis.com
   ```

2. Wait for APIs to be fully enabled (can take 2-3 minutes):
   ```bash
   gcloud services list --enabled
   ```

### Issue: "Insufficient permissions" errors

**Symptoms:**
```
Error: googleapi: Error 403: The caller does not have permission
```

**Solution:**
1. Check current permissions:
   ```bash
   gcloud projects get-iam-policy PROJECT_ID
   ```

2. Add missing roles:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
       --member="serviceAccount:terraform-last-hope@PROJECT_ID.iam.gserviceaccount.com" \
       --role="roles/artifactregistry.admin"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
       --member="serviceAccount:terraform-last-hope@PROJECT_ID.iam.gserviceaccount.com" \
       --role="roles/run.admin"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
       --member="serviceAccount:terraform-last-hope@PROJECT_ID.iam.gserviceaccount.com" \
       --role="roles/secretmanager.admin"
   ```

### Issue: Docker build failures

**Symptoms:**
```
Error: Error building image: failed to build context
```

**Solution:**
1. Configure Docker authentication:
   ```bash
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```

2. Check Docker daemon:
   ```bash
   docker info
   sudo systemctl start docker  # Linux
   # or restart Docker Desktop on macOS/Windows
   ```

3. Verify build context:
   ```bash
   ls -la ../Dockerfile
   ls -la ../src/
   ```

### Issue: "Resource already exists" errors

**Symptoms:**
```
Error: Error creating repository: googleapi: Error 409: Repository already exists
```

**Solution:**
1. Import existing resource:
   ```bash
   terraform import google_artifact_registry_repository.last_hope \
       projects/PROJECT_ID/locations/REGION/repositories/REPO_NAME
   ```

2. Or destroy and recreate:
   ```bash
   terraform destroy -target=google_artifact_registry_repository.last_hope
   terraform apply
   ```

### Issue: Terraform state lock errors

**Symptoms:**
```
Error: Error acquiring the state lock
```

**Solution:**
1. Force unlock (use with caution):
   ```bash
   terraform force-unlock LOCK_ID
   ```

2. Or wait for lock to expire (usually 20 minutes)

3. Check for running Terraform processes:
   ```bash
   ps aux | grep terraform
   kill -9 PID  # if necessary
   ```

## Runtime Issues

### Issue: Service returns 5xx errors

**Symptoms:**
- Cloud Run service returns 500/502/503 errors
- Health checks failing

**Solution:**
1. Check service logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" \
       --limit=50 --format="table(timestamp,severity,textPayload)"
   ```

2. Verify secrets are properly set:
   ```bash
   gcloud secrets list
   gcloud secrets versions access latest --secret="htx-api-key-dev"
   ```

3. Check service configuration:
   ```bash
   gcloud run services describe last-hope-mcp-server-dev --region=us-central1
   ```

4. Restart service:
   ```bash
   gcloud run services update last-hope-mcp-server-dev \
       --region=us-central1 --revision-suffix=restart-$(date +%s)
   ```

### Issue: "Service Unavailable" errors

**Symptoms:**
```
curl: (7) Failed to connect to service
```

**Solution:**
1. Check service status:
   ```bash
   gcloud run services list
   ```

2. Verify service URL:
   ```bash
   terraform output service_url
   ```

3. Check ingress settings:
   ```bash
   gcloud run services describe SERVICE_NAME --region=REGION \
       --format="value(spec.traffic[0].url,spec.template.metadata.annotations)"
   ```

4. Test with gcloud:
   ```bash
   gcloud run services proxy SERVICE_NAME --port=8080
   curl http://localhost:8080/health
   ```

### Issue: Cold start timeouts

**Symptoms:**
- First requests after idle period timeout
- Startup probe failures

**Solution:**
1. Increase startup probe timeout:
   ```bash
   # Update in main.tf
   startup_probe {
     initial_delay_seconds = 30  # Increase from 10
     timeout_seconds       = 10  # Increase from 3
   }
   ```

2. Set minimum instances:
   ```bash
   # In terraform.tfvars
   min_instances = 1  # Prevent scale-to-zero
   ```

3. Optimize application startup:
   - Pre-warm caches
   - Lazy load heavy dependencies
   - Use startup hooks

### Issue: Memory or CPU limits exceeded

**Symptoms:**
```
Error: Container killed due to memory limit
```

**Solution:**
1. Check current resource usage:
   ```bash
   gcloud monitoring metrics list --filter="metric.type=run.googleapis.com"
   ```

2. Increase resource limits:
   ```bash
   # In terraform.tfvars
   cpu_limit = "2000m"      # Increase CPU
   memory_limit = "1Gi"     # Increase memory
   ```

3. Apply changes:
   ```bash
   terraform apply
   ```

## Performance Issues

### Issue: High response times

**Symptoms:**
- Requests taking >5 seconds
- High latency alerts

**Solution:**
1. Check monitoring dashboard:
   ```bash
   make monitoring
   ```

2. Analyze request patterns:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND httpRequest.status>=200" \
       --format="table(timestamp,httpRequest.requestUrl,httpRequest.latency)"
   ```

3. Optimize configuration:
   ```bash
   # Increase concurrency
   max_request_concurrency = 200
   
   # Add more instances
   max_instances = 20
   ```

4. Profile application:
   - Enable application profiling
   - Identify bottlenecks
   - Optimize database queries

### Issue: High error rates

**Symptoms:**
- Error rate >5%
- Monitoring alerts firing

**Solution:**
1. Analyze error logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
       --limit=100
   ```

2. Check common error patterns:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" \
       --format="table(timestamp,severity,textPayload)" | grep -i "error\|exception\|failed"
   ```

3. Review application code:
   - Add error handling
   - Implement retry logic
   - Validate inputs

### Issue: Scaling problems

**Symptoms:**
- Service not scaling up under load
- Instances stuck at minimum

**Solution:**
1. Check scaling configuration:
   ```bash
   gcloud run services describe SERVICE_NAME --region=REGION \
       --format="value(spec.template.metadata.annotations.autoscaling)"
   ```

2. Adjust scaling parameters:
   ```bash
   # In main.tf
   scaling {
     min_instance_count = 2
     max_instance_count = 50
   }
   
   max_instance_request_concurrency = 80  # Lower for faster scaling
   ```

3. Monitor scaling events:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.message=~'scaling'" \
       --limit=50
   ```

## Security Issues

### Issue: Secret access denied

**Symptoms:**
```
Error: Permission denied accessing secret
```

**Solution:**
1. Check secret IAM bindings:
   ```bash
   gcloud secrets get-iam-policy SECRET_NAME
   ```

2. Add service account access:
   ```bash
   gcloud secrets add-iam-policy-binding SECRET_NAME \
       --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
       --role="roles/secretmanager.secretAccessor"
   ```

3. Verify secret exists:
   ```bash
   gcloud secrets list
   gcloud secrets versions list SECRET_NAME
   ```

### Issue: Unauthorized access to service

**Symptoms:**
```
Error 403: Forbidden
```

**Solution:**
1. Check IAM policy for Cloud Run:
   ```bash
   gcloud run services get-iam-policy SERVICE_NAME --region=REGION
   ```

2. Add public access (if intended):
   ```bash
   gcloud run services add-iam-policy-binding SERVICE_NAME \
       --region=REGION \
       --member="allUsers" \
       --role="roles/run.invoker"
   ```

3. Or configure authenticated access:
   ```bash
   gcloud run services add-iam-policy-binding SERVICE_NAME \
       --region=REGION \
       --member="user:user@example.com" \
       --role="roles/run.invoker"
   ```

### Issue: SSL/TLS certificate problems

**Symptoms:**
```
curl: (60) SSL certificate problem
```

**Solution:**
1. Verify service URL uses HTTPS:
   ```bash
   terraform output service_url
   ```

2. Check certificate validity:
   ```bash
   openssl s_client -connect YOUR_SERVICE_URL:443 -servername YOUR_SERVICE_URL
   ```

3. Cloud Run automatically provides valid certificates for *.run.app domains

## Monitoring and Logging Issues

### Issue: Logs not appearing

**Symptoms:**
- No logs in Cloud Logging
- Log sink not working

**Solution:**
1. Check log sink configuration:
   ```bash
   gcloud logging sinks list
   gcloud logging sinks describe SINK_NAME
   ```

2. Verify log sink permissions:
   ```bash
   gcloud logging sinks describe SINK_NAME --format="value(writerIdentity)"
   gsutil iam get gs://BUCKET_NAME
   ```

3. Test logging manually:
   ```bash
   gcloud logging write test-log "Test message" --severity=INFO
   ```

### Issue: Monitoring alerts not firing

**Symptoms:**
- No alerts despite issues
- Alert policies not working

**Solution:**
1. Check alert policies:
   ```bash
   gcloud alpha monitoring policies list
   ```

2. Verify alert policy conditions:
   ```bash
   gcloud alpha monitoring policies describe POLICY_ID
   ```

3. Test alert conditions:
   - Generate test errors
   - Verify metrics are being collected
   - Check notification channels

### Issue: Metrics not collected

**Symptoms:**
- Empty monitoring dashboards
- No metric data

**Solution:**
1. Check service account permissions:
   ```bash
   gcloud projects get-iam-policy PROJECT_ID | grep monitoring
   ```

2. Verify monitoring API is enabled:
   ```bash
   gcloud services list --enabled | grep monitoring
   ```

3. Check metric filters:
   ```bash
   gcloud logging metrics list
   ```

## Cost and Billing Issues

### Issue: Unexpected high costs

**Symptoms:**
- Higher than expected GCP bills
- Cost alerts firing

**Solution:**
1. Analyze costs by service:
   ```bash
   gcloud billing budgets list
   gcloud billing accounts list
   ```

2. Check resource usage:
   ```bash
   # Cloud Run costs
   gcloud run services list --format="table(name,status.url,status.traffic[0].percent)"
   
   # Storage costs
   gsutil du -sh gs://BUCKET_NAME
   
   # Secret Manager costs
   gcloud secrets list --format="table(name,createTime)"
   ```

3. Optimize resources:
   - Reduce minimum instances for dev/staging
   - Implement log retention policies
   - Clean up unused resources

### Issue: Budget alerts not working

**Symptoms:**
- No budget notifications
- Costs exceeding limits

**Solution:**
1. Create budget alerts:
   ```bash
   gcloud billing budgets create \
       --billing-account=BILLING_ACCOUNT_ID \
       --display-name="Last Hope Budget" \
       --budget-amount=100USD
   ```

2. Set up notifications:
   ```bash
   gcloud billing budgets update BUDGET_ID \
       --add-threshold-rule=percent=50,basis=current-spend \
       --add-threshold-rule=percent=90,basis=current-spend
   ```

## Recovery Procedures

### Complete Infrastructure Recovery

If infrastructure is completely lost or corrupted:

1. **Backup Recovery:**
   ```bash
   # Restore from backup if available
   cp backup/terraform.tfstate.TIMESTAMP terraform.tfstate
   terraform plan  # Verify state
   ```

2. **Fresh Deployment:**
   ```bash
   # Clean slate deployment
   rm -rf .terraform/ terraform.tfstate*
   terraform init
   terraform plan
   terraform apply
   ```

3. **Data Recovery:**
   ```bash
   # Restore from Cloud Storage backup
   gsutil cp gs://backup-bucket/data/* gs://production-bucket/
   
   # Recreate secrets
   ./deploy.sh secrets
   ```

### Service Recovery

If just the Cloud Run service is problematic:

1. **Force redeploy:**
   ```bash
   terraform taint google_cloud_run_v2_service.last_hope
   terraform apply
   ```

2. **Roll back to previous revision:**
   ```bash
   gcloud run services update-traffic SERVICE_NAME \
       --to-revisions=PREVIOUS_REVISION=100 \
       --region=REGION
   ```

### State File Recovery

If Terraform state is corrupted:

1. **Import existing resources:**
   ```bash
   terraform import google_cloud_run_v2_service.last_hope \
       projects/PROJECT_ID/locations/REGION/services/SERVICE_NAME
   ```

2. **Recreate state from scratch:**
   ```bash
   rm terraform.tfstate*
   terraform init
   # Import all existing resources one by one
   ```

## Getting Additional Help

### Debug Information Collection

When seeking help, collect this information:

```bash
# System info
terraform version
gcloud version
docker version

# Project info
gcloud config list
gcloud projects describe PROJECT_ID

# Service info
terraform output
gcloud run services list
gcloud secrets list

# Recent logs
gcloud logging read "resource.type=cloud_run_revision" --limit=20
```

### Support Channels

1. **Documentation**: Check README.md and setup guides
2. **Validation**: Run `./validate.sh test` for automated diagnosis
3. **Logs**: Use `make logs` for detailed service logs
4. **Community**: GitHub issues for project-specific problems
5. **GCP Support**: For platform-related issues

### Emergency Procedures

For critical production issues:

1. **Immediate Response:**
   ```bash
   # Check service status
   make validate
   
   # Scale up if needed
   gcloud run services update SERVICE_NAME --max-instances=20
   
   # Check for ongoing incidents
   gcloud status
   ```

2. **Escalation:**
   - Contact on-call engineer
   - Create incident ticket
   - Implement temporary workarounds

3. **Communication:**
   - Update status page
   - Notify stakeholders
   - Document timeline

Remember: Always test recovery procedures in a non-production environment first!