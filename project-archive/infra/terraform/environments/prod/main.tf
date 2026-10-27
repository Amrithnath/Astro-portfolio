resource "google_cloud_run_v2_service" "api" {
  name     = var.api_service_name
  location = var.gcp_region

  template {
    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    containers {
      image = "us-docker.pkg.dev/${var.gcp_project_id}/wedding-api/wedding-api:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  ingress = "INGRESS_TRAFFIC_ALL"
}

resource "cloudflare_r2_bucket" "wedding_assets" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
  location   = "ENAM"
}
