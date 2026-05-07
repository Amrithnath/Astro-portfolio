package router

import (
  "bytes"
  "context"
  "encoding/json"
  "mime/multipart"
  "net/http"
  "net/http/httptest"
  "strconv"
  "strings"
  "testing"
  "time"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/repo/postgres"
  uploadservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/upload"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/testutil"
)

func TestWeddingConfigEndpointReturnsDatabaseBackedConfig(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  handler := New(env, db)

  request := httptest.NewRequest(http.MethodGet, "/api/public/wedding-config", nil)
  recorder := httptest.NewRecorder()

  handler.ServeHTTP(recorder, request)

  if recorder.Code != http.StatusOK {
    t.Fatalf("expected 200, got %d", recorder.Code)
  }

  var payload struct {
    PublicData struct {
      Headline string `json:"headline"`
      Eyebrow  string `json:"eyebrow"`
    } `json:"publicData"`
    Theme struct {
      Preset string `json:"preset"`
    } `json:"theme"`
    UploadPolicy struct {
      UploadsEnabled bool `json:"uploadsEnabled"`
    } `json:"uploadPolicy"`
  }

  if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
    t.Fatalf("decode payload: %v", err)
  }

  if payload.PublicData.Headline != "Share the moments you caught." {
    t.Fatalf("expected seeded headline, got %q", payload.PublicData.Headline)
  }

  if payload.PublicData.Eyebrow != "wedding.media://dropbox" {
    t.Fatalf("expected seeded eyebrow, got %q", payload.PublicData.Eyebrow)
  }

  if payload.Theme.Preset != "terminal-romance" {
    t.Fatalf("expected seeded preset, got %q", payload.Theme.Preset)
  }

  if !payload.UploadPolicy.UploadsEnabled {
    t.Fatalf("expected uploads to be enabled")
  }
}

func TestAdminSessionRequiresKnownAccessEmail(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  if err := db.SeedAdmins(t.Context(), []string{"arjun.amrith@gmail.com"}); err != nil {
    t.Fatalf("seed admins: %v", err)
  }

  handler := New(env, db)

  t.Run("missing access header", func(t *testing.T) {
    request := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
    recorder := httptest.NewRecorder()

    handler.ServeHTTP(recorder, request)

    if recorder.Code != http.StatusUnauthorized {
      t.Fatalf("expected 401, got %d", recorder.Code)
    }
  })

  t.Run("unknown admin email", func(t *testing.T) {
    request := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
    request.Header.Set("Cf-Access-Authenticated-User-Email", "unknown@example.com")
    recorder := httptest.NewRecorder()

    handler.ServeHTTP(recorder, request)

    if recorder.Code != http.StatusUnauthorized {
      t.Fatalf("expected 401, got %d", recorder.Code)
    }
  })

  t.Run("seeded admin returns session", func(t *testing.T) {
    request := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
    request.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
    recorder := httptest.NewRecorder()

    before := time.Now().Add(29 * time.Minute).Unix()
    handler.ServeHTTP(recorder, request)
    after := time.Now().Add(31 * time.Minute).Unix()

    if recorder.Code != http.StatusOK {
      t.Fatalf("expected 200, got %d", recorder.Code)
    }

    var payload struct {
      Session struct {
        AccessEmail    string `json:"accessEmail"`
        ExpiresAtUnix  string `json:"expiresAtUnix"`
        RequiresStepUp bool   `json:"requiresStepUp"`
        Admin          struct {
          Email string `json:"email"`
        } `json:"admin"`
      } `json:"session"`
    }

    if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
      t.Fatalf("decode session payload: %v", err)
    }

    if payload.Session.AccessEmail != "arjun.amrith@gmail.com" {
      t.Fatalf("expected access email to match seeded admin, got %q", payload.Session.AccessEmail)
    }

    if payload.Session.Admin.Email != "arjun.amrith@gmail.com" {
      t.Fatalf("expected admin email to match seeded admin, got %q", payload.Session.Admin.Email)
    }

    if !payload.Session.RequiresStepUp {
      t.Fatalf("expected session to require step up")
    }

    expiresAtUnix, err := strconv.ParseInt(payload.Session.ExpiresAtUnix, 10, 64)
    if err != nil {
      t.Fatalf("parse expiresAtUnix: %v", err)
    }

    if expiresAtUnix < before || expiresAtUnix > after {
      t.Fatalf("expected expiry between %d and %d, got %d", before, after, expiresAtUnix)
    }
  })

  t.Run("debug email works outside production", func(t *testing.T) {
    request := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
    request.Header.Set("X-Admin-Debug-Email", "arjun.amrith@gmail.com")
    recorder := httptest.NewRecorder()

    handler.ServeHTTP(recorder, request)

    if recorder.Code != http.StatusOK {
      t.Fatalf("expected 200, got %d", recorder.Code)
    }
  })
}

