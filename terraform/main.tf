terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "htx-analytics-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Variables
variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "containerregistry.googleapis.com",
    "compute.googleapis.com"
  ])
  
  service = each.key
  
  disable_dependent_services = false
}

# Secret Manager for sensitive data
resource "google_secret_manager_secret" "htx_api_key" {
  secret_id = "htx-api-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "htx_secret_key" {
  secret_id = "htx-secret-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# Service account for the application
resource "google_service_account" "htx_analytics" {
  account_id   = "htx-analytics"
  display_name = "HTX Analytics Service Account"
  description  = "Service account for HTX Analytics application"
}

# Grant Secret Manager access
resource "google_secret_manager_secret_iam_member" "htx_api_key_accessor" {
  secret_id = google_secret_manager_secret.htx_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.htx_analytics.email}"
}

resource "google_secret_manager_secret_iam_member" "htx_secret_key_accessor" {
  secret_id = google_secret_manager_secret.htx_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.htx_analytics.email}"
}

# Cloud Storage bucket for data and backups
resource "google_storage_bucket" "data_bucket" {
  name          = "${var.project_id}-htx-analytics-data"
  location      = var.region
  force_destroy = false
  
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
}

# Grant storage access
resource "google_storage_bucket_iam_member" "data_bucket_admin" {
  bucket = google_storage_bucket.data_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.htx_analytics.email}"
}

# Cloud Run service for the application
resource "google_cloud_run_service" "htx_analytics" {
  name     = "htx-analytics"
  location = var.region
  
  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "10"
        "run.googleapis.com/cpu-throttling" = "false"
      }
    }
    
    spec {
      container_concurrency = 80
      timeout_seconds      = 300
      service_account_name = google_service_account.htx_analytics.email
      
      containers {
        image = "gcr.io/${var.project_id}/htx-analytics:latest"
        
        ports {
          container_port = 3000
        }
        
        resources {
          limits = {
            cpu    = "2000m"
            memory = "2Gi"
          }
          requests = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
        
        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }
        
        env {
          name = "HTX_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.htx_api_key.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "HTX_SECRET_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.htx_secret_key.secret_id
              key  = "latest"
            }
          }
        }
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# Allow unauthenticated access (adjust as needed for production)
resource "google_cloud_run_service_iam_member" "allUsers" {
  service  = google_cloud_run_service.htx_analytics.name
  location = google_cloud_run_service.htx_analytics.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_url" {
  value       = google_cloud_run_service.htx_analytics.status[0].url
  description = "The URL of the deployed Cloud Run service"
}

output "service_account_email" {
  value       = google_service_account.htx_analytics.email
  description = "The email of the service account"
}

output "data_bucket_name" {
  value       = google_storage_bucket.data_bucket.name
  description = "The name of the data storage bucket"
}