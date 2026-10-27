package upload

import (
  "bytes"
  "context"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "os"
  "strings"
  "net/url"

  appconfig "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/config"
  "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/models"
  "golang.org/x/oauth2"
  "golang.org/x/oauth2/google"
)

const driveScope = "https://www.googleapis.com/auth/drive"

type GoogleDriveProvider struct {
  env        appconfig.Env
  httpClient *http.Client
  apiBaseURL string
  tokenSource oauth2.TokenSource
}

func NewGoogleDriveProvider(env appconfig.Env) *GoogleDriveProvider {
  return &GoogleDriveProvider{
    env:        env,
    httpClient: &http.Client{},
    apiBaseURL: "https://www.googleapis.com",
  }
}

func (p *GoogleDriveProvider) ValidateStorage(ctx context.Context, storage models.StorageProviderConfig) (string, string, error) {
  if strings.TrimSpace(p.env.GoogleDriveServicePath) == "" {
    return "", "", &StatusError{Status: 503, Message: "Google Drive validation is unavailable because the service account path is not configured."}
  }

  if strings.TrimSpace(storage.DriveFolderID) == "" {
    return "", "", &StatusError{Status: 400, Message: "Drive folder ID is required."}
  }

  token, err := p.accessToken(ctx)
  if err != nil {
    return "", "", err
  }

  requestURL := fmt.Sprintf("%s/drive/v3/files/%s?fields=id,name,mimeType&supportsAllDrives=true", strings.TrimRight(p.apiBaseURL, "/"), url.PathEscape(storage.DriveFolderID))
  request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
  if err != nil {
    return "", "", fmt.Errorf("create drive validation request: %w", err)
  }

  request.Header.Set("Authorization", "Bearer "+token)

  response, err := p.httpClient.Do(request)
  if err != nil {
    return "", "", &StatusError{Status: 503, Message: "Could not reach Google Drive while validating the folder access."}
  }
  defer response.Body.Close()

  switch response.StatusCode {
  case http.StatusOK:
    payload := struct {
      Name     string `json:"name"`
      MimeType string `json:"mimeType"`
    }{}

    if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
      return "", "", &StatusError{Status: 502, Message: "Google Drive returned an unreadable folder response."}
    }

    if payload.MimeType != "application/vnd.google-apps.folder" {
      return "", "", &StatusError{Status: 400, Message: "The provided Google Drive ID does not point to a folder."}
    }

    label := strings.TrimSpace(payload.Name)
    if label == "" {
      return "Drive folder access verified.", "", nil
    }

    return fmt.Sprintf("Drive folder access verified for %q.", label), label, nil
  case http.StatusForbidden:
    return "", "", &StatusError{Status: 403, Message: "Google Drive folder access failed. Share the folder with the service account email and verify the folder ID."}
  case http.StatusNotFound:
    return "", "", &StatusError{Status: 404, Message: "Google Drive folder was not found. Verify the folder ID and shared drive visibility."}
  case http.StatusUnauthorized:
    return "", "", &StatusError{Status: 503, Message: "Google Drive authentication failed while validating the folder."}
  }

  if response.StatusCode >= http.StatusInternalServerError {
    return "", "", &StatusError{Status: 503, Message: "Google Drive is temporarily unavailable while validating the folder."}
  }

  payload, _ := io.ReadAll(response.Body)
  return "", "", &StatusError{Status: 502, Message: fmt.Sprintf("Google Drive folder validation failed: %s", strings.TrimSpace(string(payload)))}
}

func (p *GoogleDriveProvider) BeginUpload(ctx context.Context, storedName string, mimeType string, storage models.StorageProviderConfig) (string, error) {
  if strings.TrimSpace(p.env.GoogleDriveServicePath) == "" {
    return "", &StatusError{Status: 503, Message: "Upload server is not configured yet. Add the Google Drive service account path first."}
  }

  if strings.TrimSpace(storage.DriveFolderID) == "" {
    return "", &StatusError{Status: 503, Message: "Upload storage is not configured yet. Add a Google Drive folder before collecting files."}
  }

  token, err := p.accessToken(ctx)
  if err != nil {
    return "", err
  }

  body, err := json.Marshal(map[string]any{
    "name":     storedName,
    "mimeType": mimeType,
    "parents":  []string{storage.DriveFolderID},
  })
  if err != nil {
    return "", fmt.Errorf("encode drive upload init payload: %w", err)
  }

  request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", bytes.NewReader(body))
  if err != nil {
    return "", fmt.Errorf("create drive upload init request: %w", err)
  }

  request.Header.Set("Authorization", "Bearer "+token)
  request.Header.Set("Content-Type", "application/json; charset=UTF-8")
  request.Header.Set("X-Upload-Content-Type", mimeType)

  response, err := p.httpClient.Do(request)
  if err != nil {
    return "", &StatusError{Status: 503, Message: "Could not reach Google Drive while creating the upload session."}
  }
  defer response.Body.Close()

  if response.StatusCode < 200 || response.StatusCode >= 300 {
    payload, _ := io.ReadAll(response.Body)
    return "", &StatusError{Status: 502, Message: fmt.Sprintf("Google Drive rejected the upload session: %s", strings.TrimSpace(string(payload)))}
  }

  sessionURI := response.Header.Get("Location")
  if strings.TrimSpace(sessionURI) == "" {
    return "", &StatusError{Status: 502, Message: "Google Drive did not return a resumable session location."}
  }

  return sessionURI, nil
}

