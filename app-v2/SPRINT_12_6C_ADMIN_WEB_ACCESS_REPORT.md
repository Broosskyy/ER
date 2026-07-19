# Sprint 12.6C — Admin Web Access Report

## Audit

### Existing admin screens
- Dashboard (`app/admin/index.tsx`)
- Login (`app/admin/login.tsx`)
- Events list/detail (`app/admin/events/*`)
- Imports dashboard (`app/admin/imports/index.tsx`)
- Sources list/detail (`app/admin/imports/sources/*`)
- Jobs list/detail (`app/admin/imports/jobs/*`)
- Review queue/detail (`app/admin/imports/review/*`)

No settings screen existed; none was added.

### Existing admin routes
All target routes were already present under `app/admin/` except `/admin/settings` (intentionally omitted).

### Auth architecture (before)
- `AdminAuthProvider` with session-only state
- `authService` with local mock + Supabase sign-in
- Layout guard: session only, no role guard
- Login pre-filled local credentials

### Role source
- JWT `app_metadata.role` via `authService.mapSession()`
- `resolveAdminRole()` previously defaulted unknown roles to `admin` (insecure)

### Permission logic (before)
- Import permissions in `admin-roles.ts`
- `useAdminRole()` hook without centralized loading/error state
- No route-level permission abstraction

### RLS status (before)
- Import tables: `is_admin()` gated
- Events/reference tables: any `authenticated` user could manage data

### Direct Supabase calls in admin UI
- None in `app/admin/*` screens (repository/service layer used)

### Security risks found
- Unknown roles defaulted to admin access
- Login screen pre-filled credentials
- Events/reference RLS too permissive for authenticated non-admin users
- No route-specific frontend guards
- Admin modal presentation on root stack (suboptimal for web deep links)

### Web problems found
- No dedicated admin shell/navigation
- No responsive admin layout
- No browser-focused guard states

### Native conflicts found
- Admin accessible in native modal without web-only messaging

---

## Implemented

- Extended `AdminAuthProvider` with session, role, loading, and error state
- `authService.onAuthStateChange()` and `refreshSession()`
- Central permission helpers (`admin-permissions.ts`)
- Fail-closed `resolveAdminRole()`
- General + route-specific admin guard (`admin-guard.ts`)
- Admin responsive shell with sidebar/drawer (`AdminShell.tsx`)
- Forbidden and web-only states
- Login hardening (no pre-filled credentials, show/hide password, return route support)
- Admin layout guard pipeline (auth → role → route permission)
- Dashboard quick links filtered by role
- Root stack admin presentation changed from modal to standard card
- RLS migration for admin-only event/reference management
- Tests: auth service, permissions, guards (26 new tests)
- Documentation: `docs/admin-web.md`, `docs/security.md`

---

## Route matrix

| Route | Screen | Activated | Permission | Tested | Limitation |
|---|---|---|---|---|---|
| `/admin/login` | yes | yes | public | unit (guard) | browser manual not run in CI |
| `/admin` | yes | yes | `canViewDashboard` | unit | stats require repository bootstrap |
| `/admin/events` | yes | yes | `canViewEvents` | unit | list still uses repository directly |
| `/admin/events/[id]` | yes | yes | `canViewEvents` | existing import/event tests | edit UI actions role-aware in screen, not fully re-tested |
| `/admin/imports` | yes | yes | `canViewImports` | unit | — |
| `/admin/imports/sources` | yes | yes | `canViewSources` | unit | — |
| `/admin/imports/sources/[id]` | yes | yes | `canViewSources` | existing import tests | — |
| `/admin/imports/jobs` | yes | yes | `canViewImportJobs` | unit | repository list bypasses service read guard |
| `/admin/imports/jobs/[id]` | yes | yes | `canViewImportJobs` | existing import tests | — |
| `/admin/imports/review` | yes | yes | `canReviewImports` | unit | repository list bypasses service read guard |
| `/admin/imports/review/[id]` | yes | yes | `canReviewImports` | existing import tests | — |
| `/admin/settings` | no | no | n/a | n/a | intentionally omitted |

---

## Rollenmatrix

| Role | Admin | Dashboard | View events | Edit events | Publish events | View imports | View sources | Manage sources | View jobs | Review view | Review resolve | Settings |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| viewer | yes | yes | yes | no | no | yes | yes | no | yes | yes | no | no |
| editor | yes | yes | yes | yes | no | yes | yes | no | yes | yes | no | no |
| reviewer | yes | yes | yes | no | no | yes | yes | no | yes | yes | yes | no |
| source_manager | yes | yes | yes | no | no | yes | yes | yes | yes | yes | no | no |
| admin | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| owner | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| unknown/null | no | no | no | no | no | no | no | no | no | no | no | no |

---

## Validation

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | PASS |
| ESLint (`npm run lint`) | PASS (0 errors, pre-existing warnings) |
| Tests (`npm test`) | PASS — 188 tests |
| Expo Doctor | 19/20 (pre-existing prebuild sync warning) |
| Web build (`npm run build:web`) | PASS — all admin routes exported |
| Android build (`assembleRelease`) | PASS |
| Secret scan (`service_role` / `SUPABASE_SERVICE_ROLE`) | PASS — docs/scripts only |
| Direct admin routes in browser | NOT RUN (no browser in CI) |
| Browser refresh on admin subroutes | NOT RUN (manual) |
| Remote RLS migration apply | NOT RUN — SQL provided locally |

---

## Manuelle Schritte (Supabase)

1. Apply migration `supabase/migrations/20260725000000_admin_events_rls.sql`
2. Create admin user in Supabase Auth
3. Assign role in `app_metadata`:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'your-admin@example.com';
```

4. Verify policies:

```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('events', 'sources', 'import_jobs', 'import_records');
```

5. Test `/admin/login` in browser with assigned user

---

## Offene Punkte

### Admin Web Access jetzt
- Manual browser verification of deep links/back/refresh
- Optional refactor: route jobs/review list reads through `ImportOperationsService`
- Event editor could use finer-grained `canEditEvents` / `canPublishEvents` UI gating

### Later sprints
- CMS depth (Sprint 13)
- CRM (later)
- Automation (Sprint 14)
- Public user accounts / social (Sprint 15)
- Push notifications / PWA completion (later)

---

## Changed files (high level)

- `src/features/admin/*` — auth, permissions, guard, shell, states, tests
- `app/admin/_layout.tsx`, `app/admin/login.tsx`, `app/admin/index.tsx`, `app/admin/+not-found.tsx`
- `src/features/import/admin/admin-roles.ts`, `use-admin-role.ts`
- `src/services/supabase/auth-service.ts`
- `app/_layout.tsx`
- `supabase/migrations/20260725000000_admin_events_rls.sql`
- `docs/admin-web.md`, `docs/security.md`
- `scripts/validate-migrations.ts`
