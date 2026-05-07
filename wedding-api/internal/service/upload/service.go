package upload

import (
  "context"
  "crypto/rand"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "fmt"
  "path/filepath"
  "strings"
  "time"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
)

const MaxChunkBytes int64 = 5 * 1024 * 1024

type Provider interface {
  BeginUpload(ctx context.Context, storedName string, mimeType string, storage models.StorageProviderConfig) (string, error)
  UploadChunk(ctx context.Context, sessionRef string, mimeType string, contentRange string, chunk []byte) (ChunkResult, error)
}

type ChunkResult struct {
  NextOffset         int64
  Complete           bool
  ProviderResourceID string
}

type StatusError struct {
  Status            int
  Message           string
  RetryAfterSeconds int
  NextOffset        int64
  HasNextOffset     bool
}

func (e *StatusError) Error() string {
  return e.Message
}

type InitUploadResponse struct {
  UploadID      string   `json:"uploadId"`
  ChunkBytes    int64    `json:"chunkBytes"`
  MaxFileBytes  int64    `json:"maxFileBytes"`
  AcceptedTypes []string `json:"acceptedTypes"`
  ExpiresAt     int64    `json:"expiresAt"`
}

type UploadChunkResponse struct {
  NextOffset int64  `json:"nextOffset"`
  Complete   bool   `json:"complete"`
  FileID     string `json:"fileId,omitempty"`
}

type Service struct {
  env      appconfig.Env
  db       *postgres.DB
  provider Provider
}

func New(env appconfig.Env, db *postgres.DB, provider Provider) *Service {
  return &Service{env: env, db: db, provider: provider}
}

func (s *Service) InitUpload(ctx context.Context, ip string, filename string, mimeType string, fileSize int64) (*InitUploadResponse, error) {
  if err := s.db.DeleteExpiredUploadSessions(ctx, time.Now().UTC()); err != nil {
    return nil, err
  }

  bundle, err := s.db.LoadWeddingConfig(ctx)
  if err != nil {
    return nil, err
  }

  if !bundle.Public.Enabled || !bundle.Policy.UploadsEnabled {
    message := bundle.Policy.MaintenanceMessage
    if strings.TrimSpace(message) == "" {
      message = bundle.Public.ClosedMessage
    }
    if strings.TrimSpace(message) == "" {
      message = "Uploads are unavailable right now."
    }
    return nil, &StatusError{Status: 503, Message: message}
  }

  if strings.TrimSpace(filename) == "" {
    return nil, &StatusError{Status: 400, Message: "A filename is required."}
  }

  mimeType = strings.TrimSpace(mimeType)
  if mimeType == "" || !contains(bundle.Policy.AllowedMIMETypes, mimeType) {
    return nil, &StatusError{Status: 400, Message: "Only supported image and video uploads are allowed."}
  }

  if fileSize <= 0 {
    return nil, &StatusError{Status: 400, Message: "A valid file size is required."}
  }

  if bundle.Policy.MaxFileBytes > 0 && fileSize > bundle.Policy.MaxFileBytes {
    return nil, &StatusError{Status: 413, Message: fmt.Sprintf("Files above %s are not accepted.", formatGigabyteLimit(bundle.Policy.MaxFileBytes))}
  }

  if bundle.Storage.Provider != "google_drive" {
    return nil, &StatusError{Status: 503, Message: "The active storage provider is not ready for guest uploads yet."}
  }

  if strings.TrimSpace(bundle.Storage.DriveFolderID) == "" {
    return nil, &StatusError{Status: 503, Message: "Upload storage is not configured yet. Add a Google Drive folder before collecting files."}
  }

  ipHash := hashIP(ip)
  activeCount, err := s.db.CountActiveUploadSessionsByIP(ctx, ipHash)
  if err != nil {
    return nil, err
  }

  if bundle.Policy.MaxActiveUploadsPerIP > 0 && activeCount >= bundle.Policy.MaxActiveUploadsPerIP {
    return nil, &StatusError{Status: 429, Message: "Too many active uploads from this network. Please finish one before starting another."}
  }

  storedName := sanitizeFilename(filename)
  providerSessionRef, err := s.provider.BeginUpload(ctx, storedName, mimeType, bundle.Storage)
  if err != nil {
    return nil, mapStatusError(err, 503)
  }

  expiresAt := time.Now().UTC().Add(time.Duration(bundle.Policy.UploadSessionTTLMS) * time.Millisecond)
  snapshot, err := json.Marshal(map[string]any{
    "uploadPolicy": bundle.Policy,
    "storage":      bundle.Storage,
  })
  if err != nil {
    return nil, fmt.Errorf("encode upload session snapshot: %w", err)
  }

  session, err := s.db.CreateUploadSession(ctx, models.UploadSession{
    Provider:              bundle.Storage.Provider,
    ProviderSessionRef:    providerSessionRef,
    StoragePolicySnapshot: snapshot,
    OriginalName:          filename,
    StoredName:            storedName,
    MimeType:              mimeType,
    TotalBytes:            fileSize,
    NextOffset:            0,
    Complete:              false,
    ExpiresAt:             expiresAt,
    IPHash:                ipHash,
  })
  if err != nil {
    return nil, err
  }

  return &InitUploadResponse{
    UploadID:      session.ID,
    ChunkBytes:    MaxChunkBytes,
    MaxFileBytes:  bundle.Policy.MaxFileBytes,
    AcceptedTypes: append([]string(nil), bundle.Policy.AllowedMIMETypes...),
    ExpiresAt:     expiresAt.UnixMilli(),
  }, nil
}

