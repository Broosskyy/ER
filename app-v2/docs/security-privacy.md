# Security & Privacy Review — Eternal Rave

**Sprint:** 12.7C  
**Status:** Internal audit — July 2026  
**Last updated:** July 2026

---

## 1. Supabase security review

### 1.1 Authentication

| Check | Status | Notes |
|-------|--------|-------|
| Admin-only auth | ✓ | No consumer registration |
| Password auth | ✓ | `signInWithPassword` via Supabase |
| Session persistence | ✓ | `persistSession: true` |
| Auto token refresh | ✓ | `autoRefreshToken: true` |
| Logout | ✓ | `signOut()` clears session |
| Role from JWT | ✓ | `app_metadata.role` (not user_metadata) |
| Local dev bypass | ⚠ | Hardcoded creds when `USE_SUPABASE=false` — must not ship in production |
| Magic links | — | Not implemented |
| OAuth | — | Not implemented (future) |
| Password reset | — | Supabase default (not wired in UI) |
| Multi-device sessions | ✓ | Standard Supabase behavior |
| Invalid/expired session | ✓ | Guard redirects to login |

### 1.2 API keys

| Key | Client exposure | Status |
|-----|-----------------|--------|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes (intended) | RLS-scoped |
| `SUPABASE_SERVICE_ROLE_KEY` | **Must never** | Blocked by `validate-env.ts` |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Restrict by platform in Google Cloud console |

### 1.3 Database

| Check | Status |
|-------|--------|
| 14 tables in `public` schema | ✓ |
| Foreign keys defined | ✓ |
| RLS enabled on all tables | ✓ |
| Anon SELECT grants only | ✓ (`20260724000000`) |
| No consumer user tables | ✓ |

### 1.4 Storage

| Bucket | Public | RLS policies | Client usage |
|--------|--------|--------------|--------------|
| `events` | Yes | Read public; admin upload | Not called from client |
| `artists` | Yes | **None defined** | Not used |
| `venues` | Yes | **None defined** | Not used |
| `collections` | Yes | **None defined** | Not used |

**Risk:** Buckets `artists`, `venues`, `collections` lack explicit RLS policies. Mitigation: no client upload code; add policies before enabling uploads.

### 1.5 Edge functions

**None deployed.** No `supabase/functions/` directory.

---

## 2. RLS audit

All tables: **RLS ENABLED = Yes**

### 2.1 Content tables

| Table | Policy | SELECT | INSERT | UPDATE | DELETE | Risk |
|-------|--------|--------|--------|--------|--------|------|
| `events` | `anon_read_published_events` | published only | — | — | — | Low |
| | `admin_read_events` | admin | — | — | — | Low |
| | `admin_manage_events` | admin | admin | admin | admin | Low |
| `genres` | `anon_read_active_genres` | active | — | — | — | Low |
| | `admin_manage_genres` | admin | admin | admin | admin | Low |
| `cities` | `anon_read_active_cities` | active | — | — | — | Low |
| | `admin_manage_cities` | admin | admin | admin | admin | Low |
| `venues` | `anon_read_venues` | **all rows** | — | — | — | Low-Med |
| | `admin_manage_venues` | admin | admin | admin | admin | Low |
| `artists` | `anon_read_artists` | **all rows** | — | — | — | Low-Med |
| | `admin_manage_artists` | admin | admin | admin | admin | Low |
| `collections` | `anon_read_active_collections` | active | — | — | — | Low |
| | `admin_manage_collections` | admin | admin | admin | admin | Low |

### 2.2 Admin/import tables

| Table | Policy | SELECT | INSERT | UPDATE | DELETE | Risk |
|-------|--------|--------|--------|--------|--------|------|
| `sources` | `admin_read_sources` | admin | — | — | — | Low |
| | `admin_manage_sources` | admin | admin | admin | admin | Low |
| `import_jobs` | `admin_manage_import_jobs` | admin | admin | admin | admin | Low |
| `import_records` | `admin_manage_import_records` | admin | admin | admin | admin | Low |
| `import_logs` | `admin_manage_import_logs` | admin | admin | — | — | Low |
| `import_audit_logs` | `admin_read_import_audit_logs` | admin | — | — | — | Low |
| | `admin_write_import_audit_logs` | — | admin | — | — | Low |

### 2.3 Storage RLS

