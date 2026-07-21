# Projektübersicht

**Stand:** 21. Juli 2026  
**Quelle:** Analyse des Repository-Inhalts (`C:/ER`)

## Projektname

**Eternal Rave** — „Discover. Connect. Rave.“  
Aktive App: `app-v2/` (`package.json`: `eternal-rave`, Version `0.2.0`, Bundle-ID `com.eternalrave.app`)

## Aktuelle Architektur

Monorepo mit einer aktiven Expo-App und Referenzmaterial:

```
UI (Expo Router Screens)
  → Repository (EventRepository, ImportRepositories, …)
  → Datasource (LocalDatasource | SupabaseDatasource)
  → Daten (Pipeline/Mock | Supabase PostgreSQL + Storage)
```

- **Framework:** React Native + Expo SDK 57, TypeScript (strict), Expo Router
- **Web:** React Native Web, statischer Export (`web.output: static`)
- **Backend:** Supabase (PostgreSQL, Auth, Storage) — Konfiguration in `app-v2/supabase/`
- **Feature-Flag:** `EXPO_PUBLIC_USE_SUPABASE` (Standard: `false` → lokale Mock-Daten); siehe `app-v2/src/core/config/feature-flags.ts`
- **Trennung:** `app-v2/` importiert nicht aus `reference/` (siehe `app-v2/docs/ARCHITECTURE.md`)

## Hauptmodule

Feature-Module unter `app-v2/src/features/`:

| Modul | Zweck |
|-------|-------|
| `home` | Home-Screen, Event-Karten, Collections-Ausschnitte, Standort-Header |
| `location` | Nutzerstandort (Foreground, lokal persistiert, kein Supabase) |
| `search` | Suche, Filter, Explore-Feed |
| `events` | Event-Pipeline, Repository, Lineup (`event_artists`, ER-008), Display-Modelle |
| `event-detail` | Event-Detail-Screen |
| `collections` | Kuratierte Event-Sammlungen |
| `saved` | Gespeicherte Events (Favoriten) |
| `favorites` | Lokaler Favoriten-State (AsyncStorage) |
| `map` | Karten-Feature (`MapUnavailableState` auf Tab-Route) |
| `notifications` | Lokales Notification Center (kein Push) |
| `activity` | Activity-Panel und Deep-Link-Screen |
| `create` | Create Hub, Event-Einreichung (Draft → Review), „Meine Events“ |
| `my-events` | Eigene Events listen, filtern, zurückziehen |
| `auth` | Globaler Auth-Context und Routen-Hilfen |
| `i18n` | Internationalisierung (de/en) |
| `admin` | Admin-Web-Shell, Guards, Berechtigungen, Artist-CMS |
| `import` | Import-Engine (Adapter, Matching, Review, Operations) |
| `artists` | Artist-Domain, Validation, Service, Admin-CMS (ER-007) |

Querschnitt: `app-v2/src/data/` (Repositories, Datasources, Mapper), `app-v2/src/services/supabase/` (Client, Auth)

---

# Repository-Struktur

## Ordnerübersicht

| Pfad | Inhalt |
|------|--------|
| `app-v2/` | Aktive Expo-App (Code, Tests, Supabase, Scripts, Docs) |
| `reference/` | Export aus früherem Projekt (Mockups, Blueprint, Old Code) — nur Referenz |
| `docs/` | Repo-weite Dokumentation (Rebuild-Audit, diese Datei) |
| `README.md` | Einstieg, Quick Start, Linkliste |
| `migration_export.zip` | Original-Archiv (Duplikat in `reference/migration/`) |

## Apps

| Pfad | Beschreibung |
|------|--------------|
| `app-v2/app/` | Expo-Router-Screens (öffentliche Tabs + Admin-Routen) |
| `app-v2/android/` | Generiertes Android-Native-Projekt |
| `app-v2/ios/` | Generiertes iOS-Native-Projekt |
| `app-v2/public/` | Web/PWA-Assets (Manifest, Icons) |

## Backend

| Pfad | Beschreibung |
|------|--------------|
| `app-v2/supabase/migrations/` | 16 SQL-Migrationen (Schema, RLS, Grants, Contributor, ER-006 Hardening, ER-007 Artists, ER-008 `event_artists`) |
| `app-v2/scripts/staging/` | Staging-Validierung, Seed-SQL, Remote-Seed-Skript |
| `app-v2/src/data/datasources/supabase/` | Supabase-Datasource-Implementierungen |
| `app-v2/src/services/supabase/` | Supabase-Client und Auth-Service |

