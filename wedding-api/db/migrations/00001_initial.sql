-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  credential_id BYTEA NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  aaguid UUID NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  friendly_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  access_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  ip_hash TEXT NULL,
  user_agent TEXT NULL
);

CREATE TABLE IF NOT EXISTS config_documents (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NULL REFERENCES admins(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  before_json JSONB NULL,
  after_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT NULL,
  user_agent TEXT NULL
);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_session_ref TEXT NULL,
  storage_policy_snapshot JSONB NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  total_bytes BIGINT NOT NULL,
  next_offset BIGINT NOT NULL DEFAULT 0,
  complete BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_provider TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS content_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  seo_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES admins(id)
);

INSERT INTO config_documents (key, value_json)
VALUES
  ('wedding.public', '{"enabled": true, "names": "Amrith & Partner", "eyebrow": "wedding.media://dropbox", "headline": "Share the moments you caught.", "subheadline": "Drop in the photos and videos from your phone.", "dropzoneCopy": "Photos, Live Photos, HEIC, MOV, and large videos are all welcome.", "supportingCopy": "Uploads run one file at a time for better reliability on mobile networks.", "successTitle": "Everything landed safely.", "successMessage": "Thank you for sharing your view of the day.", "closedMessage": "Uploads are closed right now."}'::JSONB),
  ('wedding.theme', '{"preset": "terminal-romance", "typographyPreset": "mono-editorial", "primaryAccent": "#63f0b6", "secondaryAccent": "#7dd3fc", "surfaceStyle": "glass-dark", "heroAssetId": "", "textureAssetId": "", "buttonStyle": "pill"}'::JSONB),
  ('wedding.upload_policy', '{"uploadsEnabled": true, "maxFileBytes": 10737418240, "maxActiveUploadsPerIp": 12, "uploadSessionTtlMs": 86400000, "allowedMimeTypes": ["image/avif", "image/gif", "image/heic", "image/heif", "image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"], "maintenanceMessage": "Uploads are paused for a moment."}'::JSONB),
  ('wedding.storage.google_drive', '{"provider": "google_drive", "driveFolderId": "", "driveFolderLabel": "", "photosEnabled": false, "photosAlbumId": "", "photosAlbumTitle": "", "validatedAt": null, "lastValidationError": ""}'::JSONB)
ON CONFLICT (key) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS content_entries;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS upload_sessions;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS config_documents;
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS passkey_credentials;
DROP TABLE IF EXISTS admins;
