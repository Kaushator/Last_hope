# Last Hope MCP Server - GCP Infrastructure
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "docker" {
  registry_auth {
    address  = "${var.region}-docker.pkg.dev"
    username = "_json_key"
    password = file(var.service_account_key_file)
  }
}

# Environment-specific configuration
locals {
  # Environment-specific settings
  env_config = {
    dev = {
      min_instances = 0
      max_instances = 3
      cpu_limit     = "500m"
      memory_limit  = "256Mi"
      log_retention_days = 30
    }
    staging = {
      min_instances = 1
      max_instances = 5
      cpu_limit     = "1000m"
      memory_limit  = "512Mi"
      log_retention_days = 60
    }
    prod = {
      min_instances = 2
      max_instances = 10
      cpu_limit     = "2000m"
      memory_limit  = "1Gi"
      log_retention_days = 90
    }
  }
  
  # Use environment-specific config or variable overrides
  effective_min_instances = var.min_instances != 0 ? var.min_instances : local.env_config[var.environment].min_instances
  effective_max_instances = var.max_instances != 10 ? var.max_instances : local.env_config[var.environment].max_instances
  effective_cpu_limit     = var.cpu_limit != "1000m" ? var.cpu_limit : local.env_config[var.environment].cpu_limit
  effective_memory_limit  = var.memory_limit != "512Mi" ? var.memory_limit : local.env_config[var.environment].memory_limit
  
  # Deployment naming
  deployment_suffix = var.deployment_name != "" ? "-${var.deployment_name}" : ""
  service_name     = "last-hope-mcp-server${local.deployment_suffix}"
  
  # Common labels
  common_labels = {
    environment = var.environment
    project     = "last-hope"
    managed_by  = "terraform"
  }
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "secretmanager.googleapis.com"
  ])

  project = var.project_id
  service = each.value

  disable_dependent_services = false
  disable_on_destroy         = false
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "last_hope" {
  provider = google-beta
  
  location      = var.region
  repository_id = "last-hope"
  description   = "Last Hope MCP Server container images"
  format        = "DOCKER"

  docker_config {
    immutable_tags = false
  }

  depends_on = [google_project_service.apis]
}

# IAM Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "last-hope-cloud-run-${var.environment}"
  display_name = "Last Hope Cloud Run Service Account (${var.environment})"
  description  = "Service account for Last Hope MCP Server on Cloud Run - ${var.environment} environment"
}

# IAM Service Account for Terraform operations
resource "google_service_account" "terraform" {
  account_id   = "last-hope-terraform-${var.environment}"
  display_name = "Last Hope Terraform Service Account (${var.environment})"
  description  = "Service account for Terraform operations - ${var.environment} environment"
}

# IAM bindings for Cloud Run service account
resource "google_project_iam_member" "cloud_run_permissions" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter",
    "roles/cloudtrace.agent",
    "roles/cloudsql.client"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Additional IAM bindings for enhanced security