**Nicht vorhanden:** `app-v2/supabase/functions/` (keine Edge Functions im Repository)

## Dokumentation

| Pfad | Beschreibung |
|------|--------------|
| `docs/ARCHITECTURE_ROADMAP.md` | Langfristige Projektvision, Phasen 1–3, Zielarchitektur (Community, Medien, Moderation) |
| `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` | ER-005.4: Ist vs. Ziel, Gaps, Migrationsstrategie, Domain-Foundation |
| `app-v2/docs/` | 55+ Dateien (Architektur, Backend, Import, Admin, Release, Legal, …) |
| `docs/rebuild-audit/` | Repository-Audit-Berichte |
| `docs/rebuild/` | Mockup-Extraktionsbericht |
| `app-v2/SPRINT_*_REPORT.md` | Sprint-Abschlussberichte (Root von `app-v2/`) |
| `app-v2/PROJECT_STATUS_REPORT_AFTER_LAST_11_SPRINTS.md` | Projektstatus nach Sprint 12.5–12.7F |

---

# Apps

## Android

- **Status:** Unterstützt (`README.md`: „supported“)
- **Build:** `npm run android` / `expo run:android`, natives `android/`-Verzeichnis vorhanden
- **Package:** `com.eternalrave.app` (`app.config.ts`)

## Web

- **Status:** Unterstützt, statischer Export
- **Dev:** `npm run web`
- **Build:** `npm run build:web`, Validierung via `npm run validate:build-output`
- **PWA:** Installierbare Foundation (Sprint 12.6D), siehe `app-v2/docs/pwa.md`

## Admin

- **Status:** Implementiert, **nur Web** (`Platform.OS !== 'web'` → `AdminWebOnlyState`)
- **Ort:** Routen unter `app-v2/app/admin/*` in derselben Expo-App (keine separate Admin-App)
- **Screens:** Login, Dashboard, Events CRUD (inkl. Multi-Artist-Lineup-Editor, ER-008), Artists CRUD (`/admin/artists`), Contributor Submissions (`/admin/events/review`), Import (Sources, Jobs, Review)
- **Dokumentation:** `app-v2/docs/admin-web.md`

## iOS

- **Status:** Expo-kompatibel; EAS/TestFlight vorbereitet (Sprint 12.7A)
- **Native Projekt:** `app-v2/ios/` vorhanden
- **Dokumentation:** `app-v2/docs/ios-build.md`

## Öffentliche App-Funktionen (Ist)

| Bereich | Status |
|---------|--------|
| Home | Implementiert mit Collections und Event-Karten; anklickbarer Standort im Header (ER-005.2) |
| Search | Implementiert mit Filtern und Event-Liste |
| Saved | Implementiert (lokale Favoriten) |
| Profile | Implementiert (Login/Register/Logout, Sprachumschalter, lokale Infos) |
| Map-Tab | Zeigt `MapUnavailableState` (`app/(tabs)/map.tsx`) |
| Event-Detail | Route `/event/[id]` |
| Notifications | Route `/notifications`, device-lokal |
| Create Hub | Route `/create` mit Auth-Gate; vollständiger Event-Submission-Flow |
| Consumer-Login | `/login` und `/register` (globaler `AuthProvider`) |
| Internationalisierung | Deutsch und Englisch (`src/features/i18n/`) |

---

# Backend

## Supabase