func TestAdminConfigRequiresAdminSession(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  handler := New(env, db)

  request := httptest.NewRequest(http.MethodGet, "/api/admin/config/wedding-public", nil)
  recorder := httptest.NewRecorder()

  handler.ServeHTTP(recorder, request)

  if recorder.Code != http.StatusUnauthorized {
    t.Fatalf("expected 401, got %d", recorder.Code)
  }
}

func TestAdminWeddingPublicConfigCanBeUpdatedBySeededAdmin(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  if err := db.SeedAdmins(t.Context(), []string{"arjun.amrith@gmail.com"}); err != nil {
    t.Fatalf("seed admins: %v", err)
  }

  handler := New(env, db)

  body := strings.NewReader(`{"config":{"enabled":false,"names":"Amrith & Arjun","eyebrow":"wedding.media://vault","headline":"Send us the camera-roll gold.","subheadline":"Photos, videos, candids, and after-party chaos all belong here.","dropzoneCopy":"Share your best shots from the weekend.","supportingCopy":"Uploads run in sequence so big videos survive spotty reception.","successTitle":"Archive updated.","successMessage":"Thanks for helping us remember the day.","closedMessage":"Uploads are paused while we finish syncing the archive."}}`)
  request := httptest.NewRequest(http.MethodPut, "/api/admin/config/wedding-public", body)
  request.Header.Set("Content-Type", "application/json")
  request.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
  recorder := httptest.NewRecorder()

  handler.ServeHTTP(recorder, request)

  if recorder.Code != http.StatusOK {
    t.Fatalf("expected 200, got %d", recorder.Code)
  }

  var updatePayload struct {
    Config struct {
      Enabled      bool   `json:"enabled"`
      Names        string `json:"names"`
      Headline     string `json:"headline"`
      ClosedMessage string `json:"closedMessage"`
    } `json:"config"`
  }

  if err := json.Unmarshal(recorder.Body.Bytes(), &updatePayload); err != nil {
    t.Fatalf("decode update payload: %v", err)
  }

  if updatePayload.Config.Enabled {
    t.Fatalf("expected uploads to be disabled in updated config")
  }

  if updatePayload.Config.Names != "Amrith & Arjun" {
    t.Fatalf("expected updated names, got %q", updatePayload.Config.Names)
  }

  if updatePayload.Config.Headline != "Send us the camera-roll gold." {
    t.Fatalf("expected updated headline, got %q", updatePayload.Config.Headline)
  }

  getRequest := httptest.NewRequest(http.MethodGet, "/api/admin/config/wedding-public", nil)
  getRequest.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
  getRecorder := httptest.NewRecorder()

  handler.ServeHTTP(getRecorder, getRequest)

  if getRecorder.Code != http.StatusOK {
    t.Fatalf("expected 200 from follow-up get, got %d", getRecorder.Code)
  }

  var getPayload struct {
    Config struct {
      Enabled       bool   `json:"enabled"`
      Names         string `json:"names"`
      Headline      string `json:"headline"`
      ClosedMessage string `json:"closedMessage"`
    } `json:"config"`
  }

  if err := json.Unmarshal(getRecorder.Body.Bytes(), &getPayload); err != nil {
    t.Fatalf("decode get payload: %v", err)
  }

  if getPayload.Config.Enabled {
    t.Fatalf("expected persisted config to remain disabled")
  }

  if getPayload.Config.ClosedMessage != "Uploads are paused while we finish syncing the archive." {
    t.Fatalf("expected persisted closed message, got %q", getPayload.Config.ClosedMessage)
  }
}

