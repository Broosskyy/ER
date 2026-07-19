# Security

## Client credentials

### Anon key

`EXPO_PUBLIC_SUPABASE_ANON_KEY` is intended for client use. It is scoped by Row Level Security (RLS) and must not be treated as a secret with full database access.

### Service role

`SUPABASE_SERVICE_ROLE_KEY` must never be shipped in the Expo app, web bundle, repository code, fixtures, or documentation.

Service role bypasses RLS and belongs only in secure server-side environments.

## RLS

All protected data access is enforced in Supabase policies.

Examples:

- Public users: read published events only
- Admin users: `is_admin()` based on JWT `app_metadata.role`
- Import tables: admin-only policies from Sprint 12

Frontend permission checks do not replace RLS.

## Frontend guards

Admin route guards prevent:

- protected content flash before auth/role resolution
- navigation to unauthorized admin areas
- open redirects after login

Guards are implemented in:

- `src/features/admin/admin-guard.ts`
- `src/features/admin/admin-permissions.ts`
- `app/admin/_layout.tsx`

## Role source

Admin roles are loaded from JWT `app_metadata.role`.

This field must be set by trusted server-side processes or Supabase dashboard/admin APIs. End users must not be able to self-assign privileged roles.

`user_metadata` is not used for authorization because it is user-editable.

## Secret handling

- No service role key in client code
- No database passwords in the repository
- No hard-coded production admin passwords in screens
- Local mock credentials exist only in `auth-service.ts` for `EXPO_PUBLIC_USE_SUPABASE=false`
- Import/source URLs with credentials must be masked in UI when displayed

## Admin access

Admin sign-in uses Supabase Auth email/password (or local mock auth in development).

There is no public registration flow.

Create admin users manually in Supabase Auth and assign `app_metadata.role`.

## Safe redirects

Login supports internal `returnTo` paths under `/admin` only.

External URLs, protocol-relative URLs, and `/admin/login` are rejected.

## Logging

- Do not log access tokens, refresh tokens, or service role keys
- Do not log full import payloads by default in admin screens
- User-facing errors use `getErrorMessage()` sanitization

## Error handling

Auth and role loading failures default to deny access.

Unknown roles are treated as unauthorized.

Session refresh is handled by Supabase client auto-refresh in Supabase mode.

## Known risks

| Risk | Mitigation |
|---|---|
| Missing `app_metadata.role` on auth user | Fail-closed role resolution; forbidden state |
| Overly broad authenticated policies on legacy tables | Additive RLS migration in 12.6C for events/reference tables |
| Direct repository calls in some admin list screens | Route guards + RLS; service-layer permission checks remain on write paths |
| Admin opened in native app | Web-only block screen |

## Verification checklist

Run during releases:

```bash
rg -i "service_role|SUPABASE_SERVICE_ROLE" app-v2
rg -i "password\s*=\s*['\"]" app-v2/app app-v2/src
npm run typecheck
npm test
npm run build:web
npm run validate:build-output
```

## PWA caching

Sprint 12.6D adds a conservative production service worker (`public/sw.js`).

Rules:

- hashed static bundles may be cached
- HTML navigation uses network-first with offline fallback
- `/admin/*` requests are network-only
- Supabase/auth traffic is not cached

Auth security must not rely on the service worker. Route guards and RLS remain authoritative.

## Service worker risks

| Risk | Mitigation |
|---|---|
| stale app shell | versioned caches + update banner |
| cached admin pages | admin paths bypass SW cache |
| cached auth responses | Supabase requests not intercepted |
| logout + browser back | admin guards + session cleared on logout |

## Web bundle

- Only `EXPO_PUBLIC_*` variables belong in the client bundle
- Run `npm run validate:build-output` after web export
- Do not ship `.env` files in `dist/`

## Security headers

See `docs/web-deployment.md` for recommended host-level headers (CSP, HSTS, referrer policy).

## Deployment risks

- serving `index.html` with long immutable cache breaks updates
- missing HTTPS blocks PWA install and weakens auth
- exposing service role or DB passwords in hosting env UI logs

## Cache invalidation

After deploy:

- bump service worker cache version when needed (`PWA_CONFIG.cacheVersion` / `public/sw.js`)
- prefer short cache TTL for `sw.js` and HTML entry files
- users may need one reload to pick up waiting SW updates

---

## Secrets management (Sprint 12.7F)

### Inventory

| Secret | Storage location | In client bundle? | Rotation |
|--------|------------------|-------------------|----------|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | EAS secrets, `.env` | **Yes** (intended) | On compromise |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/EAS only | **Never** | Quarterly |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | EAS secrets | Yes | On compromise |
| `EXPO_PUBLIC_GA4_MEASUREMENT_ID` | EAS secrets | Yes | Rare |
| Apple distribution cert | EAS credentials | No | Annual |
| Google Play signing key | Play App Signing | No | Google-managed |
| Admin passwords | Supabase Auth | No | Per policy |
| Staging JWTs | CI secrets only | No | Per rotation |
| `IMPORT_API_HEADER_*` | Server env only | No | Per provider |

