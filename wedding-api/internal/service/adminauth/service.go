package adminauth

import (
  "context"
  "errors"
  "net/http"
  "strings"
  "time"

  adminauthv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/admin/auth/v1"
  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
)

var ErrUnauthorized = errors.New("unauthorized")

type Service struct {
  env appconfig.Env
  db  *postgres.DB
}

func New(env appconfig.Env, db *postgres.DB) *Service {
  return &Service{env: env, db: db}
}

func (s *Service) GetSession(ctx context.Context, req *http.Request) (*adminauthv1.GetSessionResponse, error) {
  accessEmail := strings.TrimSpace(req.Header.Get("Cf-Access-Authenticated-User-Email"))
  if accessEmail == "" {
    return nil, ErrUnauthorized
  }

  admin, err := s.db.GetAdminByEmail(ctx, accessEmail)
  if err != nil {
    if errors.Is(err, postgres.ErrAdminNotFound) {
      return nil, ErrUnauthorized
    }
    return nil, err
  }

  expiresAt := time.Now().Add(30 * time.Minute).Unix()
  return &adminauthv1.GetSessionResponse{
    Session: &adminauthv1.AdminSession{
      Id: accessEmail,
      Admin: &adminauthv1.AdminIdentity{
        Id:          admin.ID,
        Email:       admin.AccessEmail,
        DisplayName: admin.DisplayName,
      },
      AccessEmail:    accessEmail,
      ExpiresAtUnix:  expiresAt,
      RequiresStepUp: true,
    },
  }, nil
}
