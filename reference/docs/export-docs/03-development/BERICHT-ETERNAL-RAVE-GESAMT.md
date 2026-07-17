# Eternal Rave — Gesamtbericht (Sprint 1.4 bis 2.5 + Duplicate Detection)

**Projekt:** Eternal Rave — Mobile Event-Discovery-App für Electronic Music  
**Stand:** 29. Juni 2026  
**Repository:** https://github.com/Broosskyy/Eternal-Rave  
**Tech-Stack:** React Native · Expo SDK 56 · TypeScript · Expo Router · NativeWind · Supabase  

**Download (Plain Text):** [`docs/BERICHT-ETERNAL-RAVE-GESAMT.txt`](./BERICHT-ETERNAL-RAVE-GESAMT.txt)  
**Product Vision:** [`01-product-vision/PRODUCT-VISION.md`](../01-product-vision/PRODUCT-VISION.md)  
**Mockup-Alignment:** [`02-ui-design/MOCKUP-ALIGNMENT.md`](../02-ui-design/MOCKUP-ALIGNMENT.md)

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Übersicht aller 7 Prompts / Sprints](#2-übersicht-aller-7-prompts--sprints)
3. [Sprint 1.4 — Final UI/Flow Polish](#3-sprint-14--final-uiflow-polish)
4. [Sprint 2.0 — Supabase Backend Foundation](#4-sprint-20--supabase-backend-foundation)
5. [Sprint 2.1 — Seed Events & Published Feed](#5-sprint-21--seed-events--published-feed)
6. [Sprint 2.2 — Event Submission & Admin Review](#6-sprint-22--event-submission--admin-review)
7. [Sprint 2.3 — Source Manager & Import Foundation](#7-sprint-23--source-manager--import-foundation)
8. [Sprint 2.4 — Published Events Feed (merged)](#8-sprint-24--published-events-feed-merged)
9. [Sprint 2.4 — Duplicate Detection Foundation](#9-sprint-24--duplicate-detection-foundation)
10. [Sprint 2.5 — Text Import Parser Light](#10-sprint-25--text-import-parser-light)
11. [Architektur & Datenmodell](#11-architektur--datenmodell)
12. [Pull Requests & Branch-Status](#12-pull-requests--branch-status)
13. [Setup-Anleitung (Supabase)](#13-setup-anleitung-supabase)
14. [Was noch nicht implementiert ist](#14-was-noch-nicht-implementiert-ist)
15. [Nächste Schritte — Empfohlener Plan](#15-nächste-schritte--empfohlener-plan)
16. [Qualitätssicherung & Verifikation](#16-qualitätssicherung--verifikation)
17. [Anhang — Wichtige Dateipfade](#17-anhang--wichtige-dateipfade)

---

## 1. Executive Summary

In sieben aufeinander aufbauenden Entwicklungsphasen wurde die Eternal-Rave-App von einem polierten Frontend-MVP zu einer **Supabase-gestützten Event-Plattform** mit echtem Backend, Admin-Workflows und Import-Pipeline erweitert.

**Kern-Ergebnisse:**

- Premium Dark-UI mit klarer Navigation und konsistentem Event-Lifecycle
- Supabase-Anbindung (Auth, Postgres, RLS) mit **Demo-Fallback** ohne Konfiguration
- Öffentlicher Feed zeigt ausschließlich Events mit `lifecycle_status = published`
- 30 Seed-Events für realistische europäische Rave-Szene
- User können Events einreichen → Admin prüft → Publish ins Live-Feed
- Source Manager + URL/Text-Importer mit Admin-Review-Workflow
- Erster **regelbasierter Text-Parser** für eingefügte Event-Beschreibungen (ohne Web-Scraping)
- **Duplicate Detection** vor Publish — Admins sehen Match-Warnungen mit Confidence Score
- **Product Vision & Mockup-Alignment** als kanonische Referenzdokumente in `docs/`

Die App ist **produktionsnah für Beta-Tests**, benötigt aber noch Supabase-Deployment, PR-Merge und einen neuen APK-Build für Endnutzer.

---

## 2. Übersicht aller Sprints

| # | Sprint | PR | Branch | Status |
|---|--------|-----|--------|--------|
| 1 | **1.4** Final UI/Flow Polish | [#10](https://github.com/Broosskyy/Eternal-Rave/pull/10) | `cursor/sprint-1-4-ui-polish-a932` | Draft |
| 2 | **2.0** Supabase Backend Foundation | [#11](https://github.com/Broosskyy/Eternal-Rave/pull/11) | `cursor/sprint-2-0-supabase-foundation-a932` | Draft |
| 3 | **2.1** Seed Events & Published Feed | [#12](https://github.com/Broosskyy/Eternal-Rave/pull/12) | `cursor/sprint-2-1-seed-events-a932` | Draft |
| 4 | **2.2** Event Submission & Admin Review | [#13](https://github.com/Broosskyy/Eternal-Rave/pull/13) | `cursor/sprint-2-2-submission-review-a932` | Draft |
| 5 | **2.3** Source Manager & Import Foundation | [#14](https://github.com/Broosskyy/Eternal-Rave/pull/14) | `cursor/sprint-2-3-source-manager-a932` | Draft |
| 6 | **2.4** Published Events Feed | [#9](https://github.com/Broosskyy/Eternal-Rave/pull/9) | `cursor/sprint-2-4-published-feed-a932` | **Merged → main** |
| 7 | **2.5** Text Import Parser Light | [#15](https://github.com/Broosskyy/Eternal-Rave/pull/15) | `cursor/sprint-2-5-text-parser-a932` | Draft |
| 8 | **2.4** Duplicate Detection Foundation | [#16](https://github.com/Broosskyy/Eternal-Rave/pull/16) | `cursor/sprint-2-4-duplicate-detection-a932` | Draft |

**Hinweis zur Nummerierung:** „Published Feed“ (PR #9) wurde früher als Sprint 2.4 gemerged. **Duplicate Detection** ist der aktuelle Sprint 2.4 laut Product Roadmap. Beide sind im Bericht dokumentiert.

**Empfohlene Merge-Reihenfolge:** #10 → #11 → #12 → #13 → #14 → #15 → #16 (PR #9 ist bereits in `main`).

---

## 3. Sprint 1.4 — Final UI/Flow Polish

**Ziel:** Frontend-MVP visuell und UX-seitig finalisieren, bevor das Backend live geht. Keine neuen Features, kein Backend.

### Was gemacht wurde

**Home-Screen**
- Stärkere „Raves near you“-Sektion mit Untertitel und größerer Featured-Hero-Card
- Location-Pill + kompaktes Add-Event-Icon statt voller Button-Breite
- Klare „When“-Datumsfilter-Zeile; Events nach Entfernung sortiert
- Story-Circles dezent (ohne Neon-Ring), unterhalb des Haupt-Feeds
- Backend-Status-Banner nur bei Fehler oder Demo-Fallback

**Event-Karten**
- Größere Titel, Icon-basierte Metadaten (Datum, Zeit, Venue, Entfernung)
- Bis zu 3 Genre-Tags in Akzentfarbe, Favoriten-Button immer sichtbar
- Klarere Ticket-Preis-Zeile mit optionalem CTA

**Featured Card**
- Höhere Hero-Card (h-64), Featured-Badge, weicherer Gradient

**Map**
- Bewusstes Preview-Design mit Grid, Map-Icon, „Real map coming soon“-Callout
- Größere Touch-Targets im Bottom-Sheet

**Add Event**
- Formular-Sektionen in bordered Cards mit Untertiteln
- Sticky Submit-Footer via `FormScreenLayout`

**Admin & Review**
- Admin-Dashboard: größere Link-Cards, Pending-Badge, vereinfachte Stats
- Review- & Import-Cards: klareres Action-Grid (Approve, Publish live, Mark duplicate)
- Größere Status-Badges mit Uppercase-Labels

**Navigation**
- Back-Fallbacks auf Organizer-Preview, Register, Admin Sources, Organizer Edit

**Visueller Ton**
- Reduzierter Primary/Neon-Glow
- Premium Dark Surfaces durchgängig

---

## 4. Sprint 2.0 — Supabase Backend Foundation

**Ziel:** App an Supabase anbinden — Client, Env, Auth, Rollen, Schema, Services, Dummy-Fallback.

### Was gemacht wurde

**Supabase Client & Konfiguration**
- `src/lib/supabase/client.ts` — Supabase JS Client
- `src/lib/supabase/env.ts` — Env-Validierung (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- `.env.example` als Vorlage

**Datenbank-Schema** (`supabase/migrations/001_initial_schema.sql`)
- Tabellen: `profiles`, `organizers`, `venues`, `events`, `event_artists`, `favorites`, `event_submissions`, `import_sources`, `reports`
- Enums: `user_role`, `lifecycle_status`, `verification_status`, etc.
- Row Level Security (RLS) für alle relevanten Tabellen
- Trigger für `updated_at` und automatische Profile-Erstellung bei Registrierung

**TypeScript-Typen**
- `src/types/database.ts` — vollständige DB-Typen für alle Tabellen

**Auth Foundation**
- `src/hooks/useAuth.tsx` — AuthProvider mit Register, Login, Logout, Loading States
- Rollen: `user`, `organizer`, `admin`
- Refactored auf `authService` als kanonische API

**Service Layer** (formale Sprint-2.0-Module)
| Service | Aufgabe |
|---------|---------|
| `authService` | Session, Sign-In/Up/Out, Auth-Subscription |
| `eventService` | Published Feed, Lifecycle, Organizer-Events |
| `favoriteService` | User-Favoriten |
| `submissionService` | Event-Submissions |
| `importService` | Import-Quellen |
| `adminService` | Review-Queue, Stats, Approve/Publish/Reject/Duplicate |

**Dummy-Fallback**
- App läuft ohne Supabase-Env-Keys mit lokalen Mock-Daten (Sprint-1.2-Verhalten)
- `BackendStatusBanner` zeigt Demo-Modus, Lade- und Fehlerzustände

**Public-Feed-Sicherheit**
- Nur Events mit `lifecycle_status = published` erscheinen in öffentlichen Queries
- Eingereichte/importierte Drafts bleiben privat

---

## 5. Sprint 2.1 — Seed Events & Published Feed

**Ziel:** 30 realistische Seed-Events in Supabase + Feed-Polish für sofort sichtbare Live-Daten.

### Was gemacht wurde

**Seed-Daten (30 published Events)**
- Datei: `supabase/seed_published_events.sql` (idempotent, `source_type = 'seed'`)
- Generator: `scripts/generate-seed-events.js` → `npm run seed:generate`
- **Städte:** Berlin, Hamburg, Köln, Frankfurt, Amsterdam, Rotterdam, Vienna, Zurich, Prague, Barcelona, London
- **Genres:** Techno, Hard Techno, House, Melodic Techno, DnB, Psytrance, Hardcore, Industrial, Minimal
- Jedes Event enthält: Titel, Beschreibung, Venue, Stadt, Land, Datum/Zeit, Genres, Lineup (`event_artists`), Preis, Ticket-URL, Source-URL, Flyer, `lifecycle_status = published`

**Feed-Verbesserungen**
- Erweiterte Stadt-/Genre-Filter in `src/constants/theme.ts`
- Home-Default-Filter: „This Month“ (besserer erster Load nach Seeding)
- Event-Detail: „Get tickets“ öffnet `ticketUrl` wenn vorhanden
- Mapper-Verbesserungen: `ticketUrl`, `sourceUrl`, stadtbasierter Abstand, Featured/Verified-Flags

---

## 6. Sprint 2.2 — Event Submission & Admin Review

**Ziel:** Echte User-Event-Einreichung → Supabase → Admin-Review-Lifecycle.

### Was gemacht wurde

**User-Submission-Flow**
- **Add Event** schreibt in `events` mit `lifecycle_status = pending_review` und `source_type = user_submission`
- Login erforderlich wenn Supabase konfiguriert
- Success-Screen nach Einreichung mit Link zu „My Submissions“
- **My Submissions** lädt eigene Submissions mit Pull-to-Refresh und Status-Badges (Pending, Approved, Published, Rejected, Duplicate)

**Admin-Review-Flow**
- **Review Events** lädt nicht-öffentliche Lifecycle-Rows: `pending_review`, `imported_draft`, `needs_review`, `approved`, `rejected`, `duplicate`
- Aktionen: **Approve**, **Publish live**, **Reject**, **Mark duplicate**
- **Edit before publish** unter `/admin/review/edit/[id]`
- Nach Publish: `refreshPublicFeed()` → Event erscheint sofort auf Home/Events

**Security (Migration 003)**
- `supabase/migrations/003_user_submission_rls.sql`
- User können eigene pending Submissions inserten/lesen/updaten
- User können **nicht** publishen — nur Admins
- Öffentlicher Feed unverändert: nur `published`

**Neue/Geänderte Dateien**
- `src/services/events.ts` — `createUserSubmissionEvent`, `fetchUserSubmissionEvents`, `updateReviewEvent`
- `src/hooks/useEventStore.tsx` — unified Lifecycle-Actions auf Event-Rows
- `app/admin/review/edit/[id].tsx` — Edit-before-Publish UI

---

## 7. Sprint 2.3 — Source Manager & Import Foundation

**Ziel:** Event-Quellen verwalten + URL/Text-Import-Workflow (Mock, kein echtes Scraping).

### Was gemacht wurde

**Event Sources Tabelle**
- Migration: `supabase/migrations/002_event_sources.sql`
- 11 Source-Typen: Club Website, Festival Website, Ticketmaster, Eventim, Eventbrite, Shotgun, Resident Advisor, Instagram, CSV, Text Paste, Flyer Upload

**Admin Source Manager** (`/admin/sources`)
- Liste, Hinzufügen, Bearbeiten, Deaktivieren/Aktivieren
- Mock-Import-Trigger pro Quelle
- Drafts-Ansicht pro Quelle

**URL / Text Importer** (`/admin/import`)
- URL-Tab: Mock-Parsing → Preview
- Text-Tab: Text einfügen → Analyse (später Sprint 2.5: echter Parser)
- Erstellt `import_sources` + `events`-Draft-Rows
- Preview unter `/admin/import/preview/[id]` mit Edit, Send to Review, Approve, Publish, Reject, Duplicate

**Neu in Sprint 2.3**
- `analyzeTextImport()`, `analyzeImportInput()` — URL vs. Text Auto-Detect
- `sendImportToReview()` — Lifecycle → `needs_review`
- Duplicate-aware Lifecycle: Warnung → `needs_review`, sonst `imported_draft`
- Status-Badges auf Import-Preview-Card
- Optional Seed: `supabase/seed_event_sources.sql`

**Admin-Workflow**
1. Source Manager → Quellen konfigurieren → Mock Import
2. URL Importer → URL oder Text einfügen → Analyze → Preview
3. Edit → Send to Review / Approve / Publish / Reject / Mark Duplicate

---

## 8. Sprint 2.4 — Published Events Feed (merged)

**Ziel:** Öffentlichen Feed an Supabase published Events anbinden (Home, Events, Map, Saved, Detail).

**Status:** Bereits in `main` gemerged (PR #9).

### Was gemacht wurde

**Feed Engine (`useEventStore`)**
- `refreshPublicFeed()` — dedizierter Fetch nur für published Events
- `publishedEvents` — bevorzugt Supabase; Fallback auf Dummy bei leerem Backend
- States: `feedLoading`, `feedLoaded`, `feedRefreshing`, `feedError`, `usingDummyFallback`
- Session-published Events werden mit Remote-Feed gemerged

**API**
- `fetchPublishedEventById` — Detail-View lädt nur published Events

**Neue Hook & Komponenten**
- `usePublicEventFeed` — unified API für öffentliche Screens
- `PublishedFeedStatus` — Live-Count, Demo-Modus, Fallback-Banner, Error + Retry
- `EventDetailSkeleton` — Loading-Placeholder

**Screens mit Loading/Error/Empty/Refresh**
| Screen | Loading | Error | Empty | Refresh |
|--------|---------|-------|-------|---------|
| Home | Skeleton Cards | Banner + Retry | EmptyState | Pull-to-Refresh |
| Events/Search | Skeleton Cards | Banner + Retry | Filter vs. Feed Empty | Pull-to-Refresh |
| Map | Skeleton | Banner + Retry | EmptyState | Pull-to-Refresh |
| Saved | Skeleton | Banner + Retry | EmptyState | Pull-to-Refresh |
| Event Detail | Full Skeleton | Retry + Go Back | Not Found | — |

Similar Events auf Detail leiten sich vom Live-Feed ab, nicht nur aus Dummy-Daten.

---

## 9. Sprint 2.4 — Duplicate Detection Foundation

**Ziel:** Mögliche Duplikate erkennen, bevor Events veröffentlicht werden. Admins sehen Warnungen mit Match-Event und Confidence Score.

**Status:** PR [#16](https://github.com/Broosskyy/Eternal-Rave/pull/16) · Branch `cursor/sprint-2-4-duplicate-detection-a932`

### Was gemacht wurde

**Utility** (`src/utils/duplicateDetection.ts`)
- `detectPossibleDuplicate(newEvent, existingEvents)` vergleicht:
  - Titel (Fuzzy), Datum, Stadt, Venue, Organizer, Ticket-URL, Source-URL
- Rückgabe: `confidence`, `isPossibleDuplicate`, `matchedEvent`, `matchReasons`, `warning`
- Sprint-Format: `toDuplicateDetectionResult()` → `duplicate_score`, `possible_duplicate`, `matched_event`, `reasons`
- `duplicateStorageFromResult()` für DB-Persistenz

**Integration**
| Flow | Verhalten |
|------|-----------|
| Add Event | Live-Warnbanner; bei Submit → DB-Felder gesetzt |
| Organizer Create | Warnung im Preview; Metadaten persistiert |
| URL/Text Import | Auto-Check → `needs_review` bei Match |
| Admin Review | Banner mit Match-Event, Score %, Gründen |

**Admin-Aktionen bei Duplikat-Warnung**
- **Publish anyway** — trotz Match veröffentlichen
- **Mark duplicate** — setzt `duplicate_of_event_id` + Lifecycle `duplicate`
- **Merge (soon)** — Placeholder (disabled)

**Persistenz**
- `events.duplicate_of_event_id`
- `events.confidence_score` (Duplicate-Match-Score)
- `events.duplicate_warning` (Migration `004_duplicate_warning_events.sql`)
- `import_sources.duplicate_warning` (bestehend)

**Wichtige Dateien**
- `src/utils/duplicateDetection.ts`
- `src/hooks/useDuplicateCheck.ts`
- `src/components/DuplicateWarningBanner.tsx`
- `src/services/events.ts` → `resolveDuplicateForInput()`

**Prinzip:** Nie auto-publish bei Duplikat-Match — immer Admin-Entscheidung.

---

## 10. Sprint 2.5 — Text Import Parser Light

**Ziel:** Erster **echter** (regelbasierter) Parser für eingefügte Event-Texte — ohne Web-Scraping.

### Was gemacht wurde

**Text-Parser** (`src/utils/parseEventText.ts`)
Extrahiert aus plain pasted text:
- Titel, Datum (ISO, DD.MM.YYYY, DD/MM/YYYY)
- Start-/Endzeit (inkl. Ranges wie 23:00-08:00)
- Stadt & Land (europäisches Stadt-Wörterbuch)
- Venue (bekannte Venues, &-Patterns, Labels)
- Genres (Techno, House, Hard Techno, DnB, etc.)
- Line-up (kommagetrennte Artists, labeled blocks)
- Preis (15€, Tickets ab 15€, from 20 EUR)
- Ticket-URL

**Confidence Score:** 0–98% basierend auf Anzahl erfolgreich gematchter Felder.

**Akzeptanz-Beispiel**
```
VOID Hamburg, 24.05.2026, 23:00, Uebel & Gefährlich, Techno, Tickets ab 15€
```
→ Titel: VOID · Stadt: Hamburg · Datum: 2026-05-24 · Zeit: 23:00 · Venue: Uebel & Gefährlich · Genre: Techno · Preis: 15€ (~92% Confidence)

**Workflow**
1. Admin → URL Importer → Tab „Text paste“ → Analyze
2. Preview: geparste Felder + Confidence + Duplicate-Warning
3. „Edit parsed fields“ → Anpassungen
4. Speichern als `imported_draft` → Send to Review / Approve / Publish

**Bugfixes während Entwicklung**
- Time-Regex matchte fälschlich Datumsteile (`05.20` aus `24.05.2026`) — Fix: `\b([01]?\d|2[0-3]):([0-5]\d)\b`
- Multiline Venue/Titel-Reihenfolge in `parseMultiline` korrigiert
- `ticketPrice` auf `ImportedEventDraft` + Edit-Screen + Preview

**Constraints eingehalten**
- Kein Scraping geschützter Websites
- Kein Login-Bypass
- Nur Admin-eingefügter Plain-Text

---

## 11. Architektur & Datenmodell

### App-Struktur

```
app/
  (tabs)/          Home, Events, Map, Saved, Profile
  add-event.tsx    User Event Submission
  event/[id].tsx   Event Detail
  my-submissions.tsx
  login.tsx, register.tsx
  admin/           Dashboard, Review, Import, Sources
  organizer/       Organizer-Flows

src/
  hooks/           useAuth, useEventStore, usePublicEventFeed, useEventSources
  services/        Supabase API Layer
  lib/supabase/    Client & Env
  utils/           parseEventText, eventMappers, format
  types/           database.ts, lifecycle.ts
  components/      UI-Komponenten

supabase/
  migrations/      001, 002, 003
  seed_*.sql       Published Events, Event Sources
```

### Provider-Reihenfolge (`app/_layout.tsx`)

```
AuthProvider → EventStoreProvider → EventSourceProvider → FavoritesProvider
```

### Event Lifecycle

```
                    ┌─────────────────┐
User Submission ──► │ pending_review  │
Import (clean)   ──► │ imported_draft  │
Import (dup warn)──► │ needs_review    │
                    └────────┬────────┘
                             │ Admin: Approve
                             ▼
                    ┌─────────────────┐
                    │    approved     │
                    └────────┬────────┘
                             │ Admin: Publish live
                             ▼
                    ┌─────────────────┐
                    │   published     │ ◄── Nur diese im öffentlichen Feed
                    └─────────────────┘

Alternativ: rejected · duplicate
```

### Hybrid-Modus

| Zustand | Verhalten |
|---------|-----------|
| Keine Supabase-Env | Demo-Modus mit Mock-Daten |
| Supabase konfiguriert, 0 published | Demo-Fallback + Banner |
| Supabase + published Events | Live-Feed aus DB |
| User eingeloggt | Favoriten-Sync (wenn konfiguriert) |

---

## 12. Pull Requests & Branch-Status

### Offene Draft-PRs (noch nicht in main)

| PR | Titel | Branch |
|----|-------|--------|
| #10 | Sprint 1.4: Final UI/Flow Polish | `cursor/sprint-1-4-ui-polish-a932` |
| #11 | Sprint 2.0: Supabase backend foundation | `cursor/sprint-2-0-supabase-foundation-a932` |
| #12 | Sprint 2.1: Seed events and published feed | `cursor/sprint-2-1-seed-events-a932` |
| #13 | Sprint 2.2: Real event submission and admin review | `cursor/sprint-2-2-submission-review-a932` |
| #14 | Sprint 2.3: Source Manager and import foundation | `cursor/sprint-2-3-source-manager-a932` |
| #15 | Sprint 2.5: Light rules-based text import parser | `cursor/sprint-2-5-text-parser-a932` |
| #16 | Sprint 2.4: Duplicate detection foundation | `cursor/sprint-2-4-duplicate-detection-a932` |

### Bereits gemerged

| PR | Titel |
|----|-------|
| #9 | Sprint 2.4: Real Published Events Feed |
| #8 | Sprint 1.3: Navigation, Transitions & App Flow |
| #7 | Sprint 2.3: Duplicate Detection Foundation |
| #6 | Sprint 2.2: URL Importer mock workflow |
| #5 | Sprint 2.1: Event Source Manager |
| #4 | Sprint 2: Supabase backend foundation (frühe Version) |
| #3 | Sprint 1.2: Premium UX & admin workflow |
| #2 | Sprint 1.1: MVP polish |
| #1 | Eternal Rave MVP scaffold |

### Aktueller APK-Stand

- README verweist auf **v1.3.0 APK** (~105 MB)
- `app.json` zeigt bereits **Version 1.4.0** (versionCode 4) — neuer Build steht noch aus

---

## 13. Setup-Anleitung (Supabase)

### Schritt 1: Supabase-Projekt anlegen

1. Projekt auf https://supabase.com erstellen
2. URL + Anon Key aus Project Settings kopieren

### Schritt 2: Migrationen ausführen (Reihenfolge!)

Im Supabase SQL Editor nacheinander:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_event_sources.sql`
3. `supabase/migrations/003_user_submission_rls.sql`
4. `supabase/migrations/004_duplicate_warning_events.sql` (Sprint 2.4 — Duplicate Warnings)

### Schritt 3: Seed-Daten (optional, empfohlen)

1. `supabase/seed_published_events.sql` — 30 Live-Events
2. `supabase/seed_event_sources.sql` — Beispiel-Import-Quellen

### Schritt 4: App konfigurieren

```bash
cp .env.example .env
# EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY eintragen
npm install
npm start
```

Expo nach Env-Änderung neu starten.

### Schritt 5: Admin-User anlegen

1. In der App unter `/register` registrieren
2. In Supabase SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'deine@email.com';
```

Für Organizer-Zugang:

```sql
UPDATE public.profiles SET role = 'organizer' WHERE email = 'deine@email.com';
```

### Schritt 6: Verifizieren

- Home/Events: Pull-to-Refresh → 30 Seed-Events sichtbar
- Add Event → Einreichung → My Submissions zeigt Pending
- Admin → Review Events → Approve → Publish → Event im Feed
- Admin → Import → Text paste → VOID-Beispiel parsen → Preview

---

## 14. Was noch nicht implementiert ist

| Bereich | Status |
|---------|--------|
| Echtes Web-Scraping / URL-Fetching | ❌ Nur Mock |
| Flyer OCR / Bild-Erkennung | ❌ |
| Automatischer Cron-Import aus Sources | ❌ |
| Echte Karte (Mapbox) | ❌ Placeholder |
| Push-Benachrichtigungen | ❌ |
| Bild-Upload zu Supabase Storage | ❌ |
| Play Store Release | ❌ |
| iOS Build | ❌ |
| Vollständige Favoriten-Sync-Tests in Prod | ⚠️ Code vorhanden |
| Duplicate Detection (heuristisch) | ✅ Sprint 2.4 — Auto-Scan + Admin-Warnung; Merge-UI fehlt noch |

---

## 15. Nächste Schritte — Empfohlener Plan

### Phase A — Integration & Release (kurzfristig)

1. **PRs mergen** in Reihenfolge: #10 → #11 → #12 → #13 → #14 → #15
2. **Supabase Production** — Migrationen + Seeds ausführen
3. **Admin-Account** anlegen und End-to-End testen:
   - User Submission → Review → Publish
   - Text Import → Edit → Publish
   - Source Manager Mock Import
4. **Neuen APK bauen** (v1.4.0) und als GitHub Release hochladen
5. **README** mit neuem APK-Link aktualisieren

### Phase B — Sprint 2.6+ (mittelfristig)

| Sprint | Inhalt | Priorität |
|--------|--------|-----------|
| **2.6** | Echtes URL-Fetching für öffentliche Seiten (robots.txt-konform, Rate-Limits) | Hoch |
| **2.7** | Duplicate Detection ausbauen (Titel+Datum+Venue Fuzzy Match) | Hoch |
| **2.8** | Supabase Storage für Flyer-Uploads | Mittel |
| **2.9** | Cron/Edge Function: Auto-Import aus aktiven `event_sources` | Mittel |
| **3.0** | Mapbox Integration (echte Karte mit Event-Pins) | Mittel |
| **3.1** | Push Notifications (Expo Notifications + Supabase) | Niedrig |
| **3.2** | Organizer Self-Service (eigene Events verwalten ohne Admin) | Mittel |
| **3.3** | Play Store Vorbereitung (Privacy Policy, Store Listing) | Hoch (für Launch) |

### Phase C — Qualität & Skalierung

- E2E-Tests mit Detox oder Maestro
- Error Monitoring (Sentry)
- Analytics (PostHog / Amplitude)
- Performance: Feed-Pagination statt Full-Load
- i18n (DE/EN)

### Empfohlene Test-Checkliste vor Release

- [ ] App startet ohne `.env` (Demo-Modus)
- [ ] App startet mit `.env` (Live-Modus)
- [ ] 30 Seed-Events im Feed nach Pull-to-Refresh
- [ ] Event-Detail mit Ticket-Link
- [ ] User Registration + Login
- [ ] Add Event → Pending in My Submissions
- [ ] Admin Review → Approve → Publish → im Feed sichtbar
- [ ] Admin Text Import (VOID-Beispiel) → Preview → Publish
- [ ] Rejected/Duplicate Events **nicht** im Feed
- [ ] Favoriten setzen/entfernen
- [ ] `npm run typecheck` ohne Fehler

---

## 16. Qualitätssicherung & Verifikation

| Check | Ergebnis |
|-------|----------|
| `npm run typecheck` | ✅ Bestanden (Stand: Sprint 2.4 Duplicate Detection) |
| Duplicate warnings in Admin Review | ✅ Publish anyway / Mark duplicate |
| App ohne Supabase-Env | ✅ Demo-Fallback funktioniert |
| App mit Supabase + Seeds | ✅ Live-Feed (nach Setup) |
| Kein Web-Scraping | ✅ By Design |
| RLS Policies | ✅ User/Admin getrennt |
| Public Feed Safety | ✅ Nur `published` |

---

## 17. Anhang — Wichtige Dateipfade

### Konfiguration
- `.env.example` — Supabase Env-Vorlage
- `app.json` — App-Version 1.4.0
- `supabase/README.md` — Backend-Setup-Doku
- `docs/PRODUCT-VISION.md` — Kanonische Product Vision & Design Spec
- `docs/MOCKUP-ALIGNMENT.md` — Ist-vs-Soll Mapping

### Migrationen
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_event_sources.sql`
- `supabase/migrations/003_user_submission_rls.sql`
- `supabase/migrations/004_duplicate_warning_events.sql`

### Seeds
- `supabase/seed_published_events.sql`
- `supabase/seed_event_sources.sql`
- `scripts/generate-seed-events.js`

### Core Services
- `src/services/authService.ts`
- `src/services/eventService.ts`
- `src/services/events.ts`
- `src/services/adminService.ts`
- `src/services/imports.ts`
- `src/services/eventSources.ts`

### Hooks
- `src/hooks/useAuth.tsx`
- `src/hooks/useEventStore.tsx`
- `src/hooks/usePublicEventFeed.ts`
- `src/hooks/useEventSources.tsx`

### Parser
- `src/utils/parseEventText.ts`

### Duplicate Detection
- `src/utils/duplicateDetection.ts`
- `src/hooks/useDuplicateCheck.ts`
- `src/components/DuplicateWarningBanner.tsx`

### Admin Screens
- `app/admin.tsx`
- `app/admin/review-events.tsx`
- `app/admin/review/edit/[id].tsx`
- `app/admin/import.tsx`
- `app/admin/import/preview/[id].tsx`
- `app/admin/import/edit/[id].tsx`
- `app/admin/sources/index.tsx`

### User Screens
- `app/add-event.tsx`
- `app/my-submissions.tsx`

---

## Schlusswort

Die Eternal-Rave-App hat eine solide **Backend-Foundation** mit Admin-Workflows, Seed-Daten, Text-Parser und Duplicate Detection erhalten. Referenzdokumente (`PRODUCT-VISION.md`, `MOCKUP-ALIGNMENT.md`) sichern die langfristige Ausrichtung.

**Nächster kritischer Schritt:** PRs reviewen und mergen (#10–#16), Supabase Production deployen (Migration 004!), End-to-End testen, APK v1.4.0 bauen.

---

*Erstellt automatisch als Projekt-Dokumentation — Eternal Rave Development Team, Juni 2026.*
