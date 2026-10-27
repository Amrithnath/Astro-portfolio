package postgres

import (
  "context"
  "fmt"
  "time"

  "github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
  Pool *pgxpool.Pool
}

func Open(ctx context.Context, databaseURL string) (*DB, error) {
  cfg, err := pgxpool.ParseConfig(databaseURL)
  if err != nil {
    return nil, fmt.Errorf("parse database url: %w", err)
  }

  cfg.MaxConns = 4
  cfg.MinConns = 0
  cfg.MaxConnLifetime = 30 * time.Minute
  cfg.MaxConnIdleTime = 5 * time.Minute

  pool, err := pgxpool.NewWithConfig(ctx, cfg)
  if err != nil {
    return nil, fmt.Errorf("open database pool: %w", err)
  }

  if err := pool.Ping(ctx); err != nil {
    pool.Close()
    return nil, fmt.Errorf("ping database: %w", err)
  }

  return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
  db.Pool.Close()
}