- **Konfiguration:** `app-v2/supabase/migrations/` (14 Dateien)
- **Client:** `app-v2/src/services/supabase/client.ts`
- **Env-Variablen:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_USE_SUPABASE` (`.env.example`)
- **Staging-Tools:** `scripts/staging/` inkl. `seed-staging-app-data.sql`, `apply-staging-seed-remote.ts` (`npm run seed:staging:remote`)
- **Lokale Validierung:** `npm run validate:staging:local`, Remote: `npm run validate:staging:remote`

## Auth

- **Provider:** Globaler `AuthProvider` in `app/_layout.tsx` (`src/features/auth/AuthContext.tsx`)
- **Service:** `app-v2/src/services/supabase/auth-service.ts`
  - Supabase-Modus: `signInWithPassword`, Session aus JWT
  - Lokaler Modus (`EXPO_PUBLIC_USE_SUPABASE=false`):
    - Admin: `admin@eternalrave.app` / `admin-local-dev` → Rolle `owner`
    - Consumer: `user@eternalrave.app` / `user-local-dev` → ohne Admin-Rolle
- **Login-Route:** `/login` (gemeinsam für Consumer und Admin)
- **Registrierung:** `/register` — erzeugt normale Benutzer ohne Admin-Rolle; bei E-Mail-Bestätigung → `RegistrationSuccessView`
- **Auth-Fehler:** `translateAuthError()` — u. a. `email_not_confirmed`, `invalid_credentials`, Netzwerk, Rate-Limit (via `error.code`, Fallback `error.message`)
- **E-Mail-Bestätigung:** Vollständiger Callback-Flow (ER-005.3) — `/auth/callback`, Resend, Passwort-Reset; siehe `app-v2/docs/auth-email-confirmation.md`
- **Username/Anzeigename:** Vorbereitung in `app-v2/docs/auth-username-plan.md` (keine Migration in ER-005.1)
- **Create Hub:** `/create` — zentraler Community-Einstieg
- **Event-Einreichung:** `/create/event` → Entwurf speichern → `/event/:id/edit` → `/event/:id/preview` → Einreichen (`review`) → Status in **Meine Events** (`/profile/events`)
- **Meine Events:** `/profile/events` — eigene Events (`draft`, `review`, `published`, `rejected`, `archived`); Filter; Aktionen je Status; `review` → `draft` zurückziehen
- **Profil-UI:** Anmelden, Konto erstellen und Abmelden über den Profil-Tab (`/profile`)
- **Aktivitäten:** Header-Activity-Button nur für eingeloggte Nutzer; öffnet bevorzugt `ActivityPanel`; `/notifications` und `/activity` bleiben als Deep Links
- **Admin:** `useAdminAuth()` leitet Rolle aus globaler Session ab; Guards unverändert
- **Rollenquelle:** JWT `app_metadata.role` (keine `profiles`- oder `user_roles`-Tabelle in Migrationen)

## Internationalisierung (i18n)

- **Bibliotheken:** `i18next`, `react-i18next`, `expo-localization`
- **Ort:** `app-v2/src/features/i18n/`
- **Unterstützte Sprachen:** `de`, `en` — **Fallback:** `de`
- **Sprachpräferenz:** AsyncStorage-Key `app.locale` (`locale-storage.ts`)
- **Priorität:** gespeicherte Präferenz → normalisierte Gerätesprache → Fallback
- **Provider:** `I18nProvider` im Root-Layout (`app/_layout.tsx`), umschließt `AuthProvider`
- **Hook:** `useAppTranslation()` — neue UI-Texte müssen Translation-Keys verwenden
- **Key-Konvention:** `feature.bereich.element` (z. B. `auth.login.title`, `create.options.event.title`)
- **Datum/Zahl:** `useIntlLocale()`, `formatAppDate()` über `Intl`-APIs
- **Auth-Fehler:** `translateAuthError()` mappt Supabase-Codes (`email_not_confirmed`, `invalid_credentials`, Rate-Limit, …) auf Keys unter `auth.errors.*`
- **Web-Titel:** `useWebPageTitle()` für Login, Register, Create, Activity, Notifications, Profile
- **Sprachumschalter:** `LanguageSwitcher` im Profil-Tab
- **Bereits migriert:** Home-Header (inkl. Standort), Create Hub (inkl. Event-Entwurf), Activity, Login, Register, Profil (Account + Sprache)
- **Noch nicht migriert:** Search, Saved, Home-Inhalte (außer Header/Standort), Event-Detail, Admin, Tab-Labels, Notification-Row-Inhalte

## Nutzerstandort (ER-005.2)

- **Ort:** `app-v2/src/features/location/`
- **Bibliothek:** `expo-location` (Foreground only, kein Background-Tracking)
- **Persistenz:** AsyncStorage-Key `app.userLocation` — speichert `latitude`, `longitude`, `city`, `region`, `country`, `countryCode`, `updatedAt`
- **Kein Supabase:** Standort wird nicht remote gespeichert oder synchronisiert
- **Privacy:** Berechtigung nur nach bewusster Nutzeraktion („Aktuellen Standort verwenden“); beim App-Start wird nur der gespeicherte Standort geladen
- **Anzeige:** Home-Header zeigt „Standort auswählen“ / „Stadt, Land“; Reverse Geocoding nativ via `expo-location`, Web via Nominatim
- **Event-Filter:** Standort wird noch **nicht** für Event-Suche oder Feed-Filterung verwendet (nur Header-Anzeige + Vorbereitung)
- **Home-Filterbutton:** Der frühere Filter-Icon-Button auf der Home-Seite wurde entfernt (Filter bleiben in Search/Collections)

## Edge Functions

**Nicht vorhanden** — kein `supabase/functions/`-Verzeichnis im Repository.

## Storage

- **Buckets** (Migration `20260719000000_initial_schema.sql`): `events`, `artists`, `venues`, `collections` (alle `public: true`)
- **Policies:**
  - `public_read_event_images` — öffentliches Lesen im Bucket `events`
  - `admin_upload_event_images` — Insert nur für Admins (Migration `20260725000000_admin_events_rls.sql`)

## RLS

Row Level Security ist auf allen `public`-Tabellen aktiviert (Initial-Schema + Import-Tabellen + Audit-Log).

**Hilfsfunktionen** (Migration `20260723000000_import_review.sql`):

| Funktion | Zweck |
|----------|-------|
| `public.is_admin()` | `true`, wenn JWT `app_metadata.role` in `viewer`, `editor`, `reviewer`, `source_manager`, `admin`, `owner` |
| `public.admin_role()` | Liefert JWT-Rolle oder Default `viewer` |
| `public.has_admin_role(allowed_roles text[])` | Prüft Admin-Status und Rollenliste |

## Policies

### Öffentlich (`anon`)

| Policy | Tabelle | Zugriff |
|--------|---------|---------|
| `anon_read_published_events` | `events` | SELECT, nur `status = 'published'` |
| `anon_read_active_genres` | `genres` | SELECT, `active = true` |
| `anon_read_active_cities` | `cities` | SELECT, `active = true` |
| `anon_read_active_collections` | `collections` | SELECT, `active = true` |
| `anon_read_venues` | `venues` | SELECT |
| `anon_read_published_artists` | `artists` | SELECT, nur `status = 'published'` |

### Admin (`is_admin()`)

| Policy | Tabelle | Zugriff |
|--------|---------|---------|
| `admin_read_events` | `events` | SELECT |
| `admin_insert_events` | `events` | INSERT (`editor`, `admin`, `owner`) |
| `admin_update_events` | `events` | UPDATE (`editor`, `admin`, `owner`; Publish/Reject nur `admin`/`owner` via Trigger) |
| `admin_delete_events` | `events` | DELETE (`editor`, `admin`, `owner`) |
| `admin_manage_genres` | `genres` | ALL |
| `admin_manage_cities` | `cities` | ALL |
| `admin_manage_venues` | `venues` | ALL |
| `admin_read_artists` | `artists` | SELECT |
| `admin_insert_artists` | `artists` | INSERT (`editor`+; publish on create nur `admin`/`owner`) |
| `admin_update_artists` | `artists` | UPDATE (`editor`+; lifecycle/verify via Trigger) |
| `admin_delete_artists` | `artists` | DELETE (`editor`+) |
| `admin_manage_collections` | `collections` | ALL |
| `admin_read_sources` | `sources` | SELECT |
| `admin_manage_sources` | `sources` | ALL |
| `admin_manage_import_jobs` | `import_jobs` | ALL |
| `admin_manage_import_records` | `import_records` | ALL |
| `admin_manage_import_logs` | `import_logs` | ALL |
| `admin_read_import_audit_logs` | `import_audit_logs` | SELECT |
| `admin_write_import_audit_logs` | `import_audit_logs` | INSERT |

### Storage

| Policy | Zugriff |
|--------|---------|
| `public_read_event_images` | SELECT, Bucket `events` |
| `admin_upload_event_images` | INSERT, Bucket `events`, `is_admin()` |

### SQL-Grants (zusätzlich zu RLS)

| Migration | Inhalt |
|-----------|--------|
| `20260724000000_anon_authenticated_grants.sql` | `USAGE` + `SELECT` auf `public` für `anon`, `authenticated` |
| `20260726000000_authenticated_write_grants.sql` | `INSERT`, `UPDATE`, `DELETE` auf `public` für `authenticated`; `INSERT` auf `storage` |
| `20260727000000_contributor_event_drafts.sql` | Contributor-Drafts (`created_by`, Owner-CRUD für `draft`) |
| `20260728000000_contributor_event_submission.sql` | Einreichung `draft` → `review` durch Owner |
| `20260729000000_unify_event_statuses.sql` | Status vereinheitlicht |
| `20260730000000_contributor_my_events.sql` | Social Links, Venue-Vorschlag, Owner-Read, Withdraw |

### Contributor (`authenticated`, eigene Events)

| Policy | Tabelle | Zugriff |
|--------|---------|---------|
| `auth_insert_own_draft_events` | `events` | INSERT als `draft`, `created_by = auth.uid()` |
| `auth_update_own_draft_events` | `events` | UPDATE eigener `draft`-Events |
| `auth_submit_own_draft_events` | `events` | UPDATE `draft` → `review` |
| `auth_read_own_events` | `events` | SELECT aller eigenen Events |
| `auth_withdraw_own_review_events` | `events` | UPDATE `review` → `draft` |

---

# Datenbank

## Tabellen

### Kern-Domäne (`20260719000000_initial_schema.sql`)

| Tabelle | Beschreibung |
|---------|--------------|
| `genres` | Musik-Genres |
| `cities` | Städte |
| `venues` | Veranstaltungsorte |
| `artists` | Künstler (ER-007: slug, lifecycle, verification, genres[], social links) |
| `collections` | Kuratierte Sammlungen |
| `sources` | Event-Quellen |
| `events` | Events (`status`: draft, review, published, rejected, archived; Social: `website_url`, `instagram_url`, `facebook_url`; Venue-Vorschlag: `venue_name`, `venue_city`) |

### Import (`20260720000000_import_foundation.sql` + Erweiterungen)

| Tabelle | Beschreibung |
|---------|--------------|
| `import_jobs` | Import-Läufe pro Quelle |
| `import_records` | Gestagte Import-Datensätze |
| `import_logs` | Strukturierte Job-/Record-Logs |
| `import_audit_logs` | Admin-Audit-Trail (`20260723000000_import_review.sql`) |

### Erweiterte Spalten (Auswahl)

- `sources`: `adapter_key`, `source_url`, `source_config`, `default_timezone`, `review_required`, `last_import_at`, `last_job_status`, `next_scheduled_at`
- `import_jobs`: Metriken (`fetched_count`, `parsed_count`, …), `triggered_by`, erweiterte Status (`completed_with_warnings`)
- `import_records`: Matching-Felder, Review-Felder (`reviewer_edits`, `duplicate_decision`, `resulting_event_id`, …)

## Views

**Keine** — in den Migrationen sind keine `CREATE VIEW`-Statements vorhanden.

## Functions

| Funktion | Migration |
|----------|-----------|
| `public.is_admin()` | `20260720000000` (ersetzt in `20260723000000`) |
| `public.admin_role()` | `20260723000000_import_review.sql` |
| `public.has_admin_role(text[])` | `20260723000000_import_review.sql` |

## Trigger

**Keine** — in den Migrationen sind keine `CREATE TRIGGER`-Statements vorhanden.

## Storage Buckets

| Bucket | Öffentlich |
|--------|------------|
| `events` | ja |
| `artists` | ja |
| `venues` | ja |
| `collections` | ja |

---

# Migrationen

Chronologische Liste (`app-v2/supabase/migrations/`):

| Datei | Inhalt |
|-------|--------|
| `20260719000000_initial_schema.sql` | Kern-Tabellen, Storage-Buckets, initiale RLS-Policies |
| `20260720000000_import_foundation.sql` | `is_admin()`, Import-Tabellen, Admin-only Sources/Import-RLS |
| `20260721000000_import_adapters.sql` | Job-Metriken, Record-Validierung, erweiterte Job-Status |
| `20260722000000_import_matching.sql` | Matching- und Duplikat-Felder auf `import_records` |
| `20260723000000_import_review.sql` | Rollen-Helfer, Review-Workflow, `import_audit_logs`, Unique-Index aktiver Jobs |
| `20260724000000_anon_authenticated_grants.sql` | `GRANT SELECT` für `anon`/`authenticated` |
| `20260725000000_admin_events_rls.sql` | Admin-only Schreibzugriff auf Events/Referenzdaten, Storage-Upload-Policy |
| `20260726000000_authenticated_write_grants.sql` | `GRANT INSERT/UPDATE/DELETE` für `authenticated` |
| `20260727000000_contributor_event_drafts.sql` | Contributor-Drafts (`created_by`, Owner-CRUD für `draft`) |
| `20260728000000_contributor_event_submission.sql` | Einreichung `draft` → `review` durch Owner |
| `20260729000000_unify_event_statuses.sql` | Status vereinheitlicht (`rejected`, `archived`) |
| `20260730000000_contributor_my_events.sql` | Social Links, Venue-Vorschlag, Owner-Read, Withdraw |
| `20260731000000_contributor_event_image_update.sql` | Contributor Storage UPDATE für Event-Bilder |
| `20260732000000_er006_platform_hardening.sql` | Event-Schreib-RLS an App-Publish-Regeln angeglichen; Contributor-Review-Schutz |

**Hinweis:** Referenz-Seed-Daten liegen in `app-v2/scripts/staging/seed-staging-app-data.sql`, nicht als Supabase-Migration.

---

# Import-System

Implementierung unter `app-v2/src/features/import/`.

## Foundation

- **Migration:** `20260720000000_import_foundation.sql`
- **Tabellen:** `import_jobs`, `import_records`, `import_logs`
- **Orchestrierung:** `ImportOrchestrator` (`services/import-orchestrator.ts`)
- **Repositories:** `import-repositories.ts`, `import-repository-impl.ts`
- **Logging:** `ImportLoggingService`
- **Dokumentation:** `app-v2/docs/import-foundation.md`

## Adapter

- **Registry:** `adapters/import-adapter-registry.ts`, `register-adapters.ts`
- **Registrierte Adapter:** `json_ld`, `rss`, `atom`, `ical`, `csv`, `api_json`
- **Migration:** `20260721000000_import_adapters.sql` (Metriken, Validierungsfelder)
- **Dokumentation:** `app-v2/docs/import-adapters.md`, `import-normalization.md`

## Matching

- **Services:** `ImportMatchingService`, City/Venue/Artist/Genre-Matching, `DuplicateDetectionService`
- **Migration:** `20260722000000_import_matching.sql`
- **Katalog:** `matching-catalog.ts` lädt Cities, Venues, Artists, Genres, published Events
- **Dokumentation:** `app-v2/docs/import-matching.md`

## Review

- **Service:** `ImportReviewService` (`admin/import-review-service.ts`)
- **UI:** `app/admin/imports/review/`
- **Workflow:** Bearbeiten (`reviewer_edits`), Approve, Reject, Duplikat-Entscheidungen
- **Approve:** Erstellt Event mit Status `draft` via `AdminEventRepository.save()` — **kein automatisches Publish**
- **Migration:** `20260723000000_import_review.sql`
- **Dokumentation:** `app-v2/docs/import-review.md`

## Publish

- Import-Approve legt Events als `draft` an (`import-review.md`, `buildAdminEventFromRecord` in `import-review-service.ts`)
- Veröffentlichung (`published`) erfolgt über Admin-Event-CRUD, nicht automatisch im Import-Flow

## Scheduler

- **Datenmodell:** `import_jobs.trigger_type` ∈ `manual`, `scheduled`, `webhook` (`models/statuses.ts`)
- **DB:** `sources.next_scheduled_at` (Migration `20260723000000`)
- **Manueller Start:** `ImportOperationsService.startManualImport()` (`admin/import-operations-service.ts`)
- **Kein Scheduler-Code** im Repository (keine Cron-/Webhook-Implementierung, keine Edge Function)

---

# Authentifizierung

## Aktueller Login

- **Gemeinsame Route:** `/login` (`app/login.tsx`) — Session global via `AuthProvider`
- **Registrierung:** `/register` (`app/register.tsx`) — normale Benutzer ohne Admin-Rolle
- **Create Hub:** `/create` (`app/create.tsx`) — Community-Einstieg vom Home-Header „+ Erstellen“
- **Event-Einreichung (Consumer):** `/create/event` — Draft anlegen, bearbeiten, Vorschau, Einreichen zur Moderation, Status in **Meine Events** verfolgen
  - Services: `ContributorEventService` (`createEvent`, `updateEvent`, `submitForReview`, `withdrawFromReview`, `getMyEvents`, `getEvent`)
  - Social Links: eigene Spalten `website_url`, `instagram_url`, `facebook_url` (nicht mehr in `description`)
  - Venue: `venue_id` für bestätigte Venues; strukturierter Vorschlag über `venue_name` / `venue_city` (kein Freitext mehr in `subtitle`)
  - Upload: `ContributorImageUploadService` — nur persistierbare `https://` Storage-URLs in `image_url` / `flyer_url`; lokale `file://`/`content://`/`blob:` nur für Formular-Vorschau
  - Status (einheitlich): `draft`, `review`, `published`, `rejected`, `archived` — Consumer-Übergänge: `draft` ↔ `review` nur
  - Ownership: `created_by`; RLS in `20260727000000`, `20260728000000`, `20260730000000`
