package postgres

import (
  "context"
  "encoding/json"
  "fmt"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
)

func (db *DB) LoadWeddingConfig(ctx context.Context) (models.WeddingConfigBundle, error) {
  bundle := models.WeddingConfigBundle{}

  if err := db.loadDocument(ctx, "wedding.public", &bundle.Public); err != nil {
    return bundle, err
  }
  if err := db.loadDocument(ctx, "wedding.theme", &bundle.Theme); err != nil {
    return bundle, err
  }
  if err := db.loadDocument(ctx, "wedding.upload_policy", &bundle.Policy); err != nil {
    return bundle, err
  }
  if err := db.loadDocument(ctx, "wedding.storage.google_drive", &bundle.Storage); err != nil {
    return bundle, err
  }

  return bundle, nil
}

func (db *DB) loadDocument(ctx context.Context, key string, out any) error {
  row := db.Pool.QueryRow(ctx, `SELECT value_json FROM config_documents WHERE key = $1`, key)

  var raw []byte
  if err := row.Scan(&raw); err != nil {
    return fmt.Errorf("load config %s: %w", key, err)
  }

  if err := json.Unmarshal(raw, out); err != nil {
    return fmt.Errorf("decode config %s: %w", key, err)
  }

  return nil
}
