package testutil

import (
  "context"
  "fmt"
  "net"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
  "time"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
  _ "github.com/jackc/pgx/v5/stdlib"
  "github.com/pressly/goose/v3"
)

type PostgresContainer struct {
  ContainerName string
  DatabaseURL   string
}

func StartPostgres(t *testing.T) PostgresContainer {
  t.Helper()

  port := pickFreePort(t)
  containerName := fmt.Sprintf("wedding-api-test-%d-%d", time.Now().UnixNano(), port)
  password := "postgres"
  database := "wedding_test"
  dbURL := fmt.Sprintf("postgresql://postgres:%s@127.0.0.1:%d/%s?sslmode=disable", password, port, database)

  runCommand(t, "docker", "run", "-d",
    "--name", containerName,
    "-e", "POSTGRES_PASSWORD="+password,
    "-e", "POSTGRES_DB="+database,
    "-p", fmt.Sprintf("%d:5432", port),
    "postgres:16-alpine",
  )

  t.Cleanup(func() {
    _ = exec.Command("docker", "rm", "-f", containerName).Run()
  })

  waitForDatabase(t, dbURL)
  applyMigrations(t, dbURL)

  return PostgresContainer{
    ContainerName: containerName,
    DatabaseURL:   dbURL,
  }
}

func OpenDatabase(t *testing.T, databaseURL string) *postgres.DB {
  t.Helper()

  db, err := postgres.Open(context.Background(), databaseURL)
  if err != nil {
    t.Fatalf("open database: %v", err)
  }

  t.Cleanup(func() {
    db.Close()
  })

  return db
}

func runCommand(t *testing.T, name string, args ...string) {
  t.Helper()

  cmd := exec.Command(name, args...)
  output, err := cmd.CombinedOutput()
  if err != nil {
    t.Fatalf("%s %s failed: %v\n%s", name, strings.Join(args, " "), err, string(output))
  }
}

func waitForDatabase(t *testing.T, databaseURL string) {
  t.Helper()

  deadline := time.Now().Add(30 * time.Second)
  for time.Now().Before(deadline) {
    db, err := postgres.Open(context.Background(), databaseURL)
    if err == nil {
      db.Close()
      return
    }
    time.Sleep(500 * time.Millisecond)
  }

  t.Fatalf("database did not become ready in time")
}

func applyMigrations(t *testing.T, databaseURL string) {
  t.Helper()

  db, err := goose.OpenDBWithDriver("pgx", databaseURL)
  if err != nil {
    t.Fatalf("open goose database: %v", err)
  }
  defer db.Close()

  if err := goose.SetDialect("postgres"); err != nil {
    t.Fatalf("set goose dialect: %v", err)
  }

  _, filename, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatalf("resolve runtime caller for migrations")
  }

  migrationsDir := filepath.Join(filepath.Dir(filename), "..", "..", "db", "migrations")
  if err := goose.Up(db, migrationsDir); err != nil {
    t.Fatalf("apply migrations: %v", err)
  }
}

func pickFreePort(t *testing.T) int {
  t.Helper()

  listener, err := net.Listen("tcp", "127.0.0.1:0")
  if err != nil {
    t.Fatalf("pick free port: %v", err)
  }
  defer listener.Close()

  return listener.Addr().(*net.TCPAddr).Port
}
