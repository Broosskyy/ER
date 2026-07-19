#!/usr/bin/env bash
# RLS validation using non-superuser role (rls_tester) with session-persistent JWT claims.
set -euo pipefail

DB_NAME="${1:-eternal_rave_staging}"

run_rls_test() {
  local label="$1"
  local role="$2"
  local claims="$3"
  local sql="$4"
  local expect="$5"  # "allow" or "deny"

  local result
  result=$(sudo -u postgres psql -t -A -d "${DB_NAME}" <<EOF
SET ROLE rls_tester;
SELECT set_config('request.jwt.claims', '${claims}', false);
SELECT set_config('request.jwt.claim.role', '${role}', false);
${sql}
EOF
)

  local count
  count=$(echo "${result}" | tail -1 | tr -d ' ')

  if [[ "${expect}" == "deny" ]]; then
    if echo "${result}" | grep -qiE "permission denied|violates row-level security"; then
      echo "  ✅ ${label} — denied"
      return 0
    elif [[ "${count}" == "0" || -z "${count}" ]]; then
      echo "  ✅ ${label} — 0 rows"
      return 0
    else
      echo "  ❌ ${label} — got ${count} rows (expected deny)"
      return 1
    fi
  else
    if [[ "${count}" =~ ^[0-9]+$ ]]; then
      echo "  ✅ ${label} — ${count} rows"
      return 0
    else
      echo "  ❌ ${label} — failed: ${result}"
      return 1
    fi
  fi
}

echo "==> RLS validation (rls_tester + mocked JWT): ${DB_NAME}"
FAIL=0

run_rls_test "anon: import_jobs" "anon" '{}' "SELECT COUNT(*) FROM import_jobs;" deny || FAIL=1
run_rls_test "anon: import_records" "anon" '{}' "SELECT COUNT(*) FROM import_records;" deny || FAIL=1
run_rls_test "anon: sources" "anon" '{}' "SELECT COUNT(*) FROM sources;" deny || FAIL=1
run_rls_test "anon: published events" "anon" '{}' "SELECT COUNT(*) FROM events WHERE status='published';" allow || FAIL=1
run_rls_test "anon: draft events" "anon" '{}' "SELECT COUNT(*) FROM events WHERE status='draft';" deny || FAIL=1
run_rls_test "viewer: import_jobs" "authenticated" '{"app_metadata":{"role":"viewer"}}' "SELECT COUNT(*) FROM import_jobs;" allow || FAIL=1
run_rls_test "normal user: import_jobs" "authenticated" '{"app_metadata":{"role":"user"}}' "SELECT COUNT(*) FROM import_jobs;" deny || FAIL=1
run_rls_test "owner: import_audit_logs" "authenticated" '{"app_metadata":{"role":"owner"}}' "SELECT COUNT(*) FROM import_audit_logs;" allow || FAIL=1

if [[ "${FAIL}" -eq 0 ]]; then
  echo "==> RLS validation PASSED"
else
  echo "==> RLS validation FAILED"
  exit 1
fi
