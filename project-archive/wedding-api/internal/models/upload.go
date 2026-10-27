package models

import "time"

type UploadSession struct {
  ID                    string
  Provider              string
  ProviderSessionRef    string
  StoragePolicySnapshot []byte
  OriginalName          string
  StoredName            string
  MimeType              string
  TotalBytes            int64
  NextOffset            int64
  Complete              bool
  ExpiresAt             time.Time
  CreatedAt             time.Time
  UpdatedAt             time.Time
  IPHash                string
}
