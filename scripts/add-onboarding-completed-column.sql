-- Add onboarding completion flag to users table.
-- Existing users are marked as completed so only new users see first-login onboarding.
-- Run once: psql "YOUR_DATABASE_URL" -f scripts/add-onboarding-completed-column.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean;

UPDATE users
  SET onboarding_completed = true
  WHERE onboarding_completed IS NULL;

ALTER TABLE users
  ALTER COLUMN onboarding_completed SET DEFAULT false,
  ALTER COLUMN onboarding_completed SET NOT NULL;
