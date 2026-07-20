# Auth: Username & Display Name (Vorbereitung)

**Stand:** Juli 2026 · **Scope:** Dokumentation only (ER-005.1) — keine Migration, keine UI.

## Ist-Zustand

- **Identity:** Supabase Auth (`auth.users`) — E-Mail + Passwort
- **Session:** `AuthSession` mit `user.id`, `user.email`, optional `role` aus JWT `app_metadata.role`
- **Keine `profiles`-Tabelle** in den aktuellen Migrationen (`app-v2/supabase/migrations/`)
- **Kein `username` / `display_name`** in App-Typen oder Consumer-UI
- Profil-Tab zeigt aktuell `user.email` als Identifikator

## Empfohlenes Zielmodell (später)

### Tabelle `public.profiles`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `id` | `uuid` PK, FK → `auth.users.id` | 1:1 mit Auth-User |
| `username` | `text` UNIQUE, nullable | Öffentlicher Handle (`@username`), lowercase, validiert |
| `display_name` | `text` nullable | Anzeigename in UI (frei formatierbar) |
| `avatar_url` | `text` nullable | Optional später |
| `created_at` / `updated_at` | `timestamptz` | Standard |

### Erstellung

- **Trigger** `on_auth_user_created` → leere Profilzeile anlegen, oder
- **Lazy create** beim ersten Profilbesuch via Service

### RLS

- `SELECT`: eigene Zeile + optional öffentlich lesbare `username`/`display_name` für published Content
- `UPDATE`: nur `auth.uid() = id`

### App-Integration

1. Migration + RLS (eigener Ticket, z. B. ER-007+)
2. `ProfileRepository` / `ProfileDatasource` analog zu Events
3. `AuthContext` optional um `profile` erweitern (oder separater `useProfile()` Hook)
4. Profil-UI: Anzeigename statt E-Mail, Username für öffentliche Attribution bei Events (`created_by` → Join auf `profiles`)
5. Validierung: Username-Regex, Eindeutigkeit, reservierte Namen

### Event-Ownership

- `events.created_by` bleibt `uuid` (Auth-User-ID)
- Öffentliche Darstellung: Join `profiles.display_name` oder `username`, nicht E-Mail

## Bewusst nicht in ER-005.1

- Keine Migration
- Keine neuen Felder
- Keine UI
- Keine Änderung an `created_by`

## Nächster sinnvoller Schritt

Nach ER-006 (Admin Moderation): dediziertes Ticket „Consumer Profile & Username“ mit Migration, RLS, Profil-Edit-Screen und Anzeige in „Meine Events“.
