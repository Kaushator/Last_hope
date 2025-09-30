resource "google_storage_bucket" "artifacts" {
  name          = "${var.project_id}-last-hope-artifacts"
  location      = var.region
  force_destroy = true
  uniform_bucket_level_access = true
}
