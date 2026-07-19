# Admin Area

> See also: [admin-web.md](./admin-web.md) (Sprint 12.6C browser admin access) and [security.md](./security.md).

Route prefix: `/admin` (not linked from public app navigation)

## Access

Navigate manually to `/admin` or `/admin/login`.

### Local development credentials
- Email: `admin@eternalrave.app`
- Password: `admin-local-dev`

### Supabase mode
Use credentials created in Supabase Auth dashboard.

## Screens

| Route | Purpose |
|---|---|
| `/admin/login` | Email/password login, session, logout |
| `/admin` | Dashboard with entity counts |
| `/admin/events` | Event list with search, status filter, pagination |
| `/admin/events/new` | Create event |
| `/admin/events/[id]` | Edit event |

## Event Editor Fields

- Title, description
- Genre, venue, artist, city (from repository options — no hardcodes)
- Start date, ticket URL, image URL
- Source, collection
- Status: draft, review, published, archived, deleted

## Actions

- Save
- Save as Draft
- Publish
- Archive
- Delete (soft delete → status `deleted`)

## States

All admin data fetches use:
- `AdminLoadingState`
- `AdminErrorState` with retry
- `AdminEmptyState`

## Auth Flow

```
AdminAuthProvider
  → authService.signIn()
  → session stored (local mock or Supabase)
  → layout redirects unauthenticated users to /admin/login
```

## Not in Sprint 11

- Genre/city/venue management screens (data via repositories, UI in Sprint 12)
- Image upload to Storage (URL field only)
- Role-based UI (RLS prepared, fine-grained roles later)