func TestAdminRoutesAllowConfiguredCORSOrigin(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  handler := New(env, db)

  request := httptest.NewRequest(http.MethodOptions, "/api/admin/config/wedding-public", nil)
  request.Header.Set("Origin", env.AdminSiteOrigin)
  request.Header.Set("Access-Control-Request-Method", http.MethodPut)
  recorder := httptest.NewRecorder()

  handler.ServeHTTP(recorder, request)

  if recorder.Code != http.StatusNoContent {
    t.Fatalf("expected 204, got %d", recorder.Code)
  }

  if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != env.AdminSiteOrigin {
    t.Fatalf("expected allow origin %q, got %q", env.AdminSiteOrigin, got)
  }

  if got := recorder.Header().Get("Access-Control-Allow-Methods"); got == "" {
    t.Fatalf("expected access-control-allow-methods header")
  }
}

func TestAdminWeddingThemeConfigCanBeUpdatedBySeededAdmin(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  if err := db.SeedAdmins(t.Context(), []string{"arjun.amrith@gmail.com"}); err != nil {
    t.Fatalf("seed admins: %v", err)
  }

  handler := New(env, db)

  body := strings.NewReader(`{"config":{"preset":"nocturne-glass","typographyPreset":"modern-editorial","primaryAccent":"#ff7ab6","secondaryAccent":"#f4d35e","surfaceStyle":"velvet","heroAssetId":"hero-asset-01","textureAssetId":"texture-asset-01","buttonStyle":"rounded-rectangle"}}`)
  request := httptest.NewRequest(http.MethodPut, "/api/admin/config/wedding-theme", body)
  request.Header.Set("Content-Type", "application/json")
  request.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
  recorder := httptest.NewRecorder()

  handler.ServeHTTP(recorder, request)

  if recorder.Code != http.StatusOK {
    t.Fatalf("expected 200, got %d", recorder.Code)
  }

  var payload struct {
    Config struct {
      Preset        string `json:"preset"`
      HeroAssetId   string `json:"heroAssetId"`
      PrimaryAccent string `json:"primaryAccent"`
    } `json:"config"`
  }

  if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
    t.Fatalf("decode theme payload: %v", err)
  }

  if payload.Config.Preset != "nocturne-glass" {
    t.Fatalf("expected updated preset, got %q", payload.Config.Preset)
  }

  if payload.Config.HeroAssetId != "hero-asset-01" {
    t.Fatalf("expected updated hero asset, got %q", payload.Config.HeroAssetId)
  }

  if payload.Config.PrimaryAccent != "#ff7ab6" {
    t.Fatalf("expected updated primary accent, got %q", payload.Config.PrimaryAccent)
  }
}

