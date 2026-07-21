# Eternal Rave — Backlog

Zentrale Aufgabenliste für die Entwicklung von Eternal Rave.

**Regel:** Dieses Backlog ist die einzige Quelle für Entwicklungsaufgaben. Neue Aufgaben werden ausschließlich hier ergänzt.

**Stand:** 21. Juli 2026

---

# 🔴 Kritisch

Aufgaben, ohne die die Plattform nicht sinnvoll weiterentwickelt werden kann.

## ER-001
Titel: Gemeinsamer Login

Status:
- In Progress (Auth-Routen, Profil-UI und Create-Hub-Einstieg umgesetzt; Admin-Umstellung siehe ER-003)

Priorität: Kritisch

Beschreibung:
Einen zentralen Login für alle Benutzer einführen (Consumer und Admin). Aktuell existiert nur `/admin/login`; die öffentliche App hat keinen Login. Session und Auth-State sollen app-weit verfügbar sein; Admin-Zugriff wird über Rollen gesteuert, nicht über einen separaten Login-Flow.

Abhängigkeiten:
- Keine

Betroffene Module:
- `app-v2/app/_layout.tsx`
- `app-v2/app/admin/_layout.tsx`
- `app-v2/app/admin/login.tsx`
- `app-v2/src/services/supabase/auth-service.ts`
- `app-v2/src/features/admin/AdminAuthContext.tsx`

Definition of Done:
- Gemeinsame Login-Route für alle Benutzer vorhanden
- Session wird global bereitgestellt und bei App-Start wiederhergestellt
- Bestehende Admin-Routen unter `/admin` bleiben erreichbar
- Lokaler Mock-Modus (`EXPO_PUBLIC_USE_SUPABASE=false`) weiterhin funktionsfähig
- `docs/PROJECT_STATE.md` und relevante Auth-Dokumentation aktualisiert

---

## ER-002
Titel: Rollenmodell

Status:
- Todo

Priorität: Kritisch

Beschreibung:
Das Rollenmodell für Admin-Zugriff konsolidieren und dokumentieren. Rollen (`viewer`, `editor`, `reviewer`, `source_manager`, `admin`, `owner`) sind in App-Code und DB (`is_admin()`, JWT `app_metadata.role`) definiert; ein einheitlicher Login erfordert klare Zuordnung: welche Rolle sieht was, und wie werden Rollen in Supabase Auth gesetzt.

Abhängigkeiten:
- ER-001

Betroffene Module:
- `app-v2/src/features/import/admin/admin-roles.ts`
- `app-v2/src/features/admin/admin-permissions.ts`
- `app-v2/supabase/migrations/` (RLS-Hilfsfunktionen: `is_admin()`, `admin_role()`, `has_admin_role()`)
- `app-v2/docs/admin-web.md`

Definition of Done:
- Rollenmatrix (Rolle → Berechtigungen → Routen) dokumentiert und mit Code abgeglichen
- JWT `app_metadata.role` als einzige Rollenquelle bestätigt oder bewusst erweitert
- RLS-Policies und App-Permissions konsistent
- Keine neue Rollen-Tabelle ohne dokumentierte Begründung

---

## ER-003
Titel: Admin Auth umstellen

Status:
- Todo

Priorität: Kritisch

Beschreibung:
`AdminAuthProvider` und Admin-Guards auf den gemeinsamen Login umstellen. Separater Admin-Login (`/admin/login`) wird durch Redirect oder gemeinsame Login-Route ersetzt; `AdminAuthProvider` nutzt die globale Session statt einer isolierten Admin-Session.

Abhängigkeiten:
- ER-001
- ER-002

Betroffene Module:
- `app-v2/src/features/admin/AdminAuthContext.tsx`
- `app-v2/src/features/admin/admin-guard.ts`
- `app-v2/app/admin/login.tsx`
- `app-v2/app/admin/_layout.tsx`
- `app-v2/docs/admin-web.md`

Definition of Done:
- Admin-Bereich nutzt globale Auth-Session
- Unauthentisierte Admin-Zugriffe leiten zum gemeinsamen Login
- Rollenprüfung (`hasAdminAccess`, Route-Permissions) unverändert funktionsfähig
- `/admin` bleibt Web-only
- Bestehende Admin-Tests angepasst und grün

