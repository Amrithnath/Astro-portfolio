package config

import (
  "fmt"
  "os"
  "strings"
)

type Env struct {
  AppEnv                  string
  Port                    string
  PublicSiteOrigin        string
  AdminSiteOrigin         string
  WebAuthnRPID            string
  SessionCookieDomain     string
  SessionSecret           string
  DatabaseURL             string
  GoogleProjectID         string
  GoogleDriveServicePath  string
  GoogleOAuthClientID     string
  GoogleOAuthClientSecret string
  GoogleOAuthRedirectURL  string
  R2AccountID             string
  R2BucketName            string
  R2AccessKeyID           string
  R2SecretAccessKey       string
  R2PublicBaseURL         string
  CloudflareAccessAudience string
  CloudflareAccessTeamDomain string
  AdminAllowedEmails      []string
}

func LoadEnv() (Env, error) {
  env := Env{
    AppEnv:                   fallback(os.Getenv("APP_ENV"), "development"),
    Port:                     fallback(os.Getenv("PORT"), "8787"),
    PublicSiteOrigin:         fallback(os.Getenv("PUBLIC_SITE_ORIGIN"), "http://127.0.0.1:4321"),
    AdminSiteOrigin:          fallback(os.Getenv("ADMIN_SITE_ORIGIN"), "http://127.0.0.1:4323"),
    WebAuthnRPID:             fallback(os.Getenv("WEBAUTHN_RP_ID"), "localhost"),
    SessionCookieDomain:      os.Getenv("SESSION_COOKIE_DOMAIN"),
    SessionSecret:            fallback(os.Getenv("SESSION_SECRET"), "development-session-secret"),
    DatabaseURL:              os.Getenv("DATABASE_URL"),
    GoogleProjectID:          os.Getenv("GOOGLE_PROJECT_ID"),
    GoogleDriveServicePath:   os.Getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH"),
    GoogleOAuthClientID:      os.Getenv("GOOGLE_OAUTH_CLIENT_ID"),
    GoogleOAuthClientSecret:  os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
    GoogleOAuthRedirectURL:   os.Getenv("GOOGLE_OAUTH_REDIRECT_URL"),
    R2AccountID:              os.Getenv("R2_ACCOUNT_ID"),
    R2BucketName:             os.Getenv("R2_BUCKET_NAME"),
    R2AccessKeyID:            os.Getenv("R2_ACCESS_KEY_ID"),
    R2SecretAccessKey:        os.Getenv("R2_SECRET_ACCESS_KEY"),
    R2PublicBaseURL:          os.Getenv("R2_PUBLIC_BASE_URL"),
    CloudflareAccessAudience: os.Getenv("CLOUDFLARE_ACCESS_AUDIENCE"),
    CloudflareAccessTeamDomain: os.Getenv("CLOUDFLARE_ACCESS_TEAM_DOMAIN"),
    AdminAllowedEmails:       splitCSV(os.Getenv("ADMIN_ALLOWED_EMAILS")),
  }

  if env.DatabaseURL == "" {
    return Env{}, fmt.Errorf("DATABASE_URL is required")
  }

  return env, nil
}

func fallback(value string, defaultValue string) string {
  if strings.TrimSpace(value) == "" {
    return defaultValue
  }
  return value
}

func splitCSV(value string) []string {
  if strings.TrimSpace(value) == "" {
    return nil
  }

  parts := strings.Split(value, ",")
  out := make([]string, 0, len(parts))
  for _, part := range parts {
    trimmed := strings.TrimSpace(part)
    if trimmed != "" {
      out = append(out, trimmed)
    }
  }
  return out
}