func TestAdminUploadPolicyConfigCanBeUpdatedBySeededAdmin(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  if err := db.SeedAdmins(t.Context(), []string{"arjun.amrith@gmail.com"}); err != nil {
    t.Fatalf("seed admins: %v", err)
  }

  handler := New(env, db)

  body := strings.NewReader(`{"config":{"uploadsEnabled":false,"maxFileBytes":"524288000","maxActiveUploadsPerIp":"3","uploadSessionTtlMs":"7200000","allowedMimeTypes":["image/jpeg","video/mp4"],"maintenanceMessage":"Uploads are paused while we migrate storage."}}`)
  request := httptest.NewRequest(http.MethodPut, "/api/admin/config/upload-policy", body)
  request.Header.Set("Content-Type", "application/json")
  request.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
  recorder := httptest.NewRecorder()

  handler.ServeHTTP(recorder, request)

  if recorder.Code != http.StatusOK {
    t.Fatalf("expected 200, got %d", recorder.Code)
  }

  var payload struct {
    Config struct {
      UploadsEnabled       bool     `json:"uploadsEnabled"`
      MaxFileBytes         string   `json:"maxFileBytes"`
      MaxActiveUploadsPerIp string  `json:"maxActiveUploadsPerIp"`
      AllowedMimeTypes     []string `json:"allowedMimeTypes"`
    } `json:"config"`
  }

  if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
    t.Fatalf("decode upload policy payload: %v", err)
  }

  if payload.Config.UploadsEnabled {
    t.Fatalf("expected uploads to be disabled")
  }

  if payload.Config.MaxFileBytes != "524288000" {
    t.Fatalf("expected updated max file bytes, got %q", payload.Config.MaxFileBytes)
  }

  if len(payload.Config.AllowedMimeTypes) != 2 {
    t.Fatalf("expected two allowed mime types, got %d", len(payload.Config.AllowedMimeTypes))
  }
}

func TestAdminStorageProviderConfigCanBeUpdatedBySeededAdmin(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)

  if err := db.SeedAdmins(t.Context(), []string{"arjun.amrith@gmail.com"}); err != nil {
    t.Fatalf("seed admins: %v", err)
  }

  handler := New(env, db)

  t.Run("drive config persists validated state", func(t *testing.T) {
    body := strings.NewReader(`{"config":{"provider":"STORAGE_PROVIDER_KIND_GOOGLE_DRIVE","driveFolderId":"drive-folder-123","driveFolderLabel":"Wedding Uploads","photosEnabled":false,"photosAlbumId":"","photosAlbumTitle":""}}`)
    request := httptest.NewRequest(http.MethodPut, "/api/admin/config/storage-provider", body)
    request.Header.Set("Content-Type", "application/json")
    request.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
    recorder := httptest.NewRecorder()

    handler.ServeHTTP(recorder, request)

    if recorder.Code != http.StatusOK {
      t.Fatalf("expected 200, got %d", recorder.Code)
    }

    var payload struct {
      Config struct {
        Provider            string `json:"provider"`
        DriveFolderId       string `json:"driveFolderId"`
        LastValidationError string `json:"lastValidationError"`
        ValidatedAtUnix     string `json:"validatedAtUnix"`
      } `json:"config"`
    }

    if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
      t.Fatalf("decode storage payload: %v", err)
    }

    if payload.Config.Provider != "STORAGE_PROVIDER_KIND_GOOGLE_DRIVE" {
      t.Fatalf("expected google drive provider, got %q", payload.Config.Provider)
    }

    if payload.Config.DriveFolderId != "drive-folder-123" {
      t.Fatalf("expected persisted drive folder id, got %q", payload.Config.DriveFolderId)
    }

    if payload.Config.LastValidationError != "" {
      t.Fatalf("expected no validation error, got %q", payload.Config.LastValidationError)
    }

    validatedAt, err := strconv.ParseInt(payload.Config.ValidatedAtUnix, 10, 64)
    if err != nil {
      t.Fatalf("parse validatedAtUnix: %v", err)
    }

    if validatedAt <= 0 {
      t.Fatalf("expected validatedAtUnix to be populated, got %d", validatedAt)
    }
  })

  t.Run("photos config persists validation message", func(t *testing.T) {
    body := strings.NewReader(`{"config":{"provider":"STORAGE_PROVIDER_KIND_GOOGLE_PHOTOS","driveFolderId":"","driveFolderLabel":"","photosEnabled":true,"photosAlbumId":"album-123","photosAlbumTitle":"Reception Highlights"}}`)
    request := httptest.NewRequest(http.MethodPut, "/api/admin/config/storage-provider", body)
    request.Header.Set("Content-Type", "application/json")
    request.Header.Set("Cf-Access-Authenticated-User-Email", "arjun.amrith@gmail.com")
    recorder := httptest.NewRecorder()

    handler.ServeHTTP(recorder, request)

    if recorder.Code != http.StatusOK {
      t.Fatalf("expected 200, got %d", recorder.Code)
    }

    var payload struct {
      Config struct {
        Provider            string `json:"provider"`
        PhotosAlbumId       string `json:"photosAlbumId"`
        LastValidationError string `json:"lastValidationError"`
        ValidatedAtUnix     string `json:"validatedAtUnix"`
      } `json:"config"`
    }

    if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
      t.Fatalf("decode photos payload: %v", err)
    }

    if payload.Config.Provider != "STORAGE_PROVIDER_KIND_GOOGLE_PHOTOS" {
      t.Fatalf("expected google photos provider, got %q", payload.Config.Provider)
    }

    if payload.Config.PhotosAlbumId != "album-123" {
      t.Fatalf("expected persisted photos album id, got %q", payload.Config.PhotosAlbumId)
    }

    if payload.Config.LastValidationError == "" {
      t.Fatalf("expected validation error for google photos")
    }

    if payload.Config.ValidatedAtUnix != "" {
      t.Fatalf("expected validatedAtUnix to be omitted for an unvalidated provider, got %q", payload.Config.ValidatedAtUnix)
    }
  })
}

