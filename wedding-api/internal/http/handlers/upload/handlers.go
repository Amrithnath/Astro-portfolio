package upload

import (
  "encoding/json"
  "io"
  "net"
  "net/http"
  "strconv"

  uploadservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/upload"
)

type Handlers struct {
  service *uploadservice.Service
}

type initUploadRequest struct {
  Filename string `json:"filename"`
  MimeType string `json:"mimeType"`
  FileSize int64  `json:"fileSize"`
}

func New(service *uploadservice.Service) *Handlers {
  return &Handlers{service: service}
}

func (h *Handlers) InitUpload(w http.ResponseWriter, r *http.Request) {
  var request initUploadRequest
  if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
    writeError(w, http.StatusBadRequest, "Upload init payload must be valid JSON.")
    return
  }

  payload, err := h.service.InitUpload(r.Context(), extractIP(r), request.Filename, request.MimeType, request.FileSize)
  if err != nil {
    writeUploadError(w, err)
    return
  }

  writeJSON(w, http.StatusCreated, payload)
}

func (h *Handlers) UploadChunk(w http.ResponseWriter, r *http.Request) {
  r.Body = http.MaxBytesReader(w, r.Body, uploadservice.MaxChunkBytes+(1<<20))
  if err := r.ParseMultipartForm(uploadservice.MaxChunkBytes + (1 << 20)); err != nil {
    writeUploadError(w, &uploadservice.StatusError{Status: http.StatusBadRequest, Message: err.Error()})
    return
  }

  uploadID := r.FormValue("uploadId")
  offset, err := strconv.ParseInt(r.FormValue("offset"), 10, 64)
  if err != nil {
    offset = -1
  }

  file, _, err := r.FormFile("chunk")
  if err != nil {
    writeUploadError(w, &uploadservice.StatusError{Status: http.StatusBadRequest, Message: "A chunk file is required."})
    return
  }
  defer file.Close()

  chunk, err := io.ReadAll(file)
  if err != nil {
    writeUploadError(w, &uploadservice.StatusError{Status: http.StatusBadRequest, Message: "The upload chunk could not be read."})
    return
  }

  payload, err := h.service.UploadChunk(r.Context(), uploadID, offset, r.Header.Get("Content-Range"), chunk)
  if err != nil {
    writeUploadError(w, err)
    return
  }

  writeJSON(w, http.StatusOK, payload)
}

func extractIP(r *http.Request) string {
  host, _, err := net.SplitHostPort(r.RemoteAddr)
  if err == nil {
    return host
  }
  return r.RemoteAddr
}

func writeUploadError(w http.ResponseWriter, err error) {
  if statusErr, ok := err.(*uploadservice.StatusError); ok {
    if statusErr.RetryAfterSeconds > 0 {
      w.Header().Set("Retry-After", strconv.Itoa(statusErr.RetryAfterSeconds))
    }

    payload := map[string]any{"error": statusErr.Message}
    if statusErr.HasNextOffset {
      payload["nextOffset"] = statusErr.NextOffset
    }
    writeJSON(w, statusErr.Status, payload)
    return
  }

  writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func writeError(w http.ResponseWriter, status int, message string) {
  writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(status)
  _ = json.NewEncoder(w).Encode(value)
}
