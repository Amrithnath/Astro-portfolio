package router

import (
  "encoding/json"
  "net/http"
  "net/http/httptest"
  "strconv"
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