func TestUploadEndpointsMatchWeddingClientContract(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)
  seedUploadReadyStorageConfig(t, db)
  jpegChunkA := []byte{0xff, 0xd8, 0xff, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02}
  jpegChunkB := []byte{0xaa, 0xbb, 0xcc}
  provider := &fakeUploadProvider{
    sessionRef: "drive-session-1",
    chunkResults: []uploadservice.ChunkResult{
      {NextOffset: 12, Complete: false},
      {NextOffset: 15, Complete: true, ProviderResourceID: "drive-file-123"},
    },
  }

  handler := NewWithUploadService(env, db, uploadservice.New(env, db, provider))

  initBody := strings.NewReader(`{"filename":"toast.jpg","mimeType":"image/jpeg","fileSize":15}`)
  initRequest := httptest.NewRequest(http.MethodPost, "/api/upload/init", initBody)
  initRequest.Header.Set("Content-Type", "application/json")
  initRequest.RemoteAddr = "127.0.0.1:12345"
  initRecorder := httptest.NewRecorder()

  handler.ServeHTTP(initRecorder, initRequest)

  if initRecorder.Code != http.StatusCreated {
    t.Fatalf("expected 201 from init, got %d", initRecorder.Code)
  }

  var initPayload struct {
    UploadID   string   `json:"uploadId"`
    ChunkBytes int64    `json:"chunkBytes"`
    ExpiresAt  int64    `json:"expiresAt"`
    Types      []string `json:"acceptedTypes"`
  }
  if err := json.Unmarshal(initRecorder.Body.Bytes(), &initPayload); err != nil {
    t.Fatalf("decode init payload: %v", err)
  }

  if initPayload.UploadID == "" {
    t.Fatalf("expected upload id in init payload")
  }

  if initPayload.ChunkBytes != uploadservice.MaxChunkBytes {
    t.Fatalf("expected chunk bytes %d, got %d", uploadservice.MaxChunkBytes, initPayload.ChunkBytes)
  }

  if initPayload.ExpiresAt <= time.Now().UnixMilli() {
    t.Fatalf("expected future expiry, got %d", initPayload.ExpiresAt)
  }

  if len(initPayload.Types) == 0 {
    t.Fatalf("expected accepted types in init payload")
  }

  firstChunkRequest := newChunkRequest(t, initPayload.UploadID, 0, "bytes 0-11/15", jpegChunkA, "toast.jpg")
  firstChunkRecorder := httptest.NewRecorder()
  handler.ServeHTTP(firstChunkRecorder, firstChunkRequest)

  if firstChunkRecorder.Code != http.StatusOK {
    t.Fatalf("expected 200 from first chunk, got %d", firstChunkRecorder.Code)
  }

  var firstChunkPayload struct {
    NextOffset int64 `json:"nextOffset"`
    Complete   bool  `json:"complete"`
  }
  if err := json.Unmarshal(firstChunkRecorder.Body.Bytes(), &firstChunkPayload); err != nil {
    t.Fatalf("decode first chunk payload: %v", err)
  }

  if firstChunkPayload.NextOffset != 12 {
    t.Fatalf("expected nextOffset 12 after first chunk, got %d", firstChunkPayload.NextOffset)
  }

  if firstChunkPayload.Complete {
    t.Fatalf("expected first chunk to remain incomplete")
  }

  secondChunkRequest := newChunkRequest(t, initPayload.UploadID, 12, "bytes 12-14/15", jpegChunkB, "toast.jpg")
  secondChunkRecorder := httptest.NewRecorder()
  handler.ServeHTTP(secondChunkRecorder, secondChunkRequest)

  if secondChunkRecorder.Code != http.StatusOK {
    t.Fatalf("expected 200 from second chunk, got %d", secondChunkRecorder.Code)
  }

  var secondChunkPayload struct {
    NextOffset int64  `json:"nextOffset"`
    Complete   bool   `json:"complete"`
    FileID     string `json:"fileId"`
  }
  if err := json.Unmarshal(secondChunkRecorder.Body.Bytes(), &secondChunkPayload); err != nil {
    t.Fatalf("decode second chunk payload: %v", err)
  }

  if secondChunkPayload.NextOffset != 15 {
    t.Fatalf("expected nextOffset 15 after completion, got %d", secondChunkPayload.NextOffset)
  }

  if !secondChunkPayload.Complete {
    t.Fatalf("expected second chunk to complete upload")
  }

  if secondChunkPayload.FileID != "drive-file-123" {
    t.Fatalf("expected provider file id, got %q", secondChunkPayload.FileID)
  }
}

