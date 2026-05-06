variable "gcp_project_id" {
  type = string
}

variable "gcp_region" {
  type    = string
  default = "us-central1"
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "admin_hostname" {
  type    = string
  default = "admin.amrithnath.dev"
}

variable "api_service_name" {
  type    = string
  default = "wedding-api"
}

variable "api_min_instances" {
  type    = number
  default = 0
}

variable "api_max_instances" {
  type    = number
  default = 1
}

variable "r2_bucket_name" {
  type    = string
  default = "wedding-admin-assets"
}