- **Profil-Tab:** Anmelden, Konto erstellen und Abmelden über `/profile`
- **Aktivitäten:** `ActivityPanel` vom Home-Header; Fallback-Routen `/notifications` und `/activity`
- **Admin-Redirect:** `/admin/login` leitet auf `/login?returnTo=…` weiter
- **Session:** Ein `AuthProvider` im Root-Layout; `useAdminAuth()` ergänzt Rollenlogik ohne eigenen Provider
- **Supabase:** E-Mail/Passwort über `authService.signIn()` und `authService.signUp()`
- **Lokal (Mock):**
  - Admin: `admin@eternalrave.app` / `admin-local-dev` → Rolle `owner`
  - Consumer: `user@eternalrave.app` / `user-local-dev` → keine Admin-Rolle

## Admin-Login

- Unauthentisierte Admin-Zugriffe leiten zu `/login?returnTo=/admin/…`
- Nach Login: Redirect zu `returnTo` (interne Pfade) oder `/`
- Web-only Guard in Admin-Layout; Rollenprüfung über `admin-guard.ts` unverändert

## Rollenmodell

**JWT `app_metadata.role`** — gültige Werte (`admin-roles.ts`, `admin-web.md`):

`viewer` | `editor` | `reviewer` | `source_manager` | `admin` | `owner`