| Bucket | Policy | SELECT | INSERT | UPDATE | DELETE | Risk |
|--------|--------|--------|--------|--------|--------|------|
| `events` | `public_read_event_images` | public | — | — | — | Low |
| | `admin_upload_event_images` | — | admin | — | — | Low |
| `artists` | — | — | — | — | — | **Med** (no policies) |
| `venues` | — | — | — | — | — | **Med** |
| `collections` | — | — | — | — | — | **Med** |

### 2.4 RLS helper functions

| Function | Purpose |
|----------|---------|
| `is_admin()` | Checks JWT `app_metadata.role` in admin role set |
| `admin_role()` | Returns role string |
| `has_admin_role(text[])` | Defined but unused in policies |

**Validation scripts:** `scripts/staging/validate-rls-local.sh`, `validate-rls-remote.ts`

---

## 3. Frontend privacy review

| Check | Status | Notes |
|-------|--------|-------|
| No PII in localStorage beyond app function | ✓ | Event IDs, notification content |
| No tokens in logs | ✓ | No console.log of auth tokens |
| Error messages sanitized | ✓ | `getErrorMessage()` strips cause |
| No internal IDs exposed unnecessarily | ✓ | Event IDs are public content identifiers |
| AsyncStorage for favorites/notifications | ✓ | Documented in iOS privacy manifest |
| SecureStore for tokens | ✗ | Not used — Supabase SDK default storage |
| No analytics/tracking | ✓ | Confirmed absent |
| Profile discloses local storage | ✓ | User informed on profile screen |
| Search not persisted | ✓ | React state only |

---

## 4. Admin privacy review

| Check | Status | Notes |
|-------|--------|-------|
| Web-only enforcement | ✓ | Native shows block screen |
| Route guards | ✓ | Auth + role + permission |
| Open redirect protection | ✓ | `/admin/*` only |
| Fail-closed role resolution | ✓ | Unknown role → forbidden |
| Session timeout | ✗ | Not implemented |
| Admin email in UI | ✓ | Intentional for signed-in admin |
| Direct URL access blocked | ✓ | Guard pipeline |
| RLS backs all admin queries | ✓ | Client checks are additive |
| Audit logging | ✓ | `import_audit_logs` with actor_id |
| Error pages safe | ✓ | No stack traces |

---

## 5. Security checks

| Area | Status | Notes |
|------|--------|-------|
| HTTPS (production) | Prepared | Required at deploy; not enforced in dev |
| TLS for Supabase | ✓ | HTTPS only |
| Env var validation | ✓ | `validate-env.ts`, `release:check` |
| Service role in client | ✓ Blocked | Build scan + env validation |
| Import SSRF protection | ✓ | Private IP blocking, header stripping |
| Import log redaction | ✓ | Regex-based secret patterns |
| PWA SW bypasses admin | ✓ | Network-only for `/admin/*` |
| PWA SW bypasses Supabase | ✓ | Not intercepted |
| File upload | — | Not implemented in client |
| Debug menus | ✓ | None in production |
| Console errors (prod) | ✓ | Minimal; no PII |

---

## 6. Risk analysis

| Risk | Likelihood | Impact | Priority | Mitigation | Status |
|------|------------|--------|----------|------------|--------|
| Data loss (local) | Medium | Low | Low | User informed; future cloud sync | Accepted |
| Data leak via RLS misconfiguration | Low | High | High | RLS audit, validation scripts | Mitigated |
| Open API without RLS | Low | Critical | Critical | All tables have RLS | Mitigated |
| Public storage bucket abuse | Low | Medium | Medium | Add policies before uploads | Open |
| Accidental PII in import logs | Medium | Medium | Medium | Redaction + retention purge | Partial |
| Session hijacking (admin) | Low | High | High | HTTPS, future idle timeout | Partial |
| Token leak in client bundle | Low | High | High | No service role; anon key only | Mitigated |
| Missing encryption at rest (local) | Low | Low | Low | OS-level device encryption | Accepted |
| Dev credentials in production build | Low | Critical | Critical | `USE_SUPABASE=true` in prod; build validation | Mitigated |
| Missing privacy policy at launch | High | High | High | Publish before store release | Open |
| `raw_payload` third-party PII | Medium | Medium | Medium | Retention purge; review workflow | Partial |
| Supabase error message leak | Medium | Low | Low | Sanitize admin error display | Open |
| No admin idle timeout | Medium | Medium | Medium | Implement 30 min timeout | Open |

---

## 7. Privacy test plan

### 7.1 Functional tests (automated where possible)

