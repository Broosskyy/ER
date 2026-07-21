# Eternal Rave

**Stand:** 20. Juli 2026 · **Version:** `0.2.0` (`app-v2/`)  
**Einstieg:** Aktive App in `app-v2/`. Referenzmaterial in `reference/` — nicht importieren.

Weitere Docs: `docs/master/Master_Handbook.md` (Produkt), `docs/engineering/Engineering_Handbook.md` (Technik), `docs/ARCHITECTURE_ROADMAP.md` (Langfristige Vision & Zielarchitektur), `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` (ER-005.4 Ist vs. Ziel & Migrationsstrategie), `CLAUDE.md` (Arbeitsregeln), `BACKLOG.md` (Aufgaben), `docs/PROJECT_STATE.md` (Detail-Iststand), `RELEASE_PLAN.md` (Releases).

---

## Projektziel

Eternal Rave ist eine Event-Discovery-Plattform für elektronische Musik — mit langfristiger Ausrichtung auf eine Community-Plattform für die Szene (siehe `docs/ARCHITECTURE_ROADMAP.md`). Nutzer entdecken Events über Home, Search und Collections; Admins pflegen Inhalte und steuern Imports über einen Web-Admin. Zielplattformen: Android, Web/PWA und iOS (vorbereitet).

---

## Aktueller Entwicklungsstand

- **Release:** RC `0.2.0` — Closed Beta geplant, **nicht gestartet** (`RELEASE_PLAN.md`)
- **Daten:** Standard ist lokaler Mock (`EXPO_PUBLIC_USE_SUPABASE=false`); Supabase-Anbindung implementiert, Remote-Staging laut Projektstatus nicht befüllt
- **Consumer-App:** Home, Search, Saved, Profile, Event-Detail funktionsfähig; Map-Tab = Platzhalter; Create Hub, **Meine Events**, Activity-Panel (nur eingeloggt im Home-Header, ER-005.2)
- **Standort:** Foreground-Location via `expo-location`; lokal in AsyncStorage (`app.userLocation`); nur nach Nutzeraktion; keine Event-Filterung (ER-005.2)
- **Admin:** Web-only unter `/admin` — Events-CRUD inkl. **Multi-Artist-Lineup-Editor** (ER-008), Contributor-Moderation (`/admin/events/review`), **Artist-CMS** (`/admin/artists`, ER-007), Import (Sources, Jobs, Review)
- **Auth:** Globaler `AuthProvider`; Login/Register; E-Mail-Bestätigung mit `/auth/callback`, Resend, Passwort-Reset (ER-005.3)
- **i18n:** Deutsch und Englisch (`src/features/i18n/`); Auth-Fehler über `error.code` (`email_not_confirmed`, `invalid_credentials`, …)
- **Import:** Manuell startbar; Approve erzeugt Events mit Status `draft` (nicht auto-published); kein Scheduler im Code
- **Tests:** Vitest; `npm run release:check` laut Statusbericht PASS
- **Offene Kernarbeit:** `BACKLOG.md` — ER-008 Done (Multi-Artist Lineup Foundation); nächster strategischer Fokus ER-009 (Venue Admin CMS)

---

## Technologie

| Bereich | Stack |
|---------|-------|
| App | React Native 0.86, Expo SDK 57, Expo Router |
| Sprache | TypeScript (strict) |
| Web | React Native Web, statischer Export |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Client | `@supabase/supabase-js` |
| State/Daten | Repository-Pattern, Feature Flags |
| Styling | StyleSheet + Design-Tokens |
| Tests | Vitest |
| Builds | EAS (iOS/Android), Metro (Web) |

**Nicht vorhanden:** Edge Functions, Consumer-Accounts-Tabelle, Push-Notifications.

---

## Architektur

```
Screens (app/)
  → Features (src/features/)
  → Repositories (src/data/repositories/)
  → Datasources (local | supabase)
  → Mock-Pipeline oder Supabase PostgreSQL
```

- UI spricht **nie** direkt mit Supabase — nur Repositories
- Feature-Flag `featureFlags.useSupabase` in `src/core/config/feature-flags.ts`
- Admin-Routen isoliert unter `app/admin/`; `useAdminAuth()` ohne separaten Provider
- RLS in PostgreSQL ist die autoritative Zugriffskontrolle
- **i18n:** Neue Consumer-UI-Texte über `useAppTranslation()` und Keys in `src/features/i18n/locales/` — keine fest codierten Strings in neuen Features

---

## Hauptmodule

`app-v2/src/features/`:

| Modul | Zweck |
|-------|-------|
| `home` | Home-Screen, Event-Karten, Standort-Header |
| `location` | Nutzerstandort (Foreground, AsyncStorage, kein Supabase) |
| `search` | Suche, Filter, Explore |
| `events` | Pipeline, Repository, Display-Modelle |
| `event-detail` | Event-Detail-UI |
| `collections` | Kuratierte Sammlungen |
| `saved` / `favorites` | Gespeicherte Events (lokal) |
| `map` | Karten-Platzhalter |
| `notifications` | Lokales Notification Center |
| `activity` | Activity-Panel und Deep-Link |
| `create` | Create Hub, Event-Einreichung, Draft/Preview/Submit |
| `my-events` | Eigene Events listen, filtern, zurückziehen |
| `auth` | Globaler Auth-Context |
| `i18n` | Internationalisierung (de/en) |
| `admin` | Admin-Shell, Guards, Permissions, Artist-CMS |
| `import` | Adapter, Matching, Review, Operations |
| `artists` | Artist-Domain, Validation, Service (ER-007) |

Querschnitt: `src/data/` (Repositories, Datasources, Mapper), `src/services/supabase/` (Client, Auth).

---

## Authentifizierung