**DB:** `is_admin()` akzeptiert alle sechs Rollen; keine separaten Benutzer-Tabellen in Migrationen.

## Berechtigungen

- **App-Code:** `admin-roles.ts` — `ROLE_PERMISSIONS` pro Rolle (z. B. `records:approve`, `imports:start`, `sources:write`)
- **Admin-Routen:** `admin-permissions.ts`, `admin-guard.ts` — Route-zu-Permission-Mapping
- **DB:** RLS via `is_admin()` auf Admin-Tabellen; öffentliches Lesen nur für publizierte Events und aktive Referenzdaten

---

# Offene TODOs

Suche nach `TODO`, `FIXME`, `HACK` im Repository:

## Code (`app-v2/`, `*.ts`, `*.tsx`, `*.sql`)

**Keine Treffer** in TypeScript- oder SQL-Dateien unter `app-v2/`.

## Aktive App-Dokumentation (`app-v2/`)

| Datei | Eintrag |
|-------|---------|
| `docs/launch-checklist.md` | Google Play feature graphic 1024×500 — **TODO** |
| `docs/migration.md` | Abschnitt „Sprint 12 TODO“ (Seed, Rollen, Audit, Matching — teils inzwischen umgesetzt, Abschnitt nicht aktualisiert) |
| `SPRINT_11_BACKEND_ADMIN_REPORT.md` | Abschnitt „Open TODOs (Sprint 12)“ |

