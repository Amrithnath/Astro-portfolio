package postgres

import (
  "context"
  "errors"
  "fmt"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/jackc/pgx/v5"
)

var ErrAssetNotFound = errors.New("asset not found")

func (db *DB) ListAssets(ctx context.Context) ([]models.AssetRecord, error) {
  rows, err := db.Pool.Query(ctx, `
    SELECT id, kind, title, storage_provider, storage_key, public_url, created_at, created_by
    FROM assets
    ORDER BY created_at DESC, id DESC
  `)
  if err != nil {
    return nil, fmt.Errorf("list assets: %w", err)
  }
  defer rows.Close()

  assets := []models.AssetRecord{}
  for rows.Next() {
    asset := models.AssetRecord{}
    if err := rows.Scan(
      &asset.ID,
      &asset.Kind,
      &asset.Title,
      &asset.StorageProvider,
      &asset.StorageKey,
      &asset.PublicURL,
      &asset.CreatedAt,
      &asset.CreatedBy,
    ); err != nil {
      return nil, fmt.Errorf("scan asset row: %w", err)
    }
    assets = append(assets, asset)
  }

  if err := rows.Err(); err != nil {
    return nil, fmt.Errorf("iterate asset rows: %w", err)
  }

  return assets, nil
}

func (db *DB) CreateAsset(ctx context.Context, asset models.AssetRecord) (*models.AssetRecord, error) {
  row := db.Pool.QueryRow(ctx, `
    INSERT INTO assets (
      kind,
      title,
      storage_provider,
      storage_key,
      public_url,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, created_at
  `,
    asset.Kind,
    asset.Title,
    asset.StorageProvider,
    asset.StorageKey,
    asset.PublicURL,
    asset.CreatedBy,
  )

  created := asset
  if err := row.Scan(&created.ID, &created.CreatedAt); err != nil {
    return nil, fmt.Errorf("create asset: %w", err)
  }

  return &created, nil
}

func (db *DB) GetAssetByID(ctx context.Context, id string) (*models.AssetRecord, error) {
  row := db.Pool.QueryRow(ctx, `
    SELECT id, kind, title, storage_provider, storage_key, public_url, created_at, created_by
    FROM assets
    WHERE id = $1
  `, id)

  asset := &models.AssetRecord{}
  if err := row.Scan(
    &asset.ID,
    &asset.Kind,
    &asset.Title,
    &asset.StorageProvider,
    &asset.StorageKey,
    &asset.PublicURL,
    &asset.CreatedAt,
    &asset.CreatedBy,
  ); err != nil {
    if errors.Is(err, pgx.ErrNoRows) {
      return nil, ErrAssetNotFound
    }
    return nil, fmt.Errorf("get asset %s: %w", id, err)
  }

  return asset, nil
}

func (db *DB) DeleteAsset(ctx context.Context, id string) error {
  commandTag, err := db.Pool.Exec(ctx, `DELETE FROM assets WHERE id = $1`, id)
  if err != nil {
    return fmt.Errorf("delete asset %s: %w", id, err)
  }

  if commandTag.RowsAffected() == 0 {
    return ErrAssetNotFound
  }

  return nil
}
