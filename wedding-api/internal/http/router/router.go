package router

import (
  "net/http"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  adminauthhandlers "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/handlers/adminauth"
  publichandlers "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/handlers/public"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
  adminauthservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminauth"
  configservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/config"

  "github.com/go-chi/chi/v5"
  chimiddleware "github.com/go-chi/chi/v5/middleware"
)

func New(env appconfig.Env, db *postgres.DB) http.Handler {
  r := chi.NewRouter()
  r.Use(chimiddleware.RequestID)
  r.Use(chimiddleware.RealIP)
  r.Use(chimiddleware.Recoverer)
  r.Use(chimiddleware.Timeout(60 * 1_000_000_000))

  publicConfig := configservice.New(db)
  publicHandler := publichandlers.New(publicConfig)
  adminAuthHandler := adminauthhandlers.New(adminauthservice.New(env, db))

  r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    _, _ = w.Write([]byte(`{"ok":true,"service":"wedding-api","phase":"foundation","providerSupport":["google_drive","google_photos"]}`))
  })

  r.Get("/api/public/wedding-config", publicHandler.GetWeddingConfig)
  r.Get("/api/admin/session", adminAuthHandler.GetSession)

  return r
}