---

# 🟠 Hohe Priorität

Funktionen für Closed Beta.

## ER-004
Titel: Event Publish Workflow

Status:
- Todo

Priorität: Hoch

Beschreibung:
Klaren Workflow von Event-Entwurf bis Veröffentlichung implementieren. Import-Approve erzeugt Events mit Status `draft`; öffentliche App liest nur `published`. Admin-UI und Repository sollen Draft → Review → Published (und ggf. Archiv) abbilden.

Abhängigkeiten:
- ER-003 (empfohlen für Admin-Schreibzugriff)

Betroffene Module:
- `app-v2/app/admin/events/`
- `app-v2/src/data/repositories/repositories.ts`
- `app-v2/src/data/datasources/supabase/`
- `app-v2/src/features/import/admin/import-review-service.ts`
- `app-v2/supabase/migrations/` (RLS: `anon_read_published_events`)

Definition of Done:
- Admin kann Event-Status gezielt setzen (`draft`, `review`, `published`, `archived`)
- Nur `published` Events sind für `anon` lesbar (RLS unverändert korrekt)
- Import-Approve-Flow dokumentiert (Draft vs. Publish)
- Tests für Statusübergänge vorhanden

---

## ER-005
Titel: Import Scheduler

Status:
- Todo

Priorität: Hoch

Beschreibung:
Geplante und Webhook-getriggerte Imports umsetzen. Datenmodell existiert (`trigger_type`: `manual`, `scheduled`, `webhook`; `sources.next_scheduled_at`), Laufzeit-Scheduler fehlt im Repository. Manuelle Imports über `ImportOperationsService` bleiben Basis.

Abhängigkeiten:
- ER-003 (Admin-Berechtigungen für Import-Start)

Betroffene Module:
- `app-v2/src/features/import/admin/import-operations-service.ts`
- `app-v2/src/features/import/services/import-orchestrator.ts`
- `app-v2/src/features/import/models/statuses.ts`
- `app-v2/app/admin/imports/`
- `app-v2/docs/import-runbook.md`

Definition of Done:
- `scheduled`-Imports werden zu konfigurierbaren Zeiten ausgeführt
- `webhook`-Trigger kann einen Import-Job anstoßen
- `next_scheduled_at` auf `sources` wird nach Lauf aktualisiert
- Bestehende manuelle Imports unverändert funktionsfähig
- Runbook und `PROJECT_STATE.md` aktualisiert

---

## ER-009
Titel: Website Events

Status:
- Todo

Priorität: Hoch

Beschreibung:
Öffentliche Web-Oberfläche mit echten Events aus Supabase (oder Repository) statt ausschließlich lokaler Pipeline. Web-Export und Home/Search/Saved sollen publizierte Events aus der Cloud laden, wenn `EXPO_PUBLIC_USE_SUPABASE=true`.

Abhängigkeiten:
- ER-004 (publizierte Events in DB)
- Remote-Staging-Seed angewendet (Referenzdaten)

Betroffene Module:
- `app-v2/app/(tabs)/`
- `app-v2/src/features/events/`
- `app-v2/src/data/repositories/`
- `app-v2/src/core/config/feature-flags.ts`
- `app-v2/scripts/staging/seed-staging-app-data.sql`

Definition of Done:
- Web-Build zeigt publizierte Events aus Supabase bei aktivem Feature-Flag
- Home, Search und Event-Detail nutzen Repository-Layer (kein direkter Supabase-Zugriff in UI)
- Leerer Zustand und Fehlerzustände implementiert
- Staging-Seed dokumentiert und anwendbar

---

## ER-010
Titel: Website SEO

Status:
- Todo

Priorität: Hoch

Beschreibung:
SEO für den öffentlichen Web-Export absichern und mit echten Event-Inhalten verbinden. Basis existiert (`robots.txt`, `sitemap`, Schema.org, `generate-seo-files.ts`); Event-Routen und Metadaten sollen für Beta-taugliche Indexierung vorbereitet sein.

Abhängigkeiten:
- ER-009

Betroffene Module:
- `app-v2/scripts/generate-seo-files.ts`
- `app-v2/scripts/validate-seo.ts`
- `app-v2/src/platform/pwa/`
- `app-v2/app/event/[id].tsx`
- `app-v2/docs/seo.md`

