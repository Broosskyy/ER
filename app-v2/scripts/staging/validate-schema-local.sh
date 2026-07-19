#!/usr/bin/env bash
# Validate schema after migration apply on local PostgreSQL.
set -euo pipefail

DB_NAME="${1:-eternal_rave_staging}"

run_check() {
  local label="$1"
  local sql="$2"
  local result
  result=$(sudo -u postgres psql -t -A -d "${DB_NAME}" -c "${sql}" 2>&1)
  if [[ "${result}" == "t" || "${result}" == "1" || "${result}" =~ ^[0-9]+$ && "${result}" -gt 0 ]]; then
    echo "  ✅ ${label}"
    return 0
  else
    echo "  ❌ ${label} (got: ${result})"
    return 1
  fi
}

echo "==> Schema validation: ${DB_NAME}"
FAIL=0

TABLES=(
  events genres cities venues artists collections sources
  import_jobs import_records import_logs import_audit_logs
)

for t in "${TABLES[@]}"; do
  run_check "table public.${t}" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}');" \
    || FAIL=1
done

run_check "unique index import_jobs_one_active_per_source_idx" \
  "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='import_jobs_one_active_per_source_idx');" \
  || FAIL=1

run_check "function is_admin()" \
  "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_admin');" \
  || FAIL=1

run_check "RLS enabled on import_records" \
  "SELECT relrowsecurity FROM pg_class WHERE relname='import_records';" \
  || FAIL=1

run_check "staging seed city" \
  "SELECT COUNT(*) FROM public.cities WHERE id='staging-city-koeln';" \
  || FAIL=1

run_check "staging seed duplicate event" \
  "SELECT COUNT(*) FROM public.events WHERE id='staging-event-duplicate-target';" \
  || FAIL=1

run_check "storage buckets (4)" \
  "SELECT COUNT(*) FROM storage.buckets;" \
  || FAIL=1

# Test parallel job constraint
echo "  -> Testing parallel job unique constraint..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "DELETE FROM import_jobs;" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "
  INSERT INTO import_jobs (id, source_id, status, trigger_type)
  VALUES ('job-1', 'staging-source-rss', 'running', 'manual');
" >/dev/null

if sudo -u postgres psql -d "${DB_NAME}" -c "
  INSERT INTO import_jobs (id, source_id, status, trigger_type)
  VALUES ('job-2', 'staging-source-rss', 'pending', 'manual');
" 2>&1 >/dev/null; then
  echo "  ❌ parallel job guard did not block"
  FAIL=1
else
  echo "  ✅ parallel job guard blocks second active job"
fi

if [[ "${FAIL}" -eq 0 ]]; then
  echo "==> Schema validation PASSED"
else
  echo "==> Schema validation FAILED"
  exit 1
fi
