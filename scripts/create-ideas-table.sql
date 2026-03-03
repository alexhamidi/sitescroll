-- Ideas table for user ideas (post-it wall). Table is also created automatically
-- on first GET/POST to /api/ideas when DB is configured.
-- Optional: run manually with POSTGRES_URL from app/.env:
--   psql "$POSTGRES_URL" -f scripts/create-ideas-table.sql

CREATE TABLE IF NOT EXISTS ideas (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  text TEXT NOT NULL,
  color TEXT,
  rotation DOUBLE PRECISION DEFAULT 0,
  x DOUBLE PRECISION DEFAULT 0,
  y DOUBLE PRECISION DEFAULT 0,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ideas_session_id_idx ON ideas (session_id);
