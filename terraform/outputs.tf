# Cloud Run service outputs
output "service_url" {
  description = "URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.last_hope.uri
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.last_hope.name
}

output "service_location" {
  description = "Location of the Cloud Run service"
  value       = google_cloud_run_v2_service.last_hope.location
}

# Artifact Registry outputs
output "docker_repository" {
  description = "Docker repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.last_hope.repository_id}"
}

output "docker_image" {
  description = "Full Docker image name"
  value       = docker_registry_image.last_hope.name
}

# Storage outputs
output "storage_bucket" {
  description = "Cloud Storage bucket for data and reports"
  value       = google_storage_bucket.last_hope_data.name
}

output "storage_bucket_url" {
  description = "Cloud Storage bucket URL"
  value       = google_storage_bucket.last_hope_data.url
}

# Secret Manager outputs
output "htx_secret_name" {
  description = "HTX API key secret name"
  value       = google_secret_manager_secret.htx_api_key.secret_id
}

output "htx_secret_secret_name" {
  description = "HTX API secret secret name"
  value       = google_secret_manager_secret.htx_api_secret.secret_id
}

output "openai_secret_name" {
  description = "OpenAI API key secret name"
  value       = google_secret_manager_secret.openai_api_key.secret_id
}

output "coingecko_secret_name" {
  description = "CoinGecko API key secret name"
  value       = google_secret_manager_secret.coingecko_api_key.secret_id
}

output "fernet_secret_name" {
  description = "Fernet encryption key secret name"
  value       = google_secret_manager_secret.fernet_key.secret_id
}

# Service Account outputs
output "service_account_email" {
  description = "Service account email for Cloud Run"
  value       = google_service_account.cloud_run.email
}

# Legacy outputs for compatibility
output "container_id" {
  description = "Legacy container ID (not applicable for Cloud Run)"
  value = "cloud-run-${google_cloud_run_v2_service.last_hope.name}"
}

output "url" {
  description = "Service URL (legacy format)"
  value = google_cloud_run_v2_service.last_hope.uri
}

# Health check and monitoring
output "health_check_url" {
  description = "Health check endpoint URL"
  value       = "${google_cloud_run_v2_service.last_hope.uri}/health"
}

output "access_instructions" {
  description = "Instructions for accessing the deployed service"
  value = <<-EOT
    🚀 Last Hope MCP Server deployed successfully!
    
    Service URL: ${google_cloud_run_v2_service.last_hope.uri}
    Health Check: ${google_cloud_run_v2_service.last_hope.uri}/health
    
    🔑 To set up API keys:
    1. Store HTX API key: echo "your-htx-api-key" | gcloud secrets versions add ${google_secret_manager_secret.htx_api_key.secret_id} --data-file=-
    2. Store HTX API secret: echo "your-htx-secret" | gcloud secrets versions add ${google_secret_manager_secret.htx_api_secret.secret_id} --data-file=-
    3. Store OpenAI API key: echo "your-openai-key" | gcloud secrets versions add ${google_secret_manager_secret.openai_api_key.secret_id} --data-file=-
    4. Store CoinGecko API key: echo "your-coingecko-key" | gcloud secrets versions add ${google_secret_manager_secret.coingecko_api_key.secret_id} --data-file=-
    5. Generate Fernet key: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" | gcloud secrets versions add ${google_secret_manager_secret.fernet_key.secret_id} --data-file=-
    
    📁 Data Storage: gs://${google_storage_bucket.last_hope_data.name}
    
    🔧 Quick test:
    curl ${google_cloud_run_v2_service.last_hope.uri}/health
  EOT
}
