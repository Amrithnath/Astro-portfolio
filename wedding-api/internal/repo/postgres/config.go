package postgres

import (
  "context"
  "encoding/json"
  "fmt"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
)

type ConfigDocument struct {
  Key       string
  ValueJSON []byte
  Version   int
}

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

func (db *DB) LoadDocument(ctx context.Context, key string) (ConfigDocument, error) {
  row := db.Pool.QueryRow(ctx, `SELECT key, value_json, version FROM config_documents WHERE key = $1`, key)

  var document ConfigDocument
  if err := row.Scan(&document.Key, &document.ValueJSON, &document.Version); err != nil {
    return ConfigDocument{}, fmt.Errorf("load config document %s: %w", key, err)
  }

  return document, nil
}

func (db *DB) UpdateDocument(ctx context.Context, key string, value any) error {
  raw, err := json.Marshal(value)
  if err != nil {
    return fmt.Errorf("encode config document %s: %w", key, err)
  }

  _, err = db.Pool.Exec(ctx, `
    UPDATE config_documents
    SET value_json = $2,
        version = version + 1,
        updated_at = NOW()
    WHERE key = $1
  `, key, raw)
  if err != nil {
    return fmt.Errorf("update config document %s: %w", key, err)
  }

  return nil
}
