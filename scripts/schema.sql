-- psql "$POSTGRES_URL" -f scripts/schema.sql

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_url_idx ON reports (url);

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_url_idx ON feedback (url);
