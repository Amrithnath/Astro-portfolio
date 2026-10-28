-- One anonymous counter per article path. No visitor data is stored.
CREATE TABLE IF NOT EXISTS views (
  path TEXT PRIMARY KEY NOT NULL CHECK (length(path) <= 160),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);