Definition of Done:
- `npm run validate:seo` bestanden nach Event-Integration
- Event-Detailseiten haben sinnvolle Titel und Meta-Beschreibungen
- Sitemap enthält publizierte Event-URLs
- `docs/seo.md` und Launch-Checkliste abgeglichen

---

# 🟡 Mittlere Priorität

Verbesserungen nach der Closed Beta.

## ER-006
Titel: Admin Moderation & Contributor Publishing

Status:
- Done

Priorität: Hoch

Beschreibung:
Contributor-Events in `review` durch Admin moderieren und veröffentlichen (`review` → `published` / `rejected`). Schließt den Event-Einreichungs-Loop vor Go-Live. Ersetzt/ergänzt den früheren CMS-Fokus als nächster strategischer Schritt (siehe `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` §8).

Abhängigkeiten:
- ER-005.4 (Platform Foundation)
- ER-004 (Contributor Submission)

Betroffene Module:
- `app-v2/app/admin/events/`
- `src/features/admin/`
- `src/data/repositories/`

Definition of Done:
- Admin sieht Contributor-Events in `review`
- Publish und Reject mit klarer Statusmaschine
- Keine parallele Event-API
- Tests und Dokumentation aktualisiert

Hinweis: CMS-Erweiterungen (Bulk, erweiterter Bild-Upload) können als ER-006.1 folgen.

---

## ER-006-legacy
Titel: CMS Events (Bulk & Upload-Erweiterungen)

Status:
- Todo (nach ER-006)

Priorität: Mittel

Beschreibung:
Admin-CRUD für Events erweitern zu einem vollständigen CMS-Erlebnis (Listen, Filter, Bulk-Aktionen, Bild-Upload). Basis existiert unter `/admin/events`.

Abhängigkeiten:
- ER-003
- ER-004

Betroffene Module:
- `app-v2/app/admin/events/`
- `app-v2/src/data/repositories/repositories.ts`
- `app-v2/supabase/migrations/` (Storage: `events`-Bucket)

Definition of Done:
- Vollständiger Event-Lebenszyklus im Admin-UI bedienbar
- Bild-Upload in Supabase Storage (`admin_upload_event_images`-Policy)
- Keine parallele Event-API neben bestehenden Repositories

---

## ER-007
Titel: Artist Domain Foundation

Status:
- Done

Priorität: Mittel

Beschreibung:
Artists als kanonische, wiederverwendbare Plattform-Entitäten mit Admin-CMS, Service-Layer, erweitertem Datenmodell und rollenbasierter RLS. Keine Event-Lineup-Migration in diesem Epic.

Abhängigkeiten:
- ER-006 (Platform Hardening)

Betroffene Module:
- `app-v2/app/admin/artists/`
- `app-v2/src/features/artists/`
- `app-v2/src/data/repositories/`, `datasources/`, `mappers/`
- `app-v2/supabase/migrations/20260733000000_er007_artist_domain_foundation.sql`

Definition of Done:
- Admin Artist CRUD (`/admin/artists`, `/admin/artists/[id]`)
- `ArtistService` + `AdminArtistRepository` + public `ArtistRepository`
- Lifecycle (`draft`/`published`/`archived`) und Verification getrennt
- RLS: öffentlich nur `published`; Schreiben rollenbasiert
- Tests und `docs/ER-007_ARTIST_DOMAIN_FOUNDATION_COMPLETION_REPORT.md`

Nächster Fokus: **ER-009 Venue Admin CMS** (renumbered; lineup delivered in ER-008)

---

## ER-008
Titel: Multi-Artist Lineup Foundation

Status:
- Done

Priorität: Mittel

Beschreibung:
Kanonical ordered many-to-many Event↔Artist-Beziehung über `event_artists`, Admin-Lineup-Editor, Import-Mehrfachzuordnung, RLS, Backfill aus `events.artist_id`, Legacy-Sync der deprecated `artist_id`.

Abhängigkeiten:
- ER-007 (Artist Domain Foundation)

