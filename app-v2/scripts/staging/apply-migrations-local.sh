#!/usr/bin/env bash
# Apply all migrations to a local PostgreSQL database for staging validation.
# Usage: ./scripts/staging/apply-migrations-local.sh [database_name]
set -euo pipefail

DB_NAME="${1:-eternal_rave_staging}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../../supabase/migrations" && pwd)"
BOOTSTRAP="$(cd "$(dirname "$0")" && pwd)/bootstrap-supabase-local.sql"

echo "==> Creating database: ${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};" postgres 2>/dev/null || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};" postgres

echo "==> Bootstrapping auth/storage stubs"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${BOOTSTRAP}"

echo "==> Applying migrations in order"
for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort); do
  echo "    -> $(basename "${file}")"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${file}"
done

echo "==> Applying staging seed"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "$(dirname "$0")/seed-staging.sql"

echo "==> Migration apply complete: ${DB_NAME}"
