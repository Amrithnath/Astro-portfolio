package public

import (
  "encoding/json"
  "net/http"

  configservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/config"
  "google.golang.org/protobuf/proto"
  "google.golang.org/protobuf/encoding/protojson"
)

type Handlers struct {
  config *configservice.Service
}

func New(config *configservice.Service) *Handlers {
  return &Handlers{config: config}
}

func (h *Handlers) GetWeddingConfig(w http.ResponseWriter, r *http.Request) {
  payload, err := h.config.GetPublicWeddingConfig(r.Context())
  if err != nil {
    writeError(w, http.StatusInternalServerError, err.Error())
    return
  }

  writeJSON(w, http.StatusOK, payload)
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

  if err := json.NewEncoder(w).Encode(value); err == nil {
    return
  }

  _, _ = w.Write([]byte(`{"error":"unexpected payload type"}`))
}

func writeError(w http.ResponseWriter, status int, message string) {
  writeJSON(w, status, map[string]string{"error": message})
}
