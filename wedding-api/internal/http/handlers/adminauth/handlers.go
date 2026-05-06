package adminauth

import (
  "encoding/json"
  "errors"
  "net/http"

  adminauthservice "github.com/Amrithnath/Astro-portfolio/wedding-api/internal/service/adminauth"
  "google.golang.org/protobuf/encoding/protojson"
  "google.golang.org/protobuf/proto"
)

type Handlers struct {
  auth *adminauthservice.Service
}

func New(auth *adminauthservice.Service) *Handlers {
  return &Handlers{auth: auth}
}

func (h *Handlers) GetSession(w http.ResponseWriter, r *http.Request) {
  payload, err := h.auth.GetSession(r.Context(), r)
  if err != nil {
    if errors.Is(err, adminauthservice.ErrUnauthorized) {
      writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "admin session not available"})
      return
    }

    writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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

  _ = json.NewEncoder(w).Encode(value)
}