Betroffene Module:
- `app-v2/supabase/migrations/20260734000000_er008_multi_artist_lineup_foundation.sql`
- `app-v2/src/features/events/domain/event-lineup*.ts`
- `app-v2/src/features/events/services/event-lineup-service.ts`
- `app-v2/src/data/datasources/*/local-event-lineup-datasource.ts`, `supabase-event-lineup-datasource.ts`
- `app-v2/app/admin/events/[id].tsx`, `EventLineupEditor.tsx`
- `app-v2/src/features/import/admin/import-review-service.ts`

Definition of Done:
- `event_artists` junction mit Billing-Rollen und sort_order
- Backfill + RLS + Contributor-Review-Schutz
- Admin Lineup Editor (multi-select, reorder, roles)
- Import approve persistiert alle `matchedArtistIds`
- `events.artist_id` als deprecated compatibility field synchronisiert
- Tests und `docs/ER-008_MULTI_ARTIST_LINEUP_FOUNDATION_COMPLETION_REPORT.md`

---

## ER-009
Titel: Venue Admin CMS

Status:
- Done

Priorität: Mittel

Beschreibung:
Kanonical Venue-Domain mit erweitertem Datenmodell, Admin-CMS, Service-Layer, Event-Editor-Venue-Picker, Import-Review-Anreicherung, RLS (öffentlich nur über published Events), Duplicate-Detection und Delete-Schutz.

Abhängigkeiten:
- ER-008 (Multi-Artist Lineup Foundation)

Betroffene Module:
- `app-v2/supabase/migrations/20260735000000_er009_venue_admin_foundation.sql`
- `app-v2/src/features/venues/`
- `app-v2/app/admin/venues/`
- `app-v2/src/features/admin/components/VenuePicker.tsx`
- `app-v2/app/admin/events/[id].tsx`

Definition of Done:
- Extended `venues` schema + slug + backfill
- `VenueService` + `AdminVenueRepository`
- Admin Venue CRUD (`/admin/venues`, `/admin/venues/[id]`)
- Event editor canonical venue picker
- Import review venue resolution display
- Tests und `docs/ER-009_VENUE_ADMIN_CMS_COMPLETION_REPORT.md`

Nächster Fokus: **ER-010** (siehe Architektur-Roadmap / Produkt-Backlog)

---

## ER-010
Titel: CMS Venues (superseded — delivered in ER-009)

Status:
- Cancelled / superseded by ER-009

Priorität: Mittel

Beschreibung:
Admin-Oberfläche und Repositories für Venue-Verwaltung (`venues`-Tabelle, Verknüpfung mit `cities`). Analog zu Artists fehlen dedizierte Admin-Screens.

Abhängigkeiten:
- ER-003

Betroffene Module:
- `app-v2/app/admin/` (neue Routen)
- `app-v2/src/data/repositories/`
- `app-v2/src/data/datasources/supabase/`

Definition of Done:
- CRUD für Venues im Admin-Bereich
- `city_id`-Verknüpfung validiert
- Repository-Pattern konsistent mit bestehender Architektur

---

# 🟢 Niedrige Priorität

Nice-to-have Features.

## ER-012
Titel: Event Submission Flow (Consumer)

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Vollständiger Consumer-Workflow: Event als Entwurf anlegen, bearbeiten, Bilder hochladen, Vorschau und zur Moderation einreichen (`draft` → `review`). Kein Admin-Moderations-UI in diesem Ticket.

Abhängigkeiten:
- ER-001 (Auth)
- ER-011 (i18n)

Betroffene Module:
- `app-v2/app/create/event.tsx`, `app-v2/app/event/[id]/edit.tsx`, `app-v2/app/event/[id]/preview.tsx`
- `app-v2/src/features/create/` (Form, Preview, Upload, Services)
- `app-v2/supabase/migrations/20260727000000_contributor_event_drafts.sql`
- `app-v2/supabase/migrations/20260728000000_contributor_event_submission.sql`

Definition of Done:
- Create Hub → Event-Formular (kein Platzhalter)
- Draft speichern/bearbeiten mit gemeinsamer Formular-Komponente
- Cover + Flyer Upload mit Validierung
- Vorschau vor Einreichung
- Submit setzt Status `review`; Event bleibt nicht öffentlich
- Tests (270+) und Dokumentation aktualisiert

---

## ER-013
Titel: Meine Events & Pre-Publish-Härtung

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Consumer-Bereich „Meine Events“ im Profil; Social Links und Venue-Modell vor Admin-Moderation härten; kontrollierter Rückzug `review` → `draft`.