**Ist (Code):**
- Login: `/login` und `/register` → `authService.signIn()` / `signUp()` (`src/services/supabase/auth-service.ts`)
- Session: globaler `AuthProvider` in `app/_layout.tsx`
- Admin: `useAdminAuth()` leitet Rolle aus Session ab; `/admin/login` → Redirect zu `/login?returnTo=…`
- Rollen: JWT `app_metadata.role` — `viewer`, `editor`, `reviewer`, `source_manager`, `admin`, `owner`
- DB: `is_admin()`, `admin_role()`, `has_admin_role()` in Migration `20260723000000`
- Lokaler Modus: `admin@eternalrave.app` / `admin-local-dev` → Rolle `owner`; `user@eternalrave.app` / `user-local-dev` → Consumer

**Ziel (Backlog ER-002–003):** Rollenmodell dokumentieren und Admin vollständig auf gemeinsamen Login abstimmen.

---

## Datenbank

**Ort:** `app-v2/supabase/migrations/` (15 Migrationen, chronologisch `20260719`–`20260733`)

**Tabellen:** `events`, `genres`, `cities`, `venues`, `artists`, `collections`, `sources`, `import_jobs`, `import_records`, `import_logs`, `import_audit_logs`

**Functions:** `is_admin()`, `admin_role()`, `has_admin_role()`  
**Views / Trigger:** keine  
**Storage-Buckets:** `events`, `artists`, `venues`, `collections` (öffentlich lesbar)

**RLS:** Aktiv auf allen Tabellen. Anonym: nur `published` Events + `published` Artists + aktive Referenzdaten. Admin: `is_admin()` für CMS-Lesen; rollenbasierte Schreib-Policies (Events ER-006, Artists ER-007).

**Seed:** `app-v2/scripts/staging/seed-staging-app-data.sql` (keine Supabase-Migration).

---

## Import-System

```
Source → Adapter → Orchestrator → import_records
  → Matching → Review (Admin) → Event (draft)
```

- **Adapter:** `json_ld`, `rss`, `atom`, `ical`, `csv`, `api_json` (`register-adapters.ts`)
- **Services:** `ImportOrchestrator`, `ImportOperationsService`, `ImportReviewService`
- **Trigger-Typen im Modell:** `manual`, `scheduled`, `webhook` — nur `manual` im Code umgesetzt
- **Publish:** Approve legt Event als `draft` an; Consumer: Draft → `review` via Submit; Withdraw `review` → `draft`; Admin moderiert via `/admin/events/review` (`review` → `published` / `rejected`, ER-006 Done)
- **Consumer Event Flow:** Create Hub → `/create/event` → Edit → Preview → Submit (`draft` → `review`) → **Meine Events** (`/profile/events`); Social Links in eigenen Spalten; Venue via `venue_id` oder strukturierter Vorschlag (`venue_name`/`venue_city`)

---

## Wichtige Architekturentscheidungen

- `/admin` bleibt bestehen (Web-only, eigene Routen)
- **Ziel:** gemeinsamer Login für Consumer und Admin (ER-001, noch offen)
- Rollenbasierter Admin-Zugriff via JWT + App-Permissions + RLS
- Supabase Auth als Identity-Provider
- RLS bleibt Sicherheitsinstanz — Grants allein reichen nicht
- Import-Pipeline erweitern, nicht ersetzen
- Bestehende Migrationen nicht neu erzeugen — nur additive Migrationen

---

## Platform Foundation (ER-005.4)

Langfristige Zielarchitektur und Migrationsstrategie: `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md`

**Domain-Planning-Types** (keine DB, keine Runtime-Abhängigkeit):
- `src/features/events/domain/event-status-dimensions.ts`
- `src/features/events/domain/ticketing-foundation.ts`
- `src/features/events/domain/organizer-foundation.ts`

**Bekannte Schema-Gaps (nicht in ER-005.4 behoben):** Multi-Artist/Genre Junctions, `organizers` Tabelle, native Ticketing, unified Content-Modell, `profiles` Tabelle.

---

## Was NICHT getan werden darf

- Keine doppelten Migrationen
- Keine bestehende Architektur ersetzen (Repository-Pattern, Feature-Module)
- Keine bestehenden APIs ohne Analyse ändern
- Keine Vermutungen über den Code — erst lesen, dann handeln
- Nicht aus `reference/` in `app-v2/` importieren

---

## Arbeitsweise

Vor jeder Änderung — **Pflichtlektüre** (als Anforderungen behandeln, nicht als optionale Referenz):

1. `AI_CONTEXT.md` — Architektur, Verbote, Ist-Stand
2. `docs/PROJECT_STATE.md` — Detail-Iststand, RLS, Module
3. `BACKLOG.md` — aktives Epic, Definition of Done, Abhängigkeiten
4. `docs/ARCHITECTURE_ROADMAP.md` — Langfristvision, Phasen-Grenzen
5. `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` — Ist vs. Ziel, Migrationsstrategie
6. `app-v2/docs/ER-005.4_COMPLETION_REPORT.md` — Foundation-Scope und bekannte Gaps
7. Relevantes Epic-Completion-Report (z. B. `ER-006_COMPLETION_REPORT.md`) bei Folgearbeit

Dann:

1. Betroffene Module im Code analysieren (Grep, bestehende Services/Repositories)
2. Auswirkungen prüfen (RLS, Rollen, Tests, Docs)
3. Plan erstellen; Risiken nennen (`CLAUDE.md`)
4. Nur im Epic-Scope implementieren; ER-005.4-Architektur nicht durch Shortcuts ersetzen
5. Nach größeren Änderungen prüfen: `AI_CONTEXT.md`, `docs/PROJECT_STATE.md`, `BACKLOG.md`, relevante Epic-Reports
