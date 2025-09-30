# GCP Project Configuration
variable "project_id" {
  description = "The GCP project ID"
  type        = string
  validation {
    condition     = length(var.project_id) > 0
    error_message = "Project ID must not be empty."
  }
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
  validation {
    condition = contains([
      "us-central1", "us-east1", "us-west1", "us-west2",
      "europe-west1", "europe-west2", "europe-central2",
      "asia-east1", "asia-southeast1", "asia-northeast1"
    ], var.region)
    error_message = "Region must be a valid GCP region."
  }
}

variable "zone" {
  description = "The GCP zone for resources"
  type        = string
  default     = "us-central1-a"
}

# Infrastructure Configuration
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "deployment_name" {
  description = "Custom deployment name (optional)"
  type        = string
  default     = ""
}

# Cloud Run Configuration
variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
  validation {
    condition     = var.min_instances >= 0 && var.min_instances <= 100
    error_message = "Min instances must be between 0 and 100."
  }
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 1000
    error_message = "Max instances must be between 1 and 1000."
  }
}

variable "cpu_limit" {
  description = "CPU limit for Cloud Run instances (e.g., 500m, 1000m, 2000m)"
  type        = string
  default     = "1000m"
  validation {
    condition     = can(regex("^[0-9]+m$", var.cpu_limit))
    error_message = "CPU limit must be in millicores format (e.g., 500m, 1000m)."
  }
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run instances (e.g., 256Mi, 512Mi, 1Gi)"
  type        = string
  default     = "512Mi"
  validation {
    condition     = can(regex("^[0-9]+(Mi|Gi)$", var.memory_limit))
    error_message = "Memory limit must be in Mi or Gi format (e.g., 256Mi, 1Gi)."
  }
}

variable "cpu_idle" {
  description = "CPU allocation when idle"
  type        = bool
  default     = true
}

variable "request_timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
  validation {
    condition     = var.request_timeout >= 1 && var.request_timeout <= 3600
    error_message = "Request timeout must be between 1 and 3600 seconds."
  }
}

variable "max_request_concurrency" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 100
  validation {
    condition     = var.max_request_concurrency >= 1 && var.max_request_concurrency <= 1000
    error_message = "Max request concurrency must be between 1 and 1000."
  }
}

# Security Configuration
variable "service_account_key_file" {
  description = "Path to service account key file for Docker registry authentication"
  type        = string
  default     = "./service-account-key.json"
}

# Feature Flags
variable "enable_monitoring" {
  description = "Enable Cloud Monitoring and alerting (recommended for production)"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable structured logging to Cloud Storage (recommended for production)"
  type        = bool
  default     = true
}

variable "enable_secrets" {
  description = "Enable Secret Manager for API keys (always recommended)"
  type        = bool
  default     = true
}

variable "enable_cors" {
  description = "Enable CORS on storage bucket"
  type        = bool
  default     = true
}

variable "enable_versioning" {
  description = "Enable versioning on storage bucket"
  type        = bool
  default     = true
}

variable "enable_public_access" {
  description = "Allow unauthenticated access to Cloud Run service"
  type        = bool
  default     = true
}

# Legacy variable for compatibility
variable "repo" {
  type        = string
  description = "GitHub repo path user/repo (legacy)"
  default     = "unknown/last-hope"
}