Abhängigkeiten:
- ER-012 (Event Submission Flow)

Betroffene Module:
- `app-v2/app/profile/events.tsx`
- `app-v2/src/features/my-events/`
- `app-v2/src/features/create/` (Service, Mapper, Preview)
- `app-v2/supabase/migrations/20260730000000_contributor_my_events.sql`

Definition of Done:
- Profil-Einstieg „Meine Events“ mit Auth-Gate und `returnTo`
- Liste/Karten mit Statusfilter und statusabhängigen Aktionen
- `ContributorEventService.getMyEvents`, `withdrawFromReview`
- Social Links in `website_url` / `instagram_url` / `facebook_url` (nicht in `description`)
- Venue über `venue_id` oder `venue_name`/`venue_city` (nicht in `subtitle`)
- RLS für Owner-Read und Withdraw
- Tests grün; Dokumentation aktualisiert

---

## ER-005.1
Titel: Auth UX & Consumer Polish

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Gezielte Qualitätsverbesserungen für Login, Registrierung und RN-Web-HTML-Struktur ohne Architekturänderungen.

Abhängigkeiten:
- ER-013 (Meine Events)

Betroffene Module:
- `app/login.tsx`, `app/register.tsx`
- `src/features/i18n/auth-errors.ts`
- `src/features/auth/components/RegistrationSuccessView.tsx`
- `src/components/cards/InteractiveCard.tsx`
- `app-v2/docs/auth-email-confirmation.md`, `auth-username-plan.md`

Definition of Done:
- Supabase Auth-Fehler über `error.code` gemappt (`email_not_confirmed`, `invalid_credentials`, Rate-Limit, Netzwerk)
- Registrierungs-Erfolgsansicht bei E-Mail-Bestätigung
- Keine verschachtelten Buttons in Event-Karten (Web)
- Tests und Dokumentation aktualisiert

---

## ER-005.2
Titel: Home Header, Standort und Auth-abhängige Aktionen

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Home-Header bereinigen: dynamischer Standort mit Nutzeraktivierung, Activity-Button nur für eingeloggte Nutzer, Home-Filterbutton entfernen.

Abhängigkeiten:
- ER-005.1 (Auth UX)

Betroffene Module:
- `app/(tabs)/index.tsx`
- `src/features/home/components/` (HomeHeader, LocationSelector)
- `src/features/location/` (Provider, Service, Storage, Modal)
- `app.config.ts` (expo-location Plugin)
- `app/_layout.tsx` (UserLocationProvider)

Definition of Done:
- Kein statischer „Köln, Germany“-Standort im Home-Header
- Standort nur nach Nutzeraktion; lokal in AsyncStorage persistiert
- Activity-Button nur bei authentifizierter Session sichtbar
- Home-Filterbutton vollständig entfernt
- i18n (de/en), Tests grün, Dokumentation aktualisiert
- Keine Remote-Supabase-Änderungen, keine Event-Filterung nach Standort

---

## ER-005.3
Titel: Auth Callback, Deep Linking & E-Mail-Bestätigung abschließen

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Auth-Flow von Registrierung bis Login abschließen: Callback-Route, Web-Session aus URL, Native Deep Links, Resend, Passwort-Reset.

Abhängigkeiten:
- ER-005.2 (Home Header)

Betroffene Module:
- `app/auth/callback.tsx`, `app/forgot-password.tsx`, `app/reset-password.tsx`
- `src/services/supabase/auth-service.ts`, `client.ts`
- `src/features/auth/` (redirect utils, resend hook)
- `app-v2/docs/auth-email-confirmation.md`

Definition of Done:
- `/auth/callback` mit Session-Übernahme und Redirect (returnTo/Home/reset-password)
- `detectSessionInUrl` auf Web
- `emailRedirectTo` bei signUp/resend/reset
- Resend-Bestätigung in UI
- Passwort-Reset ohne Regression
- Tests grün; Dokumentation aktualisiert
- Keine Remote-Supabase-Änderungen im Repo

---

## ER-005.4
Titel: Platform Architecture Foundation

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Vollständiges Architektur-Review gegen Langfristvision; Gaps dokumentieren; sichere strukturelle Vorbereitungen ohne Breaking Migrations.