func (p *GoogleDriveProvider) UploadChunk(ctx context.Context, sessionRef string, mimeType string, contentRange string, chunk []byte) (ChunkResult, error) {
  token, err := p.accessToken(ctx)
  if err != nil {
    return ChunkResult{}, err
  }

  request, err := http.NewRequestWithContext(ctx, http.MethodPut, sessionRef, bytes.NewReader(chunk))
  if err != nil {
    return ChunkResult{}, fmt.Errorf("create drive chunk request: %w", err)
  }

  request.Header.Set("Authorization", "Bearer "+token)
  request.Header.Set("Content-Type", mimeType)
  request.Header.Set("Content-Range", contentRange)
  request.ContentLength = int64(len(chunk))

  response, err := p.httpClient.Do(request)
  if err != nil {
    return ChunkResult{}, &StatusError{Status: 503, Message: "Google Drive is temporarily unavailable. Retry the current chunk shortly.", RetryAfterSeconds: 2}
  }
  defer response.Body.Close()

  switch response.StatusCode {
  case 308:
    uploadedEnd := parseUploadedRange(response.Header.Get("Range"))
    if uploadedEnd == nil {
      parsedRange, err := parseContentRange(contentRange)
      if err != nil {
        return ChunkResult{}, err
      }
      nextOffset := parsedRange.End + 1
      return ChunkResult{NextOffset: nextOffset, Complete: false}, nil
    }
    return ChunkResult{NextOffset: *uploadedEnd + 1, Complete: false}, nil
  case 200, 201:
    payload := struct {
      ID string `json:"id"`
    }{}
    _ = json.NewDecoder(response.Body).Decode(&payload)
    return ChunkResult{Complete: true, ProviderResourceID: payload.ID}, nil
  case 404, 410:
    return ChunkResult{}, &StatusError{Status: 410, Message: "Google Drive upload session expired. Restart this file upload."}
  }

  if response.StatusCode >= 500 {
    return ChunkResult{}, &StatusError{Status: 503, Message: "Google Drive is temporarily unavailable. Retry the current chunk shortly.", RetryAfterSeconds: 2}
  }

  payload, _ := io.ReadAll(response.Body)
  return ChunkResult{}, &StatusError{Status: 502, Message: fmt.Sprintf("Google Drive rejected the upload chunk: %s", strings.TrimSpace(string(payload)))}
}

func (p *GoogleDriveProvider) accessToken(ctx context.Context) (string, error) {
  tokenSource, err := p.getTokenSource(ctx)
  if err != nil {
    return "", err
  }

  token, err := tokenSource.Token()
  if err != nil {
    return "", &StatusError{Status: 503, Message: "Could not obtain a Google Drive access token."}
  }

  if strings.TrimSpace(token.AccessToken) == "" {
    return "", &StatusError{Status: 503, Message: "Could not obtain a Google Drive access token."}
  }

  return token.AccessToken, nil
}

func (p *GoogleDriveProvider) getTokenSource(ctx context.Context) (oauth2.TokenSource, error) {
  if p.tokenSource != nil {
    return p.tokenSource, nil
  }

  credentialsJSON, err := os.ReadFile(p.env.GoogleDriveServicePath)
  if err != nil {
    return nil, &StatusError{Status: 503, Message: "Google Drive credentials could not be loaded from disk."}
  }

  credentials, err := google.CredentialsFromJSON(ctx, credentialsJSON, driveScope)
  if err != nil {
    return nil, &StatusError{Status: 503, Message: "Google Drive credentials are invalid or missing the required scope."}
  }

  p.tokenSource = credentials.TokenSource
  return p.tokenSource, nil
}

func parseUploadedRange(value string) *int64 {
  value = strings.TrimSpace(value)
  if value == "" {
    return nil
  }

  var end int64
  if _, err := fmt.Sscanf(value, "bytes=0-%d", &end); err != nil {
    return nil
  }

  return &end
}
