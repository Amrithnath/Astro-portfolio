# Terraform

Phase 1 Terraform will manage the admin/API infrastructure shape for:

- Cloudflare Access and DNS for `admin.amrithnath.dev`
- Cloudflare R2 bucket for wedding/admin assets
- Cloud Run service for the Go API
- Secret/env references for deploy-time wiring

Neon can be created manually first and then referenced by Terraform outputs/variables.
