package app

import (
  "context"
  "fmt"
  "net/http"
  "time"

  envconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/http/router"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
  "github.com/joho/godotenv"
)

type App struct {
  server *http.Server
  db     *postgres.DB
}

func New() (*App, error) {
  _ = godotenv.Load()

  env, err := envconfig.LoadEnv()
  if err != nil {
    return nil, err
  }

  db, err := postgres.Open(context.Background(), env.DatabaseURL)
  if err != nil {
    return nil, err
  }

  if err := db.SeedAdmins(context.Background(), env.AdminAllowedEmails); err != nil {
    db.Close()
    return nil, err
  }

  r := router.New(env, db)

  return &App{
    server: &http.Server{
      Addr:              fmt.Sprintf(":%s", env.Port),
      Handler:           r,
      ReadHeaderTimeout: 10 * time.Second,
    },
    db: db,
  }, nil
}

func (a *App) Run() error {
  return a.server.ListenAndServe()
}

func (a *App) Shutdown(ctx context.Context) error {
  if err := a.server.Shutdown(ctx); err != nil {
    return err
  }
  a.db.Close()
  return nil
}