func TestUploadChunkReturnsConflictWithNextOffset(t *testing.T) {
  t.Parallel()

  pg := testutil.StartPostgres(t)
  db := testutil.OpenDatabase(t, pg.DatabaseURL)
  env := testEnv(pg.DatabaseURL)
  seedUploadReadyStorageConfig(t, db)
  jpegChunk := []byte{0xff, 0xd8, 0xff, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02}
  provider := &fakeUploadProvider{
    sessionRef: "drive-session-1",
    chunkResults: []uploadservice.ChunkResult{{NextOffset: 12, Complete: false}},
  }

  handler := NewWithUploadService(env, db, uploadservice.New(env, db, provider))

  initBody := strings.NewReader(`{"filename":"toast.jpg","mimeType":"image/jpeg","fileSize":15}`)
  initRequest := httptest.NewRequest(http.MethodPost, "/api/upload/init", initBody)
  initRequest.Header.Set("Content-Type", "application/json")
  initRequest.RemoteAddr = "127.0.0.1:12345"
  initRecorder := httptest.NewRecorder()
  handler.ServeHTTP(initRecorder, initRequest)

  var initPayload struct {
    UploadID string `json:"uploadId"`
  }
  if err := json.Unmarshal(initRecorder.Body.Bytes(), &initPayload); err != nil {
    t.Fatalf("decode init payload: %v", err)
  }

  firstChunkRequest := newChunkRequest(t, initPayload.UploadID, 0, "bytes 0-11/15", jpegChunk, "toast.jpg")
  firstChunkRecorder := httptest.NewRecorder()
  handler.ServeHTTP(firstChunkRecorder, firstChunkRequest)

  conflictRequest := newChunkRequest(t, initPayload.UploadID, 0, "bytes 0-11/15", jpegChunk, "toast.jpg")
  conflictRecorder := httptest.NewRecorder()
  handler.ServeHTTP(conflictRecorder, conflictRequest)

  if conflictRecorder.Code != http.StatusConflict {
    t.Fatalf("expected 409 conflict, got %d", conflictRecorder.Code)
  }

  var conflictPayload struct {
    Error      string `json:"error"`
    NextOffset int64  `json:"nextOffset"`
  }
  if err := json.Unmarshal(conflictRecorder.Body.Bytes(), &conflictPayload); err != nil {
    t.Fatalf("decode conflict payload: %v", err)
  }

  if conflictPayload.NextOffset != 12 {
    t.Fatalf("expected nextOffset 12 in conflict response, got %d", conflictPayload.NextOffset)
  }
}