| Test | Method | Result |
|------|--------|--------|
| Favorites persist locally | Unit test `favorites-storage.test.ts` | PASS |
| Notifications persist locally | Unit test `notification-storage.test.ts` | PASS |
| Admin guard blocks unauthenticated | Unit test `admin-guard.test.ts` | PASS |
| Admin role resolution fail-closed | Unit test `admin-permissions.test.ts` | PASS |
| Env blocks service role key | Unit test `validate-env` | PASS |
| Safe external URL validation | Unit test `external-url.test.ts` | PASS |
| Login/logout (mock) | Manual / integration | PASS (mock mode) |
| Session restore | Manual | PASS (Supabase SDK) |
| App restart preserves favorites | Manual | Not run in CI |
| Offline mode | Manual | Not run in CI |

### 7.2 Security tests

| Test | Method | Result |
|------|--------|--------|
| Anon cannot read import_jobs | RLS validation script | PASS |
| Anon cannot read draft events | RLS + datasource filter | PASS |
| Direct API without auth (import) | RLS validation | PASS |
| Invalid session → login redirect | Guard unit tests | PASS |
| Admin route on native → blocked | Manual | PASS |
| Token manipulation | Manual | Not run in CI |
| Build output no service role | `validate-build-output.ts` | PASS |

### 7.3 Privacy tests

| Test | Method | Result |
|------|--------|--------|
| No unnecessary data stored | Code audit | PASS |
| No PII in logs | Code audit | PASS (with import caveats) |
| Error output safe | Code audit | PASS (admin Supabase msgs caveat) |
| Data deletion (local) | App data clear | Manual — not in CI |
| Export completeness | N/A | No accounts |

---

## 8. Performance review (privacy angle)

| Check | Status |
|-------|--------|
| No extra DB queries for privacy | ✓ |
| No unnecessary PII in API responses | ✓ |
| No duplicate requests carrying personal data | ✓ |
| No sensitive data in SW cache | ✓ |
| Event fetch uses published filter | ✓ |

---

## 9. Technical debt (privacy-related)

| Item | Severity | Sprint |
|------|----------|--------|
| No admin idle session timeout | Medium | Future |
| SecureStore not used for auth tokens | Medium | Future |
| Storage buckets without RLS (artists/venues/collections) | Medium | Before uploads |
| `raw_payload` PII not scrubbed at ingest | Medium | Future |
| Privacy policy URL not wired in UI | High | 12.7D |
| No automated retention purge jobs | Medium | Future |
| Supabase error messages in admin UI | Low | Future |
| Mock admin creds in bundle (dev flag) | High if misconfigured | Enforce prod env |
| No consent notice for local storage | Low | 12.7D |
| `has_admin_role()` unused — dead code | Low | Cleanup |

**Not auto-fixed in this sprint** — documented for follow-up.

---

## 10. Privacy checklist

| Item | Status |
|------|--------|
| □ Datenschutzerklärung vorhanden | Structure ✓ — legal text pending |
| □ Nutzungsbedingungen vorhanden | Structure ✓ — legal text pending |
| □ Impressum vorbereitet | Structure ✓ — entity data pending |
| □ Support Kontakt vorhanden | Documented (`support@<domain>.tld`) |
| □ Privacy Kontakt vorhanden | Documented (`privacy@<domain>.tld`) |
| □ Datenexport vorbereitet | Concept ✓ — no implementation |
| □ Accountlöschung dokumentiert | Concept ✓ — no accounts yet |
| □ DSGVO Analyse abgeschlossen | ✓ |
| □ Dateninventar vollständig | ✓ |
| □ RLS vollständig geprüft | ✓ |
| □ API Keys geprüft | ✓ |
| □ HTTPS vorbereitet | ✓ (deploy-time) |
| □ Session Handling geprüft | ✓ (timeout gap noted) |
| □ Local Storage geprüft | ✓ |
| □ Secure Storage geprüft | ✓ (not used) |
| □ Logs geprüft | ✓ |
| □ Fehlerseiten geprüft | ✓ |
| □ Third-Party Inventar erstellt | ✓ |
| □ Privacy URLs vorbereitet | Env placeholders ✓ |
| □ Apple Privacy vorbereitet | Manifest ✓, labels documented |
| □ Google Data Safety vorbereitet | Documented |

---

## Related documents

- [Privacy architecture](privacy.md)
- [Data retention](data-retention.md)
- [Security (app)](security.md)
- [Legal documents](legal.md)
