package adminconfig

import (
  "context"
  "fmt"

  adminconfigv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/admin/config/v1"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
)

type Service struct {
  db *postgres.DB
}

func New(db *postgres.DB) *Service {
  return &Service{db: db}
}

func (s *Service) GetWeddingPublicConfig(ctx context.Context) (*adminconfigv1.GetWeddingPublicConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.GetWeddingPublicConfigResponse{
    Config: toProtoWeddingPublic(bundle.Public),
  }, nil
}

func (s *Service) UpdateWeddingPublicConfig(ctx context.Context, config *adminconfigv1.WeddingPublicConfig) (*adminconfigv1.UpdateWeddingPublicConfigResponse, error) {
  model := models.WeddingPublicConfig{
    Enabled:        config.GetEnabled(),
    Names:          config.GetNames(),
    Eyebrow:        config.GetEyebrow(),
    Headline:       config.GetHeadline(),
    Subheadline:    config.GetSubheadline(),
    DropzoneCopy:   config.GetDropzoneCopy(),
    SupportingCopy: config.GetSupportingCopy(),
    SuccessTitle:   config.GetSuccessTitle(),
    SuccessMessage: config.GetSuccessMessage(),
    ClosedMessage:  config.GetClosedMessage(),
  }

  if err := s.db.UpdateDocument(ctx, "wedding.public", model); err != nil {
    return nil, err
  }

  return &adminconfigv1.UpdateWeddingPublicConfigResponse{Config: toProtoWeddingPublic(model)}, nil
}

func (s *Service) GetWeddingThemeConfig(ctx context.Context) (*adminconfigv1.GetWeddingThemeConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.GetWeddingThemeConfigResponse{Config: toProtoWeddingTheme(bundle.Theme)}, nil
}

func (s *Service) GetUploadPolicyConfig(ctx context.Context) (*adminconfigv1.GetUploadPolicyConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.GetUploadPolicyConfigResponse{Config: toProtoUploadPolicy(bundle.Policy)}, nil
}

func (s *Service) GetStorageProviderConfig(ctx context.Context) (*adminconfigv1.GetStorageProviderConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.GetStorageProviderConfigResponse{Config: toProtoStorageConfig(bundle.Storage)}, nil
}

func (s *Service) ValidateStorageProvider(_ context.Context, config *adminconfigv1.StorageProviderConfig) (*adminconfigv1.ValidateStorageProviderResponse, error) {
  switch config.GetProvider() {
  case adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_GOOGLE_DRIVE:
    if config.GetDriveFolderId() == "" {
      return &adminconfigv1.ValidateStorageProviderResponse{Valid: false, ValidationMessage: "Drive folder ID is required."}, nil
    }
    return &adminconfigv1.ValidateStorageProviderResponse{Valid: true, ValidationMessage: "Drive provider config looks structurally valid. Live Drive validation lands next."}, nil
  case adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_GOOGLE_PHOTOS:
    return &adminconfigv1.ValidateStorageProviderResponse{Valid: false, ValidationMessage: "Google Photos requires an admin OAuth connection and album provisioning flow, which is not implemented yet."}, nil
  default:
    return nil, fmt.Errorf("unsupported storage provider")
  }
}

func toProtoWeddingPublic(model models.WeddingPublicConfig) *adminconfigv1.WeddingPublicConfig {
  return &adminconfigv1.WeddingPublicConfig{
    Enabled:        model.Enabled,
    Names:          model.Names,
    Eyebrow:        model.Eyebrow,
    Headline:       model.Headline,
    Subheadline:    model.Subheadline,
    DropzoneCopy:   model.DropzoneCopy,
    SupportingCopy: model.SupportingCopy,
    SuccessTitle:   model.SuccessTitle,
    SuccessMessage: model.SuccessMessage,
    ClosedMessage:  model.ClosedMessage,
  }
}

func toProtoWeddingTheme(model models.WeddingThemeConfig) *adminconfigv1.WeddingThemeConfig {
  return &adminconfigv1.WeddingThemeConfig{
    Preset:           model.Preset,
    TypographyPreset: model.TypographyPreset,
    PrimaryAccent:    model.PrimaryAccent,
    SecondaryAccent:  model.SecondaryAccent,
    SurfaceStyle:     model.SurfaceStyle,
    HeroAssetId:      model.HeroAssetID,
    TextureAssetId:   model.TextureAssetID,
    ButtonStyle:      model.ButtonStyle,
  }
}

func toProtoUploadPolicy(model models.UploadPolicyConfig) *adminconfigv1.UploadPolicyConfig {
  return &adminconfigv1.UploadPolicyConfig{
    UploadsEnabled:      model.UploadsEnabled,
    MaxFileBytes:        model.MaxFileBytes,
    MaxActiveUploadsPerIp: model.MaxActiveUploadsPerIP,
    UploadSessionTtlMs:  model.UploadSessionTTLMS,
    AllowedMimeTypes:    model.AllowedMIMETypes,
    MaintenanceMessage:  model.MaintenanceMessage,
  }
}

func toProtoStorageConfig(model models.StorageProviderConfig) *adminconfigv1.StorageProviderConfig {
  provider := adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_UNSPECIFIED
  switch model.Provider {
  case "google_drive":
    provider = adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_GOOGLE_DRIVE
  case "google_photos":
    provider = adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_GOOGLE_PHOTOS
  }

  validatedAt := int64(0)
  if model.ValidatedAt != nil {
    validatedAt = *model.ValidatedAt
  }

  return &adminconfigv1.StorageProviderConfig{
    Provider:            provider,
    DriveFolderId:       model.DriveFolderID,
    DriveFolderLabel:    model.DriveFolderLabel,
    PhotosEnabled:       model.PhotosEnabled,
    PhotosAlbumId:       model.PhotosAlbumID,
    PhotosAlbumTitle:    model.PhotosAlbumTitle,
    ValidatedAtUnix:     validatedAt,
    LastValidationError: model.LastValidationError,
  }
}
