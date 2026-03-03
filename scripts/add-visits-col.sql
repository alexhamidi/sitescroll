-- Run once in Neon SQL Editor to add visits tracking to the sites table.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS visits bigint NOT NULL DEFAULT 0;
