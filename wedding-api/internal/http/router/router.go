package router

import (
  "encoding/json"
  "errors"
  "net/http"
  "time"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  adminauthhandlers "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/handlers/adminauth"
  adminconfighandlers "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/handlers/adminconfig"
  publichandlers "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/handlers/public"
  uploadhandlers "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/handlers/upload"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
  adminauthservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminauth"
  adminconfigservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminconfig"
  configservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/config"
  uploadservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/upload"

  "github.com/go-chi/chi/v5"
  chimiddleware "github.com/go-chi/chi/v5/middleware"
)

func New(env appconfig.Env, db *postgres.DB) http.Handler {
  uploadProvider := uploadservice.NewGoogleDriveProvider(env)
  uploadConfig := uploadservice.New(env, db, uploadProvider)
  return newRouter(env, db, uploadConfig)
}

func NewWithUploadService(env appconfig.Env, db *postgres.DB, uploadConfig *uploadservice.Service) http.Handler {
  return newRouter(env, db, uploadConfig)
}

func newRouter(env appconfig.Env, db *postgres.DB, uploadConfig *uploadservice.Service) http.Handler {
  r := chi.NewRouter()
  r.Use(chimiddleware.RequestID)
  r.Use(chimiddleware.RealIP)
  r.Use(chimiddleware.Recoverer)
  r.Use(chimiddleware.Timeout(60 * time.Second))
  r.Use(corsMiddleware(env))

  adminAuth := adminauthservice.New(env, db)
  publicConfig := configservice.New(db)
  publicHandler := publichandlers.New(publicConfig)
  uploadHandler := uploadhandlers.New(uploadConfig)
  adminAuthHandler := adminauthhandlers.New(adminAuth)
  adminConfigHandler := adminconfighandlers.New(adminconfigservice.New(db))

  r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    _, _ = w.Write([]byte(`{"ok":true,"service":"wedding-api","phase":"foundation","providerSupport":["google_drive","google_photos"]}`))
  })

  r.Get("/api/public/wedding-config", publicHandler.GetWeddingConfig)
  r.Post("/api/upload/init", uploadHandler.InitUpload)
  r.Put("/api/upload/chunk", uploadHandler.UploadChunk)
  r.Route("/api/admin", func(adminRouter chi.Router) {
    adminRouter.Get("/session", adminAuthHandler.GetSession)

    adminRouter.Group(func(protected chi.Router) {
      protected.Use(requireAdminSession(adminAuth))
      protected.Get("/config/wedding-public", adminConfigHandler.GetWeddingPublicConfig)
      protected.Put("/config/wedding-public", adminConfigHandler.UpdateWeddingPublicConfig)
      protected.Get("/config/wedding-theme", adminConfigHandler.GetWeddingThemeConfig)
      protected.Put("/config/wedding-theme", adminConfigHandler.UpdateWeddingThemeConfig)
      protected.Get("/config/upload-policy", adminConfigHandler.GetUploadPolicyConfig)
      protected.Put("/config/upload-policy", adminConfigHandler.UpdateUploadPolicyConfig)
      protected.Get("/config/storage-provider", adminConfigHandler.GetStorageProviderConfig)
      protected.Put("/config/storage-provider", adminConfigHandler.UpdateStorageProviderConfig)
      protected.Post("/config/storage-provider/validate", adminConfigHandler.ValidateStorageProvider)
    })
  })

  return r
}

func corsMiddleware(env appconfig.Env) func(http.Handler) http.Handler {
  allowedOrigins := map[string]struct{}{}
  for _, origin := range []string{env.PublicSiteOrigin, env.AdminSiteOrigin} {
    if origin != "" {
      allowedOrigins[origin] = struct{}{}
    }
  }

  const allowedHeaders = "Accept, Content-Type, Content-Range, X-Admin-Debug-Email"
  const allowedMethods = "GET, POST, PUT, OPTIONS"

  return func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      origin := r.Header.Get("Origin")
      if origin == "" {
        next.ServeHTTP(w, r)
        return
      }

      if _, ok := allowedOrigins[origin]; !ok {
        if r.Method == http.MethodOptions {
          writeJSONError(w, http.StatusForbidden, "origin not allowed")
          return
        }

        next.ServeHTTP(w, r)
        return
      }

      w.Header().Add("Vary", "Origin")
      w.Header().Add("Vary", "Access-Control-Request-Method")
      w.Header().Add("Vary", "Access-Control-Request-Headers")
      w.Header().Set("Access-Control-Allow-Origin", origin)
      w.Header().Set("Access-Control-Allow-Credentials", "true")
      w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
      w.Header().Set("Access-Control-Allow-Methods", allowedMethods)

      if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusNoContent)
        return
      }

      next.ServeHTTP(w, r)
    })
  }
}

func requireAdminSession(auth *adminauthservice.Service) func(http.Handler) http.Handler {
  return func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      if _, err := auth.GetSession(r.Context(), r); err != nil {
        if errors.Is(err, adminauthservice.ErrUnauthorized) {
          writeJSONError(w, http.StatusUnauthorized, "admin session not available")
          return
        }

        writeJSONError(w, http.StatusInternalServerError, err.Error())
        return
      }

      next.ServeHTTP(w, r)
    })
  }
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(status)
  _ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
