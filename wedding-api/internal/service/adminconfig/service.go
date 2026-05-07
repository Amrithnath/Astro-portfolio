package adminconfig

import (
  "context"
  "fmt"
  "strings"
  "time"

  adminconfigv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/admin/config/v1"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
)

type Service struct {
  db             *postgres.DB
  driveValidator driveValidator
}

type DriveValidator = driveValidator

type driveValidator interface {
  ValidateStorage(ctx context.Context, storage models.StorageProviderConfig) (validationMessage string, driveFolderLabel string, err error)
}

type storageValidationResult struct {
  Valid           bool
  Message         string
  DriveFolderLabel string
}

const (
  weddingPublicConfigKey   = "wedding.public"
  weddingThemeConfigKey    = "wedding.theme"
  uploadPolicyConfigKey    = "wedding.upload_policy"
  storageProviderConfigKey = "wedding.storage.google_drive"
)

func New(db *postgres.DB, driveValidator driveValidator) *Service {
  return &Service{db: db, driveValidator: driveValidator}
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

  if err := s.db.UpdateDocument(ctx, weddingPublicConfigKey, model); err != nil {
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

func (s *Service) UpdateWeddingThemeConfig(ctx context.Context, config *adminconfigv1.WeddingThemeConfig) (*adminconfigv1.UpdateWeddingThemeConfigResponse, error) {
  model := models.WeddingThemeConfig{
    Preset:           config.GetPreset(),
    TypographyPreset: config.GetTypographyPreset(),
    PrimaryAccent:    config.GetPrimaryAccent(),
    SecondaryAccent:  config.GetSecondaryAccent(),
    SurfaceStyle:     config.GetSurfaceStyle(),
    HeroAssetID:      config.GetHeroAssetId(),
    TextureAssetID:   config.GetTextureAssetId(),
    ButtonStyle:      config.GetButtonStyle(),
  }

  if err := s.db.UpdateDocument(ctx, weddingThemeConfigKey, model); err != nil {
    return nil, err
  }

  return &adminconfigv1.UpdateWeddingThemeConfigResponse{Config: toProtoWeddingTheme(model)}, nil
}

func (s *Service) GetUploadPolicyConfig(ctx context.Context) (*adminconfigv1.GetUploadPolicyConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.GetUploadPolicyConfigResponse{Config: toProtoUploadPolicy(bundle.Policy)}, nil
}

func (s *Service) UpdateUploadPolicyConfig(ctx context.Context, config *adminconfigv1.UploadPolicyConfig) (*adminconfigv1.UpdateUploadPolicyConfigResponse, error) {
  model := models.UploadPolicyConfig{
    UploadsEnabled:        config.GetUploadsEnabled(),
    MaxFileBytes:          config.GetMaxFileBytes(),
    MaxActiveUploadsPerIP: config.GetMaxActiveUploadsPerIp(),
    UploadSessionTTLMS:    config.GetUploadSessionTtlMs(),
    AllowedMIMETypes:      config.GetAllowedMimeTypes(),
    MaintenanceMessage:    config.GetMaintenanceMessage(),
  }

  if err := s.db.UpdateDocument(ctx, uploadPolicyConfigKey, model); err != nil {
    return nil, err
  }

  return &adminconfigv1.UpdateUploadPolicyConfigResponse{Config: toProtoUploadPolicy(model)}, nil
}

func (s *Service) GetStorageProviderConfig(ctx context.Context) (*adminconfigv1.GetStorageProviderConfigResponse, error) {
  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.GetStorageProviderConfigResponse{Config: toProtoStorageConfig(bundle.Storage)}, nil
}

func (s *Service) UpdateStorageProviderConfig(ctx context.Context, config *adminconfigv1.StorageProviderConfig) (*adminconfigv1.UpdateStorageProviderConfigResponse, error) {
  model, err := toModelStorageConfig(config)
  if err != nil {
    return nil, err
  }

  validation, err := s.validateStorageConfig(ctx, model)
  if err != nil {
    return nil, err
  }

  if validation.DriveFolderLabel != "" && model.Provider == "google_drive" {
    model.DriveFolderLabel = validation.DriveFolderLabel
  }

  if validation.Valid {
    validatedAt := time.Now().Unix()
    model.ValidatedAt = &validatedAt
    model.LastValidationError = ""
  } else {
    model.ValidatedAt = nil
    model.LastValidationError = validation.Message
  }

  if err := s.db.UpdateDocument(ctx, storageProviderConfigKey, model); err != nil {
    return nil, err
  }

  return &adminconfigv1.UpdateStorageProviderConfigResponse{Config: toProtoStorageConfig(model)}, nil
}

func (s *Service) ValidateStorageProvider(_ context.Context, config *adminconfigv1.StorageProviderConfig) (*adminconfigv1.ValidateStorageProviderResponse, error) {
  model, err := toModelStorageConfig(config)
  if err != nil {
    return nil, err
  }

  validation, err := s.validateStorageConfig(context.Background(), model)
  if err != nil {
    return nil, err
  }

  return &adminconfigv1.ValidateStorageProviderResponse{Valid: validation.Valid, ValidationMessage: validation.Message}, nil
}

func (s *Service) validateStorageConfig(ctx context.Context, model models.StorageProviderConfig) (storageValidationResult, error) {
  switch model.Provider {
  case "google_drive":
    if strings.TrimSpace(model.DriveFolderID) == "" {
      return storageValidationResult{Valid: false, Message: "Drive folder ID is required."}, nil
    }

    if s.driveValidator == nil {
      return storageValidationResult{Valid: false, Message: "Google Drive validation is unavailable because no upload provider is configured."}, nil
    }

    message, driveFolderLabel, err := s.driveValidator.ValidateStorage(ctx, model)
    if err != nil {
      return storageValidationResult{Valid: false, Message: err.Error(), DriveFolderLabel: driveFolderLabel}, nil
    }

    if strings.TrimSpace(message) == "" {
      message = "Drive folder access verified."
    }

    return storageValidationResult{Valid: true, Message: message, DriveFolderLabel: driveFolderLabel}, nil
  case "google_photos":
    return storageValidationResult{Valid: false, Message: "Google Photos requires an admin OAuth connection and album provisioning flow, which is not implemented yet."}, nil
  default:
    return storageValidationResult{}, fmt.Errorf("unsupported storage provider")
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

func toModelStorageConfig(config *adminconfigv1.StorageProviderConfig) (models.StorageProviderConfig, error) {
  provider, err := toStorageProviderString(config.GetProvider())
  if err != nil {
    return models.StorageProviderConfig{}, err
  }

  return models.StorageProviderConfig{
    Provider:         provider,
    DriveFolderID:    config.GetDriveFolderId(),
    DriveFolderLabel: config.GetDriveFolderLabel(),
    PhotosEnabled:    config.GetPhotosEnabled(),
    PhotosAlbumID:    config.GetPhotosAlbumId(),
    PhotosAlbumTitle: config.GetPhotosAlbumTitle(),
  }, nil
}

func toStorageProviderString(provider adminconfigv1.StorageProviderKind) (string, error) {
  switch provider {
  case adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_GOOGLE_DRIVE:
    return "google_drive", nil
  case adminconfigv1.StorageProviderKind_STORAGE_PROVIDER_KIND_GOOGLE_PHOTOS:
    return "google_photos", nil
  default:
    return "", fmt.Errorf("unsupported storage provider")
  }
}
