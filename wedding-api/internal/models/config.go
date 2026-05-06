package models

type WeddingPublicConfig struct {
  Enabled        bool   `json:"enabled"`
  Names          string `json:"names"`
  Eyebrow        string `json:"eyebrow"`
  Headline       string `json:"headline"`
  Subheadline    string `json:"subheadline"`
  DropzoneCopy   string `json:"dropzoneCopy"`
  SupportingCopy string `json:"supportingCopy"`
  SuccessTitle   string `json:"successTitle"`
  SuccessMessage string `json:"successMessage"`
  ClosedMessage  string `json:"closedMessage"`
}

type WeddingThemeConfig struct {
  Preset           string `json:"preset"`
  TypographyPreset string `json:"typographyPreset"`
  PrimaryAccent    string `json:"primaryAccent"`
  SecondaryAccent  string `json:"secondaryAccent"`
  SurfaceStyle     string `json:"surfaceStyle"`
  HeroAssetID      string `json:"heroAssetId"`
  TextureAssetID   string `json:"textureAssetId"`
  ButtonStyle      string `json:"buttonStyle"`
}

type UploadPolicyConfig struct {
  UploadsEnabled        bool     `json:"uploadsEnabled"`
  MaxFileBytes          int64    `json:"maxFileBytes"`
  MaxActiveUploadsPerIP int64    `json:"maxActiveUploadsPerIp"`
  UploadSessionTTLMS    int64    `json:"uploadSessionTtlMs"`
  AllowedMIMETypes      []string `json:"allowedMimeTypes"`
  MaintenanceMessage    string   `json:"maintenanceMessage"`
}

type StorageProviderConfig struct {
  Provider            string `json:"provider"`
  DriveFolderID       string `json:"driveFolderId"`
  DriveFolderLabel    string `json:"driveFolderLabel"`
  PhotosEnabled       bool   `json:"photosEnabled"`
  PhotosAlbumID       string `json:"photosAlbumId"`
  PhotosAlbumTitle    string `json:"photosAlbumTitle"`
  ValidatedAt         *int64 `json:"validatedAt"`
  LastValidationError string `json:"lastValidationError"`
}

type Asset struct {
  ID        string `json:"id"`
  Kind      string `json:"kind"`
  Title     string `json:"title"`
  PublicURL string `json:"publicUrl"`
}

type WeddingConfigBundle struct {
  Public  WeddingPublicConfig
  Theme   WeddingThemeConfig
  Policy  UploadPolicyConfig
  Storage StorageProviderConfig
}
