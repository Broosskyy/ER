# Admin Web Access

Sprint 12.6C delivers a browser-first admin area inside the shared Expo Router app.

## Architecture

```
/admin routes (app/admin/*)
  → AdminAuthProvider (session + role state)
  → Admin route guard (auth → role → route permission)
  → AdminShell (responsive navigation)
  → existing admin screens / repositories
```

Public tabs and native navigation are unchanged. Admin routes are not linked from the public app.

## Route structure

| Route | Screen | Permission |
|---|---|---|
| `/admin/login` | Login | public |
| `/admin` | Dashboard | `canViewDashboard` |
| `/admin/events` | Event list | `canViewEvents` |
| `/admin/events/[id]` | Event detail/editor | `canViewEvents` (Save/Delete: `canEditEvents`; Publish/Reject: `canModerateContributorEvents`) |
| `/admin/events/review` | Contributor submission queue | `canViewContributorReviewQueue` |
| `/admin/events/review/[id]` | Submission review detail | `canViewContributorReviewQueue` (Publish/Reject: `canModerateContributorEvents`) |
| `/admin/imports` | Import dashboard | `canViewImports` |
| `/admin/imports/sources` | Sources list | `canViewSources` |
| `/admin/imports/sources/[id]` | Source detail | `canViewSources` |
| `/admin/imports/jobs` | Import jobs | `canViewImportJobs` |
| `/admin/imports/jobs/[id]` | Job detail | `canViewImportJobs` |
| `/admin/imports/review` | Review queue | `canReviewImports` |
| `/admin/imports/review/[id]` | Review detail | `canReviewImports` |

`/admin/settings` is intentionally not enabled (no production-ready settings screen exists).

## Auth flow

1. `AdminAuthProvider` restores the Supabase session on startup.
2. `authService.onAuthStateChange` keeps session state in sync.
3. Unauthenticated access to protected routes redirects to `/admin/login`.
4. After login, role data is resolved from JWT `app_metadata.role`.
5. Users without a valid admin role see the forbidden state.
6. Logout clears session and role state.

### Return routes

After login, the app may return to an internal admin path via `?returnTo=`. Only paths under `/admin` are accepted. External URLs are rejected.

## Role source

Roles are read from Supabase Auth JWT `app_metadata.role`.

Valid values:

- `viewer`
- `editor`
- `reviewer`
- `source_manager`
- `admin`
- `owner`

Unknown or missing roles are denied (fail closed).

Local mock mode (`EXPO_PUBLIC_USE_SUPABASE=false`) uses `authService` with a local session and `role: owner` for the documented dev account.

## Permission helpers

Central helpers live in `src/features/admin/admin-permissions.ts`:

- `canAccessAdmin()`
- `canViewDashboard()`
- `canViewEvents()`
- `canEditEvents()`
- `canDeleteEvents()` (alias of `canEditEvents`)
- `canPublishEvents()`
- `canModerateContributorEvents()` (alias of `canPublishEvents`)
- `canViewContributorReviewQueue()`
- `canViewImports()`
- `canViewSources()`
- `canManageSources()`
- `canViewImportJobs()`
- `canReviewImports()`
- `canResolveImportRecords()`
- `canManageAdminSettings()`

Import-specific service permissions remain in `src/features/import/admin/admin-roles.ts`.

## Role matrix

| Role | Admin access | Dashboard | View events | Edit events | Publish events | View imports | Manage sources | View jobs | Review queue | Resolve review | Settings |
|---|---|---|---|---|---|---|---|---|---|---|---|
| viewer | yes | yes | yes | no | no | yes | no | yes | yes | no | no |
| editor | yes | yes | yes | yes | no | yes | no | yes | yes | no | no |
| reviewer | yes | yes | yes | no | no | yes | no | yes | yes | yes | no |
| source_manager | yes | yes | yes | no | no | yes | yes | yes | yes | no | no |
| admin | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| owner | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |

Contributor submission moderation (`/admin/events/review`) requires `canModerateContributorEvents` (`admin` / `owner`). The event editor enforces `canEditEvents` for Save/Delete and blocks CMS edits on contributor events in `review`.

## Guards

`src/features/admin/admin-guard.ts` evaluates:

1. auth initialization complete
2. session present
3. role loaded
4. general admin access
5. route-specific permission

States:

- loading (auth / role)
- redirect to login
- forbidden
- route forbidden
- ready

## Layout and navigation

`AdminShell` provides:

- desktop sidebar navigation
- tablet/mobile drawer navigation
- user email + role display
- logout action

Navigation entries are hidden when the current role lacks permission. Direct URLs remain protected by the guard.

## Responsive behavior

- Desktop (≥1024px): persistent sidebar, centered content up to 960px
- Tablet (768–1023px): drawer navigation, centered content up to 720px
- Mobile web: compact top bar + drawer

## Native behavior

On Android/iOS, admin routes show a web-only message. Admin is not part of bottom tabs.

## RLS responsibility

Frontend guards improve UX only. Supabase RLS remains authoritative.

Sprint 12.6C adds migration `20260725000000_admin_events_rls.sql` to restrict event/reference write access to `is_admin()`.

ER-006 Platform Hardening (`20260732000000_er006_platform_hardening.sql`) replaces broad `admin_manage_events` with role-scoped policies and a `BEFORE UPDATE` trigger so publish/reject and contributor-review transitions require `admin` or `owner` at the database layer (matching `canPublishEvents` / `canModerateContributorEvents`).

Import tables were already admin-gated in Sprint 12.

## Create an admin user (Supabase)

1. Create the user in Supabase Auth (Dashboard → Authentication → Users).
2. Confirm the email if required by your project settings.
3. Set `app_metadata.role` to one of the valid admin roles.

Example SQL (run in Supabase SQL editor after creating the auth user):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'your-admin@example.com';
```

4. Apply migrations, including `20260725000000_admin_events_rls.sql`.
5. Sign in at `/admin/login` in the browser.

Do not commit real credentials.

## Local development

```bash
cd app-v2
npm install
npm run web
```

Open `http://localhost:8081/admin/login`.

Mock mode credentials are documented in `docs/admin.md` for local development only.

Environment:

- `EXPO_PUBLIC_USE_SUPABASE=false` for local mock repositories
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Web build

```bash
npm run build:web
```

Exported admin routes are included in the static web export.

## Known limitations

- No `/admin/settings` screen
- Event CMS depth remains Sprint 13 scope
- Jobs/review list screens still call repositories directly; route guards and RLS enforce access
- Full CMS publish workflow polish is not part of 12.6C
