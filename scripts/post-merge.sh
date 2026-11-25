#!/bin/bash
set -e
npm install

# Apply SQL migrations in order (idempotent - safe to run multiple times)
for migration in migrations/*.sql; do
  echo "Applying migration: $migration"
  psql "$DATABASE_URL" -f "$migration" || true
done
