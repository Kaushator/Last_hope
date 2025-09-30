resource "google_bigquery_dataset" "last_hope" {
  dataset_id = "last_hope"
  location   = "EU"
}

resource "google_bigquery_table" "portfolio_positions" {
  dataset_id = google_bigquery_dataset.last_hope.dataset_id
  table_id   = "portfolio_positions"
  schema     = <<EOF
[
  {"name":"symbol","type":"STRING","mode":"REQUIRED"},
  {"name":"quantity","type":"FLOAT","mode":"REQUIRED"},
  {"name":"avg_price","type":"FLOAT","mode":"NULLABLE"},
  {"name":"ts","type":"TIMESTAMP","mode":"REQUIRED"}
]
EOF
}

resource "google_bigquery_table" "market_snapshots" {
  dataset_id = google_bigquery_dataset.last_hope.dataset_id
  table_id   = "market_snapshots"
  schema     = <<EOF
[
  {"name":"id","type":"STRING","mode":"REQUIRED"},
  {"name":"price","type":"FLOAT","mode":"REQUIRED"},
  {"name":"mcap","type":"FLOAT","mode":"NULLABLE"},
  {"name":"ts","type":"TIMESTAMP","mode":"REQUIRED"}
]
EOF
}

resource "google_bigquery_table" "analysis_notes" {
  dataset_id = google_bigquery_dataset.last_hope.dataset_id
  table_id   = "analysis_notes"
  schema     = <<EOF
[
  {"name":"symbol","type":"STRING","mode":"REQUIRED"},
  {"name":"horizon","type":"STRING","mode":"REQUIRED"},
  {"name":"summary","type":"STRING","mode":"NULLABLE"},
  {"name":"score","type":"FLOAT","mode":"NULLABLE"},
  {"name":"ts","type":"TIMESTAMP","mode":"REQUIRED"}
]
EOF
}
