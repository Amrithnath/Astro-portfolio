package models

import "time"

type Admin struct {
  ID          string
  AccessEmail string
  DisplayName string
  CreatedAt   time.Time
  LastLoginAt *time.Time
}

type AdminSession struct {
  ID             string
  AdminID        string
  AccessEmail    string
  ExpiresAt      time.Time
  RequiresStepUp bool
}
