package models

import "time"

type Asset struct {
  ID        string `json:"id"`
  Kind      string `json:"kind"`
  Title     string `json:"title"`
  PublicURL string `json:"publicUrl"`
}

type AssetRecord struct {
  ID              string
  Kind            string
  Title           string
  StorageProvider string
  StorageKey      string
  PublicURL       string
  CreatedAt       time.Time
  CreatedBy       *string
}
