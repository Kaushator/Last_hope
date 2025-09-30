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
  account_id   = "last-hope-cloud-run"
  display_name = "Last Hope Cloud Run Service Account"
  description  = "Service account for Last Hope MCP Server on Cloud Run"
}

# IAM bindings for service account
resource "google_project_iam_member" "cloud_run_permissions" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectViewer",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Secret Manager for API keys
resource "google_secret_manager_secret" "htx_api_key" {
  secret_id = "htx-api-key"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "fernet_key" {
  secret_id = "fernet-encryption-key"
  
  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Cloud Storage bucket for reports and data
resource "google_storage_bucket" "last_hope_data" {
  name          = "${var.project_id}-last-hope-data"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
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
  
  name     = "last-hope-mcp-server"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email
    
    max_instance_request_concurrency = 100
    timeout                          = "300s"
    
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
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
          cpu    = var.cpu_limit
          memory = var.memory_limit
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

# Allow unauthenticated access to Cloud Run service
resource "google_cloud_run_service_iam_member" "allow_unauthenticated" {
  service  = google_cloud_run_v2_service.last_hope.name
  location = google_cloud_run_v2_service.last_hope.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Monitoring alerts
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "Last Hope - High Error Rate"
  combiner     = "OR"
  
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

  depends_on = [google_project_service.apis]
}

# Cloud Logging sink
resource "google_logging_project_sink" "last_hope_logs" {
  name        = "last-hope-logs"
  destination = "storage.googleapis.com/${google_storage_bucket.last_hope_data.name}"
  filter      = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${google_cloud_run_v2_service.last_hope.name}\""

  unique_writer_identity = true
}

# Grant the sink writer access to the bucket
resource "google_storage_bucket_iam_member" "log_sink" {
  bucket = google_storage_bucket.last_hope_data.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.last_hope_logs.writer_identity
}