Abhängigkeiten:
- ER-005.3 (Auth Callback)
- `docs/ARCHITECTURE_ROADMAP.md`

Betroffene Module:
- `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` (neu)
- `src/features/events/domain/` (Planning types)
- `src/data/mappers/event-mapper.ts` (Venue-Vorschlag Consumer-Pfad)
- `docs/PROJECT_STATE.md`, `AI_CONTEXT.md`, `BACKLOG.md`

Definition of Done:
- Repository-, Schema- und Service-Review dokumentiert
- Event-, Venue-, Ticketing-, Organizer-, Rollen-, Status-Gaps identifiziert
- Migrationsstrategie (additiv) und Future Epics definiert
- Venue-Mapper für `venue_name`/`venue_city` korrigiert
- Domain-Planning-Types ohne DB-Änderung
- Tests grün, keine Regression

---

## ER-005.5
Titel: Core Workflow Reliability & Product Consistency

Status:
- Done (Juli 2026)

Priorität: Hoch

Beschreibung:
Contributor-Event-Erstellung und Standort-Flow zuverlässig und konsistent machen, bevor ER-006 (Platform Operations). Keine neuen Plattform-Features; Fokus auf Persistenz, Fehlerbehandlung, i18n-Basis und UX-Klarheit.

Abhängigkeiten:
- ER-005.4 (Platform Architecture Foundation)

Betroffene Module:
- `src/features/create/` (Contributor Event Form, Success Screen)
- `src/data/datasources/local/` (AsyncStorage-Persistenz)
- `src/features/location/` (GPS, Geocoding, Discovery City)
- `src/features/my-events/`
- `supabase/migrations/20260731000000_contributor_event_image_update.sql`
- `app-v2/docs/ER-005.5_COMPLETION_REPORT.md`

Definition of Done:
- Event-Draft-Persistenz (lokal + Supabase city_id-Auflösung)
- Success-UX mit klaren Aktionen nach Speichern
- Location: Timeouts, Secure Context, manueller Discovery-City-Fallback
- Tests grün (349/349); Completion Report dokumentiert
- ER-005.4-Architektur unverändert

---

# Vor Release / Später ergänzen

| Thema | Status |
|-------|--------|
| Social Links normalisieren | Erledigt (ER-013) |
| Venue-Freitext in `subtitle` ablösen | Erledigt (ER-013) |
| HTML-Button-Verschachtelung (RN Web) | Erledigt (ER-005.1) |
| Auth- und Formular-UX-Polish (Basis) | Erledigt (ER-005.1) |
| Home-Header Standort & Auth-abhängige Aktionen | Erledigt (ER-005.2) |
| Auth Callback & E-Mail-Bestätigung | Erledigt (ER-005.3) |
| Platform Architecture Foundation | Erledigt (ER-005.4) |
| Core Workflow Reliability | Erledigt (ER-005.5) |
| Admin-Moderation & Publishing | Erledigt (ER-006 + Platform Hardening) |
| Autosave | Offen |
| Benutzername / Anzeigename | Offen |
| Kompletter UX-Polish / Microinteractions | Offen |
| Pflegbare Inhalte außerhalb des Codes | Offen |
| E-Mail-Bestätigung Callback / Resend | Erledigt (ER-005.3) |

---

## ER-011
Titel: Internationalisierung (Grundlage)

Status:
- Done (Juli 2026)

Priorität: Niedrig

Beschreibung:
Schlanke i18n-Grundlage für die Consumer-App: Deutsch und Englisch, persistente Sprachpräferenz, zentrale Translation-Keys und Migration der Kern-Screens (Home-Header, Create Hub, Activity, Login, Register, Profil).

Abhängigkeiten:
- Keine

Betroffene Module:
- `app-v2/src/features/i18n/`
- `app-v2/app/_layout.tsx`
- Home-Header, Create, Activity, Login, Register, Profil

Definition of Done:
- i18next + react-i18next + expo-localization eingerichtet
- Fallback `de`, Priorität: gespeichert → Gerät → Fallback
- Sprachumschalter im Profil
- Tests für Locale, Ressourcen, Auth-Fehler, Persistenz
- Dokumentation in `docs/PROJECT_STATE.md` und `AI_CONTEXT.md`

---
