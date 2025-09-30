# GCP Project Configuration
variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
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
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

# Cloud Run Configuration
variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cpu_limit" {
  description = "CPU limit for Cloud Run instances"
  type        = string
  default     = "1000m"
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run instances"
  type        = string
  default     = "512Mi"
}

variable "cpu_idle" {
  description = "CPU allocation when idle"
  type        = bool
  default     = true
}

# Security Configuration
variable "service_account_key_file" {
  description = "Path to service account key file for Docker registry authentication"
  type        = string
  default     = "./service-account-key.json"
}

# Feature Flags
variable "enable_monitoring" {
  description = "Enable Cloud Monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable structured logging to Cloud Storage"
  type        = bool
  default     = true
}

variable "enable_secrets" {
  description = "Enable Secret Manager for API keys"
  type        = bool
  default     = true
}

# Legacy variable for compatibility
variable "repo" {
  type        = string
  description = "GitHub repo path user/repo (legacy)"
  default     = "unknown/last-hope"
}
