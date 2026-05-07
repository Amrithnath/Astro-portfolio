package adminconfig

import (
  "encoding/json"
  "io"
  "net/http"

  adminconfigv1 "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/gen/admin/config/v1"
  adminconfigservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminconfig"
  "google.golang.org/protobuf/encoding/protojson"
  "google.golang.org/protobuf/proto"
)

type Handlers struct {
  service *adminconfigservice.Service
}

func New(service *adminconfigservice.Service) *Handlers {
  return &Handlers{service: service}
}

func (h *Handlers) GetWeddingPublicConfig(w http.ResponseWriter, r *http.Request) {
  payload, err := h.service.GetWeddingPublicConfig(r.Context())
  if err != nil {
    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
    return
  }
  writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) UpdateWeddingPublicConfig(w http.ResponseWriter, r *http.Request) {
  var request adminconfigv1.UpdateWeddingPublicConfigRequest
  if err := decodeProtoJSON(r, &request); err != nil {
    writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
    return
  }

  payload, err := h.service.UpdateWeddingPublicConfig(r.Context(), request.GetConfig())
  if err != nil {
    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
    return
  }
  writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) GetWeddingThemeConfig(w http.ResponseWriter, r *http.Request) {
  payload, err := h.service.GetWeddingThemeConfig(r.Context())
  if err != nil {
    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
    return
  }
  writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) GetUploadPolicyConfig(w http.ResponseWriter, r *http.Request) {
  payload, err := h.service.GetUploadPolicyConfig(r.Context())
  if err != nil {
    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
    return
  }
  writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) GetStorageProviderConfig(w http.ResponseWriter, r *http.Request) {
  payload, err := h.service.GetStorageProviderConfig(r.Context())
  if err != nil {
    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
    return
  }
  writeJSON(w, http.StatusOK, payload)
}

func (h *Handlers) ValidateStorageProvider(w http.ResponseWriter, r *http.Request) {
  var request adminconfigv1.ValidateStorageProviderRequest
  if err := decodeProtoJSON(r, &request); err != nil {
    writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
    return
  }

  payload, err := h.service.ValidateStorageProvider(r.Context(), request.GetConfig())
  if err != nil {
    writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
