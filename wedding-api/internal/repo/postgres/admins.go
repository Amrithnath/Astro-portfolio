package postgres

import (
  "context"
  "errors"
  "fmt"
  "strings"

  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/jackc/pgx/v5"
)

var ErrAdminNotFound = errors.New("admin not found")

func (db *DB) SeedAdmins(ctx context.Context, emails []string) error {
  for _, email := range emails {
    displayName := inferDisplayName(email)
    _, err := db.Pool.Exec(ctx, `
      INSERT INTO admins (access_email, display_name)
      VALUES ($1, $2)
      ON CONFLICT (access_email)
      DO UPDATE SET display_name = EXCLUDED.display_name
    `, email, displayName)
    if err != nil {
      return fmt.Errorf("seed admin %s: %w", email, err)
    }
  }

  return nil
}

func (db *DB) GetAdminByEmail(ctx context.Context, email string) (*models.Admin, error) {
  row := db.Pool.QueryRow(ctx, `
    SELECT id, access_email, display_name, created_at, last_login_at
    FROM admins
    WHERE access_email = $1 AND disabled_at IS NULL
  `, email)

  admin := &models.Admin{}
  if err := row.Scan(&admin.ID, &admin.AccessEmail, &admin.DisplayName, &admin.CreatedAt, &admin.LastLoginAt); err != nil {
    if errors.Is(err, pgx.ErrNoRows) {
      return nil, ErrAdminNotFound
    }
    return nil, err
  }

  return admin, nil
}

func inferDisplayName(email string) string {
  local := strings.Split(email, "@")[0]
  local = strings.ReplaceAll(local, ".", " ")
  local = strings.ReplaceAll(local, "_", " ")
  local = strings.TrimSpace(local)
  if local == "" {
    return email
  }

  words := strings.Fields(local)
  for i, word := range words {
    if len(word) == 0 {
      continue
    }
    words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
  }
  return strings.Join(words, " ")
}
