package router

import (
  "encoding/json"
  "net/http"
  "net/http/httptest"
  "strconv"
  "strings"
  "testing"
  "time"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
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