## Referenzmaterial (`reference/docs/Blueprint/`)

Zahlreiche Platzhalter `<!-- TODO: Inhalte in dediziertem Blueprint-Sprint ausarbeiten -->` in Blueprint-Markdown-Dateien (kein aktiver App-Code).

---

# Bekannte technische Schulden

Aus dokumentiertem Projektstand (`PROJECT_STATUS_REPORT_AFTER_LAST_11_SPRINTS.md`, `go-live.md`, `BUILD_STATUS.md`, Code):

| Thema | Beschreibung |
|-------|--------------|
| Mock als Standard | `EXPO_PUBLIC_USE_SUPABASE=false` — Repositories nutzen lokale Pipeline ohne Cloud |
| Remote-Staging | Laut Projektstatusbericht: Supabase lokal validiert, Remote-Staging-Seed nicht als ausgeführt dokumentiert |
| Kein Consumer-Login | ~~Favoriten nur lokal~~ — Login/Register vorhanden; Favoriten weiterhin nur lokal, keine Cloud-Sync |
| i18n unvollständig | Kern-Screens migriert; ältere Screens (Search, Saved, Tabs, Admin) noch mit fest codierten Texten |
| Map-Tab | Zeigt Platzhalter statt Karte (`MapUnavailableState`) |
| Import-Scheduler | `scheduled`/`webhook` im Modell, keine Laufzeit-Implementierung |
| Import-Publish | Genehmigte Imports erzeugen `draft`-Events, manueller Publish-Schritt nötig |
| `database.md` / `BUILD_STATUS.md` | Teilweise veraltet gegenüber aktuellem Stand (z. B. RLS-Beschreibung, Sprint-1-Platzhalter) |
| Go-Live | `go-live.md`: alle Sign-off-Kriterien (G1–G15) noch „Pending“, kein Go-Live durchgeführt |
| Rechtliches / Store | Gehostete Rechtstexte, Store-Assets, formale QA-Freigaben laut Statusbericht offen |
| `migration_export.zip` | Duplikat im Repo-Root neben `reference/migration/` |
| Legacy Event-Texte | Ältere Events können Social Links in `description` und Venue in `subtitle` haben — nur lesender Legacy-Pfad, keine Auto-Migration |

