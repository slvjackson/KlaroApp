-- Add business_profile column to users table
-- Run once: psql "YOUR_DATABASE_URL" -f scripts/add-segment-column.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS business_profile jsonb;
