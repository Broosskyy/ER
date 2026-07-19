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
