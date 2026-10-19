-- Migration 002: Add receipt image support
-- Created: 2026-10-20

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_image TEXT DEFAULT NULL;

-- Create a migrations tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