type fakeUploadProvider struct {
  sessionRef    string
  chunkResults  []uploadservice.ChunkResult
  uploadCount   int
  beginErr      error
  uploadChunkErr error
}

func (f *fakeUploadProvider) BeginUpload(_ context.Context, _ string, _ string, _ models.StorageProviderConfig) (string, error) {
  if f.beginErr != nil {
    return "", f.beginErr
  }
  return f.sessionRef, nil
}

func (f *fakeUploadProvider) UploadChunk(_ context.Context, _ string, _ string, _ string, _ []byte) (uploadservice.ChunkResult, error) {
  if f.uploadChunkErr != nil {
    return uploadservice.ChunkResult{}, f.uploadChunkErr
  }
  if f.uploadCount >= len(f.chunkResults) {
    return uploadservice.ChunkResult{}, nil
  }

  result := f.chunkResults[f.uploadCount]
  f.uploadCount += 1
  return result, nil
}

func newChunkRequest(t *testing.T, uploadID string, offset int64, contentRange string, chunk []byte, filename string) *http.Request {
  t.Helper()

  var body bytes.Buffer
  writer := multipart.NewWriter(&body)

  if err := writer.WriteField("uploadId", uploadID); err != nil {
    t.Fatalf("write uploadId field: %v", err)
  }
  if err := writer.WriteField("offset", strconv.FormatInt(offset, 10)); err != nil {
    t.Fatalf("write offset field: %v", err)
  }

  part, err := writer.CreateFormFile("chunk", filename)
  if err != nil {
    t.Fatalf("create chunk part: %v", err)
  }
  if _, err := part.Write(chunk); err != nil {
    t.Fatalf("write chunk bytes: %v", err)
  }

  if err := writer.Close(); err != nil {
    t.Fatalf("close multipart writer: %v", err)
  }

  request := httptest.NewRequest(http.MethodPut, "/api/upload/chunk", &body)
  request.Header.Set("Content-Type", writer.FormDataContentType())
  request.Header.Set("Content-Range", contentRange)
  return request
}

func seedUploadReadyStorageConfig(t *testing.T, db *postgres.DB) {
  t.Helper()

  err := db.UpdateDocument(t.Context(), "wedding.storage.google_drive", models.StorageProviderConfig{
    Provider:         "google_drive",
    DriveFolderID:    "drive-folder-123",
    DriveFolderLabel: "Wedding Uploads",
    PhotosEnabled:    false,
    PhotosAlbumID:    "",
    PhotosAlbumTitle: "",
  })
  if err != nil {
    t.Fatalf("seed upload-ready storage config: %v", err)
  }
}

func testEnv(databaseURL string) appconfig.Env {
  return appconfig.Env{
    AppEnv:              "test",
    Port:                "8787",
    PublicSiteOrigin:    "http://127.0.0.1:4321",
    AdminSiteOrigin:     "http://127.0.0.1:4323",
    WebAuthnRPID:        "localhost",
    SessionSecret:       "test-secret",
    DatabaseURL:         databaseURL,
    AdminAllowedEmails:  []string{"arjun.amrith@gmail.com", "amrithnathvijayakumar@gmail.com"},
  }
}