---

# Vor Release / Später ergänzen

| Thema | Status |
|-------|--------|
| Social Links normalisieren | Erledigt (ER-013) |
| Venue-Freitext in `subtitle` ablösen | Erledigt (ER-013) |
| HTML-Button-Verschachtelung (RN Web) | Erledigt (ER-005.1) — `InteractiveCard` |
| Auth- und Formular-UX-Polish (Basis) | Erledigt (ER-005.1) |
| Home-Header Standort & Auth-abhängige Aktionen | Erledigt (ER-005.2) |
| Auth Callback, Deep Linking & E-Mail-Bestätigung | Erledigt (ER-005.3) |
| Platform Architecture Foundation | Erledigt (ER-005.4) |
| Core Workflow Reliability | Erledigt (ER-005.5) |
| Admin-Moderation & Publishing | Done (ER-006 + Platform Hardening) |
| Autosave für Event-Entwürfe | Offen |
| Benutzername / Anzeigename | Offen (Plan: `app-v2/docs/auth-username-plan.md`) |
| Kompletter UX-Polish / Microinteractions | Offen |
| Pflegbare Inhalte außerhalb des Codes | Offen |
| E-Mail-Bestätigung Callback / Resend | Offen (`app-v2/docs/auth-email-confirmation.md`) |

---

# Nächste sinnvolle Entwicklungsschritte

Nur aus im Repository dokumentierten offenen Punkten / Blockern (keine Roadmap-Spekulation):

1. **Go-Live-Gates schließen** — Kriterien G1–G15 in `app-v2/docs/go-live.md` (QA, Legal HTTPS, Security-Sign-off, Store-Compliance, Monitoring, Backups)
2. **Remote-Staging** — Migrationen pushen, `npm run seed:staging:remote` bzw. `scripts/staging/seed-staging-app-data.sql` anwenden (`app-v2/docs/staging-seed.md`)
3. **Store-Assets** — z. B. Google Play Feature Graphic (`docs/launch-checklist.md`)
4. **Dokumentation synchronisieren** — `docs/database.md`, `docs/migration.md` (Sprint-12-TODO-Abschnitt), `BUILD_STATUS.md` an aktuellen Code/Migrationen anpassen
5. **Import-Betrieb** — Scheduler/Webhook-Laufzeit fehlt im Code; manuelle Imports über Admin-UI/`ImportOperationsService` sind der aktuelle Weg (`app-v2/docs/import-runbook.md`, `import-operations.md`)
