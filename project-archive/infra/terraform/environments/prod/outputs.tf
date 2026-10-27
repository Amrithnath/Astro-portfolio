output "cloud_run_uri" {
  value = google_cloud_run_v2_service.api.uri
}

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.wedding_assets.name
}