resource "google_secret_manager_secret_iam_member" "htx_api_key_access" {
  secret_id = google_secret_manager_secret.htx_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret_iam_member" "htx_api_secret_access" {
  secret_id = google_secret_manager_secret.htx_api_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret_iam_member" "openai_api_key_access" {
  secret_id = google_secret_manager_secret.openai_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret_iam_member" "coingecko_api_key_access" {
  secret_id = google_secret_manager_secret.coingecko_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret_iam_member" "fernet_key_access" {
  secret_id = google_secret_manager_secret.fernet_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Secret Manager for API keys and configuration
resource "google_secret_manager_secret" "htx_api_key" {
  secret_id = "htx-api-key-${var.environment}"
  
  labels = local.common_labels
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "htx_api_secret" {
  secret_id = "htx-api-secret-${var.environment}"
  
  labels = local.common_labels
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "openai-api-key-${var.environment}"
  
  labels = local.common_labels
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "coingecko_api_key" {
  secret_id = "coingecko-api-key-${var.environment}"
  
  labels = local.common_labels
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "fernet_key" {
  secret_id = "fernet-encryption-key-${var.environment}"
  
  labels = local.common_labels
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Cloud Storage bucket for reports and data
resource "google_storage_bucket" "last_hope_data" {
  name          = "${var.project_id}-last-hope-data-${var.environment}"
  location      = var.region
  force_destroy = var.environment != "prod"
  
  labels = local.common_labels

  uniform_bucket_level_access = true

  versioning {
    enabled = var.enable_versioning
  }

  lifecycle_rule {
    condition {
      age = local.env_config[var.environment].log_retention_days
    }
    action {
      type = "Delete"
    }
  }

  dynamic "cors" {
    for_each = var.enable_cors ? [1] : []
    content {
      origin          = ["*"]
      method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
      response_header = ["*"]
      max_age_seconds = 3600
    }
  }
}

# IAM for storage bucket
resource "google_storage_bucket_iam_member" "cloud_run_storage" {
  bucket = google_storage_bucket.last_hope_data.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Build Docker image
resource "docker_image" "last_hope" {
  name = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.last_hope.repository_id}/last-hope:${var.image_tag}"
  
  build {
    context = ".."
    dockerfile = "../Dockerfile"
    target = "production"
    
    tag = [
      "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.last_hope.repository_id}/last-hope:${var.image_tag}",
      "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.last_hope.repository_id}/last-hope:latest"
    ]
  }

  triggers = {
    dir_sha1 = sha1(join("", [for f in fileset(path.module, "../src/**") : filesha1(f)]))
  }

  depends_on = [google_artifact_registry_repository.last_hope]
}

# Push image to Artifact Registry
resource "docker_registry_image" "last_hope" {
  name = docker_image.last_hope.name
  
  depends_on = [docker_image.last_hope]
}

# Cloud Run service
resource "google_cloud_run_v2_service" "last_hope" {
  provider = google-beta
  
  name     = local.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  
  labels = local.common_labels

  template {
    service_account = google_service_account.cloud_run.email
    
    labels = local.common_labels
    
    max_instance_request_concurrency = var.max_request_concurrency
    timeout                          = "${var.request_timeout}s"
    
    scaling {
      min_instance_count = local.effective_min_instances
      max_instance_count = local.effective_max_instances
    }

    containers {
      image = docker_registry_image.last_hope.name
      
      ports {
        container_port = 4000
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }
      
      env {
        name  = "ENABLE_HTX_API"
        value = "true"
      }
      
      env {
        name  = "ENABLE_FINGPT"
        value = "true"
      }
      
      env {
        name  = "ENABLE_GCS"
        value = "true"
      }
      
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.last_hope_data.name
      }

      env {
        name = "HTX_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.htx_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "HTX_API_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.htx_api_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openai_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "COINGECKO_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.coingecko_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "FERNET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.fernet_key.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = local.effective_cpu_limit
          memory = local.effective_memory_limit
        }
        
        cpu_idle = var.cpu_idle
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 4000
        }
        initial_delay_seconds = 10
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 4000
        }
        initial_delay_seconds = 30
        timeout_seconds       = 3
        period_seconds        = 30
        failure_threshold     = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [docker_registry_image.last_hope]
}

# Allow unauthenticated access to Cloud Run service (conditional)
resource "google_cloud_run_service_iam_member" "allow_unauthenticated" {
  count = var.enable_public_access ? 1 : 0
  
  service  = google_cloud_run_v2_service.last_hope.name
  location = google_cloud_run_v2_service.last_hope.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Monitoring alerts and policies
resource "google_monitoring_alert_policy" "high_error_rate" {
  count = var.enable_monitoring ? 1 : 0
  
  display_name = "Last Hope (${var.environment}) - High Error Rate"
  combiner     = "OR"
  enabled      = true
  
  conditions {
    display_name = "Error rate above 5%"
    
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.05
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = []
  
  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# High response time alert
resource "google_monitoring_alert_policy" "high_response_time" {
  count = var.enable_monitoring ? 1 : 0
  
  display_name = "Last Hope (${var.environment}) - High Response Time"
  combiner     = "OR"
  enabled      = true
  
  conditions {
    display_name = "Response time above 5 seconds"
    
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 5000
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }
  
  notification_channels = []
  
  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# High CPU utilization alert
resource "google_monitoring_alert_policy" "high_cpu_utilization" {
  count = var.enable_monitoring ? 1 : 0
  
  display_name = "Last Hope (${var.environment}) - High CPU Utilization"
  combiner     = "OR"
  enabled      = true
  
  conditions {
    display_name = "CPU utilization above 80%"
    
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.8
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }
  
  notification_channels = []
  
  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# Memory utilization alert
resource "google_monitoring_alert_policy" "high_memory_utilization" {
  count = var.enable_monitoring ? 1 : 0
  
  display_name = "Last Hope (${var.environment}) - High Memory Utilization"
  combiner     = "OR"
  enabled      = true
  
  conditions {
    display_name = "Memory utilization above 80%"
    
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = 0.8
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }
  
  notification_channels = []
  
  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
    auto_close = "1800s"
  }

  depends_on = [google_project_service.apis]
}

# Cloud Logging configuration
resource "google_logging_project_sink" "last_hope_logs" {
  count = var.enable_logging ? 1 : 0
  
  name        = "last-hope-logs-${var.environment}"
  destination = "storage.googleapis.com/${google_storage_bucket.last_hope_data.name}"
  filter      = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\""

  unique_writer_identity = true
  
  # Include request logs, error logs, and custom application logs
  exclusions {
    name   = "exclude-debug-logs"
    filter = "severity<\"INFO\""
  }
  
  exclusions {
    name   = "exclude-health-checks"
    filter = "httpRequest.requestUrl=~\"/health\""
  }
}

# Grant the sink writer access to the bucket
resource "google_storage_bucket_iam_member" "log_sink" {
  count = var.enable_logging ? 1 : 0
  
  bucket = google_storage_bucket.last_hope_data.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.last_hope_logs[0].writer_identity
}

# Error reporting sink
resource "google_logging_project_sink" "last_hope_error_logs" {
  count = var.enable_logging ? 1 : 0
  
  name        = "last-hope-error-logs-${var.environment}"
  destination = "storage.googleapis.com/${google_storage_bucket.last_hope_data.name}/errors"
  filter      = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\" AND severity>=\"ERROR\""

  unique_writer_identity = true
}

# Grant the error sink writer access to the bucket
resource "google_storage_bucket_iam_member" "error_log_sink" {
  count = var.enable_logging ? 1 : 0
  
  bucket = google_storage_bucket.last_hope_data.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.last_hope_error_logs[0].writer_identity
}
