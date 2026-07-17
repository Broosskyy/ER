# 04 — Backend

Supabase Backend-Dokumentation für Eternal Rave.

---

## Verwandte Bände

| Band | Thema | Link |
|------|-------|------|
| **4.5** | Event Automation — Import, Pipeline, Moderation, KI | [04.5-event-automation/README.md](../04.5-event-automation/README.md) |
| **4.6** | Authentication & Identity — Rollen, Login, Verification | [04.6-authentication-identity/README.md](../04.6-authentication-identity/README.md) |

**Hinweis:** Band 4 beschreibt die technische Backend-Infrastruktur. Event Automation (4.5) und Authentication (4.6) sind eigenständige Bible-Bände mit Querverweisen hierher.

---

## Kapitel (Band 4 Backend Bible)

| # | Datei | Thema |
|---|-------|-------|
| 01 | [Architektur Übersicht](./01_Architektur_Uebersicht.md) | Systemarchitektur |
| 02 | [Infrastruktur & Deployment](./02_Infrastruktur_Deployment.md) | Supabase, Hosting |
| 03 | [Authentifizierung & Autorisierung](./03_Authentifizierung_Autorisierung.md) | Auth — siehe auch **Band 4.6** |
| 04 | [API Design Standards](./04_API_Design_Standards.md) | REST, RLS |
| 05 | [Datenmodell & Datenbanken](./05_Datenmodell_Datenbanken.md) | Schema |
| 06 | [Realtime Services](./06_Realtime_Services.md) | Subscriptions |
| 07 | [Sicherheit & Compliance](./07_Sicherheit_Compliance.md) | Security |
| 08 | [Zahlungssysteme](./08_Zahlungssysteme_Abonnements.md) | Future |
| 09 | [Monitoring & Logging](./09_Monitoring_Logging.md) | Observability |
| 10 | [Backup & DR](./10_Backup_Disaster_Recovery.md) | Recovery |
| 11 | [Roadmap Zukunft](./11_Roadmap_Zukunft.md) | Backend Roadmap |
| 12 | [Backend Readiness](./12_Backend_Readiness.md) | Launch Checklist |

---

## Event Automation (Band 4.5)

Import Pipeline, Confidence Score, Duplicate Detection, Moderation und KI Agent:

→ **[Band 4.5 Event Automation Bible](../04.5-event-automation/README.md)**

Kernthemen:
- [Import Pipeline](../04.5-event-automation/03_Import_Pipeline.md)
- [Event Sources](../04.5-event-automation/02_Event_Sources.md)
- [Moderation Workflow](../04.5-event-automation/09_Moderation_Workflow.md)
- [Automation Architecture](../04.5-event-automation/AUTOMATION_ARCHITECTURE.md)

---

## Authentication (Band 4.6)

Rollen, Registrierung, JWT, Sessions, Organizer Verification:

→ **[Band 4.6 Authentication & Identity Bible](../04.6-authentication-identity/README.md)**

Kernthemen:
- [User Roles](../04.6-authentication-identity/02_User_Roles.md)
- [Login & JWT](../04.6-authentication-identity/03_Login.md)
- [Organizer Verification](../04.6-authentication-identity/05_Organizer_Verification.md)

---

## Setup (detailliert)

Siehe **[supabase/README.md](../../supabase/README.md)** im Repository-Root.

## Migrationen (Reihenfolge)

| # | Datei | Sprint |
|---|-------|--------|
| 1 | `supabase/migrations/001_initial_schema.sql` | 2.0 — Schema, Auth, RLS |
| 2 | `supabase/migrations/002_event_sources.sql` | 2.1/2.3 — Source Manager |
| 3 | `supabase/migrations/003_user_submission_rls.sql` | 2.2 — User Submissions |
| 4 | `supabase/migrations/004_duplicate_warning_events.sql` | 2.4 — Duplicate Warnings |

## Optional Seeds

- `supabase/seed_published_events.sql` — 30 published Events
- `supabase/seed_event_sources.sql` — Beispiel-Import-Quellen

## Env

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Ohne Env: App läuft im **Demo-Modus** mit Mock-Daten.

## Core Tables

`profiles` · `organizers` · `venues` · `events` · `event_artists` · `favorites` · `event_submissions` · `import_sources` · `event_sources` · `reports`

## Service Layer

`src/services/` — authService, eventService, adminService, imports, …

## Event Lifecycle

Nur `lifecycle_status = published` erscheint im öffentlichen Feed.

Siehe [Band 4.5 Event Lifecycle](../04.5-event-automation/07_Event_Lifecycle.md)