func (s *Service) UploadChunk(ctx context.Context, uploadID string, offset int64, contentRange string, chunk []byte) (*UploadChunkResponse, error) {
  if err := s.db.DeleteExpiredUploadSessions(ctx, time.Now().UTC()); err != nil {
    return nil, err
  }

  if strings.TrimSpace(uploadID) == "" {
    return nil, &StatusError{Status: 400, Message: "uploadId is required."}
  }

  if offset < 0 {
    return nil, &StatusError{Status: 400, Message: "A valid upload offset is required."}
  }

  if len(chunk) == 0 {
    return nil, &StatusError{Status: 400, Message: "A chunk file is required."}
  }

  if int64(len(chunk)) > MaxChunkBytes {
    return nil, &StatusError{Status: 413, Message: fmt.Sprintf("Chunk exceeded the %d byte limit.", MaxChunkBytes)}
  }

  session, err := s.db.GetUploadSession(ctx, uploadID)
  if err != nil {
    if err == postgres.ErrUploadSessionNotFound {
      return nil, &StatusError{Status: 410, Message: "This upload session has expired. Start the file again."}
    }
    return nil, err
  }

  if session.Complete {
    return &UploadChunkResponse{NextOffset: session.TotalBytes, Complete: true}, nil
  }

  if session.ExpiresAt.Before(time.Now().UTC()) {
    return nil, &StatusError{Status: 410, Message: "This upload session has expired. Start the file again."}
  }

  if offset != session.NextOffset {
    return nil, &StatusError{Status: 409, Message: "Chunk offset is out of sync.", NextOffset: session.NextOffset, HasNextOffset: true}
  }

  parsedRange, err := parseContentRange(contentRange)
  if err != nil {
    return nil, err
  }

  if parsedRange.Total != session.TotalBytes {
    return nil, &StatusError{Status: 400, Message: "Chunk total size does not match the initialized file size."}
  }

  if parsedRange.Start != session.NextOffset {
    return nil, &StatusError{Status: 409, Message: "Chunk range is out of sync.", NextOffset: session.NextOffset, HasNextOffset: true}
  }

  expectedLength := parsedRange.End - parsedRange.Start + 1
  if expectedLength != int64(len(chunk)) {
    return nil, &StatusError{Status: 400, Message: "Chunk size does not match Content-Range."}
  }

  if session.NextOffset == 0 {
    if err := validateFirstChunk(session.MimeType, chunk); err != nil {
      return nil, err
    }
  }

  providerResult, err := s.provider.UploadChunk(ctx, session.ProviderSessionRef, session.MimeType, contentRange, chunk)
  if err != nil {
    return nil, mapStatusError(err, 502)
  }

  nextOffset := providerResult.NextOffset
  if providerResult.Complete {
    nextOffset = session.TotalBytes
  }
  if nextOffset <= session.NextOffset {
    nextOffset = parsedRange.End + 1
  }
  if nextOffset > session.TotalBytes {
    nextOffset = session.TotalBytes
  }

  if err := s.db.UpdateUploadSessionProgress(ctx, session.ID, nextOffset, providerResult.Complete); err != nil {
    return nil, err
  }

  response := &UploadChunkResponse{
    NextOffset: nextOffset,
    Complete:   providerResult.Complete,
  }
  if providerResult.Complete {
    response.FileID = providerResult.ProviderResourceID
  }

  return response, nil
}

type contentRange struct {
  Start int64
  End   int64
  Total int64
}

func parseContentRange(value string) (contentRange, error) {
  var parsed contentRange
  if _, err := fmt.Sscanf(strings.TrimSpace(value), "bytes %d-%d/%d", &parsed.Start, &parsed.End, &parsed.Total); err != nil {
    return contentRange{}, &StatusError{Status: 400, Message: "Missing or invalid Content-Range header."}
  }

  if parsed.Start < 0 || parsed.End < parsed.Start || parsed.Total <= 0 {
    return contentRange{}, &StatusError{Status: 400, Message: "Invalid byte range in Content-Range header."}
  }

  return parsed, nil
}

