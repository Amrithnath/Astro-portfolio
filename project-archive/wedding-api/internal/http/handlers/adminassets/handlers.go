package adminassets

import (
  "encoding/json"
  "errors"
  "io"
  "net/http"
  "strings"

  adminassetsv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/admin/assets/v1"
  adminauthservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminauth"
  adminassetsservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminassets"
  "github.com/go-chi/chi/v5"
  "google.golang.org/protobuf/encoding/protojson"
  "google.golang.org/protobuf/proto"
)

type Handlers struct {
  auth    *adminauthservice.Service
  service *adminassetsservice.Service
}

func New(auth *adminauthservice.Service, service *adminassetsservice.Service) *Handlers {
  return &Handlers{auth: auth, service: service}
}

func (h *Handlers) ListAssets(w http.ResponseWriter, r *http.Request) {
  payload, err := h.service.ListAssets(r.Context())
  if err != nil {
    writeAssetError(w, err)
    return
  }

  writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) CreateAssetUpload(w http.ResponseWriter, r *http.Request) {
  var request adminassetsv1.CreateAssetUploadRequest
  if err := decodeProtoJSON(r, &request); err != nil {
    writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
    return
  }

  session, err := h.auth.GetSession(r.Context(), r)
  if err != nil {
    if errors.Is(err, adminauthservice.ErrUnauthorized) {
      writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "admin session not available"})
      return
    }
    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
    return
  }

  payload, err := h.service.CreateAssetUpload(r.Context(), session.GetSession().GetAdmin().GetId(), &request, requestBaseURL(r))
  if err != nil {
    writeAssetError(w, err)
    return
  }

  writeJSON(w, http.StatusCreated, payload)
}

func (h *Handlers) UploadAssetContent(w http.ResponseWriter, r *http.Request) {
  assetID := chi.URLParam(r, "assetID")
  if strings.TrimSpace(assetID) == "" {
    writeJSON(w, http.StatusBadRequest, map[string]string{"error": "assetID is required"})
    return
  }

  r.Body = http.MaxBytesReader(w, r.Body, adminassetsservice.MaxAssetBytes())
  defer r.Body.Close()

  if err := h.service.UploadAssetContent(r.Context(), assetID, r.Header.Get("Content-Type"), r.Body); err != nil {
    if errors.Is(err, io.EOF) {
      writeJSON(w, http.StatusBadRequest, map[string]string{"error": "asset body is required"})
      return
    }
    writeAssetError(w, err)
    return
  }

  w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) DeleteAsset(w http.ResponseWriter, r *http.Request) {
  assetID := chi.URLParam(r, "assetID")
  payload, err := h.service.DeleteAsset(r.Context(), assetID)
  if err != nil {
    writeAssetError(w, err)
    return
  }

  writeJSON(w, http.StatusOK, payload)
}

func decodeProtoJSON(r *http.Request, message proto.Message) error {
  defer r.Body.Close()
  body, err := io.ReadAll(r.Body)
  if err != nil {
    return err
  }

  return protojson.UnmarshalOptions{DiscardUnknown: true}.Unmarshal(body, message)
}

func writeAssetError(w http.ResponseWriter, err error) {
  var statusErr *adminassetsservice.StatusError
  if errors.As(err, &statusErr) {
    writeJSON(w, statusErr.Status, map[string]string{"error": statusErr.Message})
    return
  }

  writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(status)

  if message, ok := value.(proto.Message); ok {
    body, err := protojson.MarshalOptions{UseProtoNames: false}.Marshal(message)
    if err == nil {
      _, _ = w.Write(body)
      return
    }
  }

  _ = json.NewEncoder(w).Encode(value)
}

func requestBaseURL(r *http.Request) string {
  scheme := "http"
  if forwardedProto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); forwardedProto != "" {
    scheme = forwardedProto
  } else if r.TLS != nil {
    scheme = "https"
  }

  return scheme + "://" + r.Host
}
