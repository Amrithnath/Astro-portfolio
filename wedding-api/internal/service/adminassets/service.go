package adminassets

import (
  "bytes"
  "context"
  "crypto/rand"
  "encoding/hex"
  "fmt"
  "io"
  "path/filepath"
  "strings"
  "time"

  adminassetsv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/admin/assets/v1"
  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
)

const (
  storageProviderR2 = "cloudflare_r2"
  maxAssetBytes     = 25 * 1024 * 1024
)

func MaxAssetBytes() int64 {
  return maxAssetBytes
}

type StatusError struct {
  Status  int
  Message string
}

func (e *StatusError) Error() string {
  return e.Message
}

type ObjectStore interface {
  PutObject(ctx context.Context, key string, contentType string, body io.Reader) error
  DeleteObject(ctx context.Context, key string) error
}

type Service struct {
  env   appconfig.Env
  db    *postgres.DB
  store ObjectStore
}

func New(env appconfig.Env, db *postgres.DB, store ObjectStore) *Service {
  return &Service{env: env, db: db, store: store}
}

func (s *Service) ListAssets(ctx context.Context) (*adminassetsv1.ListAssetsResponse, error) {
  assets, err := s.db.ListAssets(ctx)
  if err != nil {
    return nil, err
  }

  payload := &adminassetsv1.ListAssetsResponse{Assets: make([]*adminassetsv1.Asset, 0, len(assets))}
  for _, asset := range assets {
    payload.Assets = append(payload.Assets, toProtoAsset(asset))
  }

  return payload, nil
}

func (s *Service) CreateAssetUpload(ctx context.Context, adminID string, request *adminassetsv1.CreateAssetUploadRequest, uploadBaseURL string) (*adminassetsv1.CreateAssetUploadResponse, error) {
  if err := s.validateWritableStore(); err != nil {
    return nil, err
  }

  fileName := strings.TrimSpace(request.GetFileName())
  if fileName == "" {
    return nil, &StatusError{Status: 400, Message: "A file name is required."}
  }

  kind := sanitizeKind(request.GetKind())
  if kind == "" {
    return nil, &StatusError{Status: 400, Message: "An asset kind is required."}
  }

  contentType := strings.TrimSpace(request.GetContentType())
  if contentType == "" || !strings.HasPrefix(contentType, "image/") {
    return nil, &StatusError{Status: 400, Message: "Only image assets are supported right now."}
  }

  title := inferAssetTitle(fileName)
  if title == "" {
    title = "Untitled asset"
  }

  storageKey := buildStorageKey(kind, fileName)
  publicURL := strings.TrimRight(s.env.R2PublicBaseURL, "/") + "/" + storageKey

  var createdBy *string
  if strings.TrimSpace(adminID) != "" {
    createdBy = &adminID
  }

  asset, err := s.db.CreateAsset(ctx, models.AssetRecord{
    Kind:            kind,
    Title:           title,
    StorageProvider: storageProviderR2,
    StorageKey:      storageKey,
    PublicURL:       publicURL,
    CreatedBy:       createdBy,
  })
  if err != nil {
    return nil, err
  }

  return &adminassetsv1.CreateAssetUploadResponse{
    AssetId:   asset.ID,
    UploadUrl: strings.TrimRight(uploadBaseURL, "/") + "/api/admin/assets/" + asset.ID + "/content",
    PublicUrl: asset.PublicURL,
  }, nil
}

func (s *Service) UploadAssetContent(ctx context.Context, assetID string, contentType string, body io.Reader) error {
  if err := s.validateWritableStore(); err != nil {
    return err
  }

  asset, err := s.db.GetAssetByID(ctx, strings.TrimSpace(assetID))
  if err != nil {
    if err == postgres.ErrAssetNotFound {
      return &StatusError{Status: 404, Message: "Asset not found."}
    }
    return err
  }

  if strings.TrimSpace(contentType) == "" || !strings.HasPrefix(contentType, "image/") {
    return &StatusError{Status: 400, Message: "Only image assets are supported right now."}
  }

  payload, err := io.ReadAll(io.LimitReader(body, maxAssetBytes+1))
  if err != nil {
    return &StatusError{Status: 400, Message: "Asset upload body could not be read."}
  }

  if len(payload) == 0 {
    return &StatusError{Status: 400, Message: "Asset body is required."}
  }

  if int64(len(payload)) > maxAssetBytes {
    return &StatusError{Status: 413, Message: fmt.Sprintf("Theme assets above %d bytes are not supported yet.", maxAssetBytes)}
  }

  if err := s.store.PutObject(ctx, asset.StorageKey, contentType, bytes.NewReader(payload)); err != nil {
    if statusErr, ok := err.(*StatusError); ok {
      return statusErr
    }
    return &StatusError{Status: 502, Message: err.Error()}
  }

  return nil
}