### Rules

- **Never** commit secrets to git (`.env` in `.gitignore`)
- **Never** log secrets (import pipeline redacts patterns)
- Run `npm run validate:build-output` after every web release
- Run `npm run validate:env -- --production` before production deploy
- Store production secrets in EAS Secrets + team password manager
- Rotate service role key if any suspicion of exposure

### Rotation procedure

1. Generate new key in Supabase/provider dashboard
2. Update EAS secrets and hosting env
3. Deploy new build
4. Revoke old key after verification
5. Document rotation in operations log

---

## Roles & permissions

| Role | Access | Assignment |
|------|--------|------------|
| Anonymous user | Read published events (RLS) | Default |
| Authenticated (non-admin) | Same as anon currently | N/A |
| Admin: viewer | Read import data | `app_metadata.role` |
| Admin: editor | Edit events | JWT role |
| Admin: reviewer | Approve imports | JWT role |
| Admin: source_manager | Manage sources | JWT role |
| Admin: admin | Full admin except owner actions | JWT role |
| Admin: owner | Full access | JWT role |
| Service role | Bypass RLS | Server only — never client |

See `src/features/import/admin/admin-roles.ts` and RLS policies in `supabase/migrations/`.

**Least privilege:** Assign minimum role required. Review quarterly.

---

## Incident response

### Severity levels

| Level | Definition | Examples | Response |
|-------|------------|----------|----------|
| **SEV-1** | Production down or data breach | RLS bypass, DB exposed, site down | Immediate, all hands |
| **SEV-2** | Major feature broken | Events not loading, admin inaccessible | < 1 hour |
| **SEV-3** | Degraded service | Slow API, partial import failure | < 4 hours |
| **SEV-4** | Minor issue | UI glitch, non-critical bug | Next sprint |

### Response procedure

1. **Detect** — monitoring alert, user report, or internal discovery
2. **Triage** — assign severity, incident commander
3. **Contain** — disable affected feature, revoke compromised keys, halt rollout
4. **Communicate** — notify stakeholders per severity
5. **Resolve** — fix, deploy, verify
6. **Recover** — rollback if fix not fast enough
7. **Review** — post-incident report within 48h (SEV-1/2)

### Data breach (GDPR Art. 33/34)

If personal data breach confirmed:

1. Contain and assess scope within 24 hours
2. Notify supervisory authority within **72 hours** if risk to individuals
3. Notify affected users if high risk
4. Document: nature, categories, approximate count, consequences, measures taken
5. Contact: privacy@<domain>.tld

### Communication templates

- **Internal:** Slack/email to engineering + product
- **Users:** support@ response, status page (future)
- **Authority:** Formal notification per legal counsel guidance

Full operations context: [operations.md](operations.md)

---

## Disaster recovery

| Scenario | Impact | Recovery | RTO estimate |
|----------|--------|----------|--------------|
| Supabase region outage | No event data | Wait for provider / restore to new region | 1–24 hours |
| Supabase project deleted | Total data loss | Restore from backup/PITR | 1–4 hours |
| DNS failure | Site unreachable | Fix DNS at registrar/CDN | 5 min–48 hours |
| Hosting outage | Web/admin down | Redeploy to alternate host | 1–2 hours |
| EAS build failure | Cannot ship update | Fix config, rebuild | 1–4 hours |
| GitHub unavailable | Cannot deploy from CI | Use local clone + cached artifacts | Low impact |
| Domain expired | Total web loss | Renew domain urgently | Hours–days |

### DR priorities

1. Restore event data (Supabase)
2. Restore web app (static deploy)
3. Restore mobile apps (previous store version)
4. Restore admin access

### Business continuity (minimal operation)

During outage, users can:

- Use **cached PWA shell** (offline page — no event data)
- Use **installed mobile app** with last-loaded data (no refresh)
- **Not available:** new events, admin imports, favorites sync

Emergency contact: support@<domain>.tld

---

## OWASP risk summary

| OWASP category | Risk level | Mitigation |
|----------------|------------|------------|
| A01 Broken Access Control | Low-Med | RLS + admin guards |
| A02 Cryptographic Failures | Low | TLS everywhere, no secrets in client |
| A03 Injection | Low | Parameterized Supabase queries |
| A04 Insecure Design | Low | Privacy by design, no accounts |
| A05 Security Misconfiguration | Med | Env validation, staging noindex |
| A06 Vulnerable Components | Med | `npm audit`, Expo SDK updates |
| A07 Auth Failures | Low-Med | Fail-closed admin auth |
| A08 Data Integrity | Low | RLS, signed JWTs |
| A09 Logging Failures | Med | No centralized logging yet |
| A10 SSRF | Low | Import fetch blocks private IPs |

Full audit: [security-privacy.md](security-privacy.md)

---

## Governance references

- [Compliance overview](compliance.md)
- [Operations runbook](operations.md)
- [Go-live gate](go-live.md)
- [Privacy architecture](privacy.md)
