package config

import (
  "context"

  publicweddingv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/public/wedding/v1"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
)

type Service struct {
  db *postgres.DB
}

func New(db *postgres.DB) *Service {
  return &Service{db: db}
}

func (s *Service) GetPublicWeddingConfig(ctx context.Context) (*publicweddingv1.GetWeddingConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &publicweddingv1.GetWeddingConfigResponse{
    PublicData: &publicweddingv1.WeddingPublicData{
      Enabled:        bundle.Public.Enabled,
      Names:          bundle.Public.Names,
      Eyebrow:        bundle.Public.Eyebrow,
      Headline:       bundle.Public.Headline,
      Subheadline:    bundle.Public.Subheadline,
      DropzoneCopy:   bundle.Public.DropzoneCopy,
      SupportingCopy: bundle.Public.SupportingCopy,
      SuccessTitle:   bundle.Public.SuccessTitle,
      SuccessMessage: bundle.Public.SuccessMessage,
      ClosedMessage:  bundle.Public.ClosedMessage,
    },
    Theme: &publicweddingv1.WeddingThemeTokens{
      Preset:           bundle.Theme.Preset,
      PrimaryAccent:    bundle.Theme.PrimaryAccent,
      SecondaryAccent:  bundle.Theme.SecondaryAccent,
      SurfaceStyle:     bundle.Theme.SurfaceStyle,
      ButtonStyle:      bundle.Theme.ButtonStyle,
      TypographyPreset: bundle.Theme.TypographyPreset,
      HeroImageUrl:     "",
      TextureImageUrl:  "",
    },
    UploadPolicy: &publicweddingv1.WeddingUploadPolicy{
      UploadsEnabled:     bundle.Policy.UploadsEnabled,
      MaxFileBytes:       bundle.Policy.MaxFileBytes,
      AllowedMimeTypes:   bundle.Policy.AllowedMIMETypes,
      MaintenanceMessage: bundle.Policy.MaintenanceMessage,
    },
  }, nil
}