func (s *Service) DeleteAsset(ctx context.Context, assetID string) (*adminassetsv1.DeleteAssetResponse, error) {
  if err := s.validateWritableStore(); err != nil {
    return nil, err
  }

  asset, err := s.db.GetAssetByID(ctx, strings.TrimSpace(assetID))
  if err != nil {
    if err == postgres.ErrAssetNotFound {
      return nil, &StatusError{Status: 404, Message: "Asset not found."}
    }
    return nil, err
  }

  if err := s.store.DeleteObject(ctx, asset.StorageKey); err != nil {
    if statusErr, ok := err.(*StatusError); ok {
      return nil, statusErr
    }
    return nil, &StatusError{Status: 502, Message: err.Error()}
  }

  if err := s.db.DeleteAsset(ctx, asset.ID); err != nil {
    if err == postgres.ErrAssetNotFound {
      return nil, &StatusError{Status: 404, Message: "Asset not found."}
    }
    return nil, err
  }

  return &adminassetsv1.DeleteAssetResponse{}, nil
}

func (s *Service) validateWritableStore() error {
  missing := []string{}
  if strings.TrimSpace(s.env.R2AccountID) == "" {
    missing = append(missing, "R2_ACCOUNT_ID")
  }
  if strings.TrimSpace(s.env.R2BucketName) == "" {
    missing = append(missing, "R2_BUCKET_NAME")
  }
  if strings.TrimSpace(s.env.R2AccessKeyID) == "" {
    missing = append(missing, "R2_ACCESS_KEY_ID")
  }
  if strings.TrimSpace(s.env.R2SecretAccessKey) == "" {
    missing = append(missing, "R2_SECRET_ACCESS_KEY")
  }
  if strings.TrimSpace(s.env.R2PublicBaseURL) == "" {
    missing = append(missing, "R2_PUBLIC_BASE_URL")
  }
  if len(missing) > 0 {
    return &StatusError{Status: 503, Message: "Asset storage is not configured yet. Set " + strings.Join(missing, ", ") + " before uploading theme assets."}
  }
  if s.store == nil {
    return &StatusError{Status: 503, Message: "Asset storage is not configured yet."}
  }
  return nil
}

func toProtoAsset(asset models.AssetRecord) *adminassetsv1.Asset {
  return &adminassetsv1.Asset{
    Id:            asset.ID,
    Kind:          asset.Kind,
    Title:         asset.Title,
    PublicUrl:     asset.PublicURL,
    CreatedAtUnix: asset.CreatedAt.Unix(),
  }
}

func inferAssetTitle(fileName string) string {
  base := strings.TrimSuffix(filepath.Base(fileName), filepath.Ext(fileName))
  base = strings.ReplaceAll(base, "-", " ")
  base = strings.ReplaceAll(base, "_", " ")
  return strings.TrimSpace(base)
}

func sanitizeKind(kind string) string {
  kind = strings.TrimSpace(strings.ToLower(kind))
  if kind == "" {
    return ""
  }

  var builder strings.Builder
  lastDash := false
  for _, r := range kind {
    allowed := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
    if allowed {
      builder.WriteRune(r)
      lastDash = false
      continue
    }

    if !lastDash {
      builder.WriteRune('-')
      lastDash = true
    }
  }

  return strings.Trim(builder.String(), "-")
}

func buildStorageKey(kind string, fileName string) string {
  ext := strings.ToLower(filepath.Ext(fileName))
  if len(ext) > 12 {
    ext = ext[:12]
  }

  timestamp := time.Now().UTC().Format("20060102T150405Z")
  return fmt.Sprintf("%s/%s-%s%s", kind, timestamp, randomHex(6), ext)
}

func randomHex(byteCount int) string {
  buffer := make([]byte, byteCount)
  if _, err := rand.Read(buffer); err != nil {
    return strings.Repeat("0", byteCount*2)
  }
  return hex.EncodeToString(buffer)
}
