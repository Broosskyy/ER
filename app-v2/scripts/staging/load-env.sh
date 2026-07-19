#!/usr/bin/env bash
# Source app-v2/.env for staging scripts (safe key=value parser).
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Run scripts/staging/setup-env.sh first." >&2
  exit 1
fi

while IFS= read -r line || [[ -n "${line}" ]]; do
  [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
  if [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    export "${key}=${value}"
  fi
done < "${ENV_FILE}"
