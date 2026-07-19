#!/usr/bin/env bash
# Remote Supabase staging validation (requires env vars).
# Usage: source .env.staging && ./scripts/staging/validate-remote.sh
set -euo pipefail

: "${EXPO_PUBLIC_SUPABASE_URL:?Set EXPO_PUBLIC_SUPABASE_URL}"
: "${EXPO_PUBLIC_SUPABASE_ANON_KEY:?Set EXPO_PUBLIC_SUPABASE_ANON_KEY}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/../.."

echo "==> Remote staging validation"
echo "    URL: ${EXPO_PUBLIC_SUPABASE_URL}"

# Anonymous access test
echo "  -> Testing anonymous import_jobs access (expect 401/empty)..."
RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  "${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/import_jobs?select=id&limit=1" \
  -H "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${EXPO_PUBLIC_SUPABASE_ANON_KEY}")

if [[ "${RESULT}" == "200" ]]; then
  ROWS=$(curl -s \
    "${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/import_jobs?select=id&limit=1" \
    -H "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${EXPO_PUBLIC_SUPABASE_ANON_KEY}")
  if [[ "${ROWS}" == "[]" ]]; then
    echo "  ✅ anon: empty result (RLS blocking)"
  else
    echo "  ❌ anon: got data: ${ROWS}"
    exit 1
  fi
else
  echo "  ✅ anon: HTTP ${RESULT} (access denied)"
fi

# Published events readable
echo "  -> Testing anonymous published events (expect data or empty)..."
EVENTS=$(curl -s \
  "${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/events?select=id&status=eq.published&limit=1" \
  -H "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${EXPO_PUBLIC_SUPABASE_ANON_KEY}")
echo "  ℹ️  published events response: ${EVENTS:0:100}"

# Secret scan on env
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "  ⚠️  SUPABASE_SERVICE_ROLE_KEY is set (server-side only, not for client bundles)"
fi

echo "==> Remote validation complete (basic REST checks)"
echo "    For full RLS matrix, run with admin JWT tokens via validate-rls-remote.ts"
