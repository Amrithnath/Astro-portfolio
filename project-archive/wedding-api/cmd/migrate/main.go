package main

import (
  "fmt"
  "os"

  _ "github.com/jackc/pgx/v5/stdlib"
  "github.com/joho/godotenv"
  "github.com/pressly/goose/v3"
)

func main() {
  _ = godotenv.Load()

  if len(os.Args) < 2 {
    fmt.Fprintln(os.Stderr, "usage: go run ./cmd/migrate <up|status>")
    os.Exit(1)
  }

  dbURL := os.Getenv("DATABASE_URL")
  if dbURL == "" {
    fmt.Fprintln(os.Stderr, "DATABASE_URL is required")
    os.Exit(1)
  }

  db, err := goose.OpenDBWithDriver("pgx", dbURL)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
  }
  defer db.Close()

  if err := goose.SetDialect("postgres"); err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
  }

  migrationsDir := "./db/migrations"
  switch os.Args[1] {
  case "up":
    err = goose.Up(db, migrationsDir)
  case "status":
    err = goose.Status(db, migrationsDir)
  default:
    err = fmt.Errorf("unsupported command: %s", os.Args[1])
  }

  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
  }
}