func validateFirstChunk(mimeType string, chunk []byte) error {
  sniffedMimeType := sniffMimeType(chunk)
  if sniffedMimeType == "" {
    return &StatusError{Status: 400, Message: "The file could not be verified as a supported image or video."}
  }

  if strings.HasPrefix(mimeType, "image/") && !strings.HasPrefix(sniffedMimeType, "image/") {
    return &StatusError{Status: 400, Message: "The uploaded bytes do not match the declared media type."}
  }

  if strings.HasPrefix(mimeType, "video/") && !strings.HasPrefix(sniffedMimeType, "video/") {
    return &StatusError{Status: 400, Message: "The uploaded bytes do not match the declared media type."}
  }

  return nil
}

func sniffMimeType(chunk []byte) string {
  if len(chunk) < 12 {
    return ""
  }

  if chunk[0] == 0xff && chunk[1] == 0xd8 && chunk[2] == 0xff {
    return "image/jpeg"
  }

  if chunk[0] == 0x89 && chunk[1] == 0x50 && chunk[2] == 0x4e && chunk[3] == 0x47 {
    return "image/png"
  }

  asciiHeader := string(chunk[:min(12, len(chunk))])
  if strings.HasPrefix(asciiHeader, "GIF87a") || strings.HasPrefix(asciiHeader, "GIF89a") {
    return "image/gif"
  }

  if string(chunk[:4]) == "RIFF" && string(chunk[8:12]) == "WEBP" {
    return "image/webp"
  }

  if string(chunk[4:8]) == "ftyp" {
    brand := strings.ToLower(strings.TrimSpace(string(chunk[8:12])))
    if brand == "qt" {
      return "video/quicktime"
    }
    if strings.HasPrefix(brand, "hei") || brand == "mif1" || brand == "msf1" {
      return "image/heic"
    }
    return "video/mp4"
  }

  if chunk[0] == 0x1a && chunk[1] == 0x45 && chunk[2] == 0xdf && chunk[3] == 0xa3 {
    return "video/webm"
  }

  return ""
}

func sanitizeFilename(filename string) string {
  ext := filepath.Ext(filename)
  if len(ext) > 12 {
    ext = ext[:12]
  }

  stem := strings.TrimSuffix(filepath.Base(filename), ext)
  stem = sanitizeStem(stem)
  if stem == "" {
    stem = "upload"
  }
  if len(stem) > 80 {
    stem = stem[:80]
  }

  normalizedExt := strings.ToLower(sanitizeExtension(ext))
  timestamp := time.Now().UTC().Format("2006-01-02T15-04-05-000Z")
  suffix := randomHex(4)
  return fmt.Sprintf("%s-%s-%s%s", timestamp, suffix, stem, normalizedExt)
}

func sanitizeStem(value string) string {
  var builder strings.Builder
  lastWasSpace := false

  for _, r := range value {
    allowed := (r >= 'a' && r <= 'z') ||
      (r >= 'A' && r <= 'Z') ||
      (r >= '0' && r <= '9') ||
      r == '(' || r == ')' || r == '_' || r == '.' || r == '-'

    if allowed {
      builder.WriteRune(r)
      lastWasSpace = false
      continue
    }

    if r == ' ' {
      if !lastWasSpace {
        builder.WriteRune(' ')
      }
      lastWasSpace = true
      continue
    }

    builder.WriteRune('-')
    lastWasSpace = false
  }

  return strings.TrimSpace(builder.String())
}

func sanitizeExtension(value string) string {
  var builder strings.Builder
  for _, r := range value {
    if r == '.' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
      builder.WriteRune(r)
    }
  }
  return builder.String()
}

func randomHex(byteCount int) string {
  buffer := make([]byte, byteCount)
  if _, err := rand.Read(buffer); err != nil {
    return "00000000"
  }
  return hex.EncodeToString(buffer)
}

func hashIP(ip string) string {
  hashed := sha256.Sum256([]byte(strings.TrimSpace(ip)))
  return hex.EncodeToString(hashed[:])
}

func contains(values []string, target string) bool {
  for _, value := range values {
    if value == target {
      return true
    }
  }
  return false
}

func formatGigabyteLimit(bytes int64) string {
  if bytes <= 0 {
    return "0 GB"
  }
  gigabytes := float64(bytes) / float64(1024*1024*1024)
  if gigabytes >= 10 {
    return fmt.Sprintf("%.0f GB", gigabytes)
  }
  return fmt.Sprintf("%.1f GB", gigabytes)
}

func mapStatusError(err error, fallbackStatus int) error {
  var statusErr *StatusError
  if ok := AsStatusError(err, &statusErr); ok {
    return statusErr
  }
  return &StatusError{Status: fallbackStatus, Message: err.Error()}
}

func AsStatusError(err error, target **StatusError) bool {
  statusErr, ok := err.(*StatusError)
  if !ok {
    return false
  }
  *target = statusErr
  return true
}

func min(a int, b int) int {
  if a < b {
    return a
  }
  return b
}
