package postgres

import (
  "context"
  "errors"
  "fmt"
  "time"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/jackc/pgx/v5"
)

var ErrUploadSessionNotFound = errors.New("upload session not found")

func (db *DB) CreateUploadSession(ctx context.Context, session models.UploadSession) (*models.UploadSession, error) {
  row := db.Pool.QueryRow(ctx, `
    INSERT INTO upload_sessions (
      provider,
      provider_session_ref,
      storage_policy_snapshot,
      original_name,
      stored_name,
      mime_type,
      total_bytes,
      next_offset,
      complete,
      expires_at,
      ip_hash
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, created_at, updated_at
  `,
    session.Provider,
    session.ProviderSessionRef,
    session.StoragePolicySnapshot,
    session.OriginalName,
    session.StoredName,
    session.MimeType,
    session.TotalBytes,
    session.NextOffset,
    session.Complete,
    session.ExpiresAt,
    session.IPHash,
  )

  created := session
  if err := row.Scan(&created.ID, &created.CreatedAt, &created.UpdatedAt); err != nil {
    return nil, fmt.Errorf("create upload session: %w", err)
  }

  return &created, nil
}

func (db *DB) GetUploadSession(ctx context.Context, id string) (*models.UploadSession, error) {
  row := db.Pool.QueryRow(ctx, `
    SELECT id,
           provider,
           provider_session_ref,
           storage_policy_snapshot,
           original_name,
           stored_name,
           mime_type,
           total_bytes,
           next_offset,
           complete,
           expires_at,
           created_at,
           updated_at,
           ip_hash
    FROM upload_sessions
    WHERE id = $1
  `, id)

  session := &models.UploadSession{}
  if err := row.Scan(
    &session.ID,
    &session.Provider,
    &session.ProviderSessionRef,
    &session.StoragePolicySnapshot,
    &session.OriginalName,
    &session.StoredName,
    &session.MimeType,
    &session.TotalBytes,
    &session.NextOffset,
    &session.Complete,
    &session.ExpiresAt,
    &session.CreatedAt,
    &session.UpdatedAt,
    &session.IPHash,
  ); err != nil {
    if errors.Is(err, pgx.ErrNoRows) {
      return nil, ErrUploadSessionNotFound
    }
    return nil, fmt.Errorf("get upload session %s: %w", id, err)
  }

  return session, nil
}

func (db *DB) UpdateUploadSessionProgress(ctx context.Context, id string, nextOffset int64, complete bool) error {
  commandTag, err := db.Pool.Exec(ctx, `
    UPDATE upload_sessions
    SET next_offset = $2,
        complete = $3,
        updated_at = NOW()
    WHERE id = $1
  `, id, nextOffset, complete)
  if err != nil {
    return fmt.Errorf("update upload session %s: %w", id, err)
  }

  if commandTag.RowsAffected() == 0 {
    return ErrUploadSessionNotFound
  }

  return nil
}

func (db *DB) CountActiveUploadSessionsByIP(ctx context.Context, ipHash string) (int64, error) {
  row := db.Pool.QueryRow(ctx, `
    SELECT COUNT(*)
    FROM upload_sessions
    WHERE ip_hash = $1
      AND complete = FALSE
      AND expires_at > NOW()
  `, ipHash)

  var count int64
  if err := row.Scan(&count); err != nil {
    return 0, fmt.Errorf("count active upload sessions: %w", err)
  }

  return count, nil
}

func (db *DB) DeleteExpiredUploadSessions(ctx context.Context, now time.Time) error {
  if _, err := db.Pool.Exec(ctx, `DELETE FROM upload_sessions WHERE expires_at <= $1`, now); err != nil {
    return fmt.Errorf("delete expired upload sessions: %w", err)
  }

  return nil
}
