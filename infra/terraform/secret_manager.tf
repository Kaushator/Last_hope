resource "google_secret_manager_secret" "htx_key" {
  secret_id = "HTX_API_KEY"
  replication { automatic = true }
}
resource "google_secret_manager_secret" "htx_secret" {
  secret_id = "HTX_API_SECRET"
  replication { automatic = true }
}
resource "google_secret_manager_secret" "openai" {
  secret_id = "OPENAI_API_KEY"
  replication { automatic = true }
}
resource "google_secret_manager_secret" "coingecko" {
  secret_id = "COINGECKO_API_KEY"
  replication { automatic = true }
}
