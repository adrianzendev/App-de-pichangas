-- Migration: Rename specialties → careers and tutor_specialties → tutor_careers
-- This migration preserves all existing data.
-- Run once: it is idempotent (checks for existing table names before acting).

DO $$
BEGIN
  -- Rename specialties → careers (if it hasn't been renamed yet)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'specialties'
  ) THEN
    ALTER TABLE specialties RENAME TO careers;
  END IF;

  -- Rename tutor_specialties → tutor_careers (if it hasn't been renamed yet)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tutor_specialties'
  ) THEN
    ALTER TABLE tutor_specialties RENAME TO tutor_careers;
  END IF;
END;
$$;
