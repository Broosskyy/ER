# Eternal Rave — Release Plan

**Stand:** 20. Juli 2026  
**Basis:** Repository-Analyse (`app-v2/`, `docs/PROJECT_STATE.md`, `BACKLOG.md`)  
**Aktuelle App-Version:** `0.2.0` (`app-v2/package.json`)

Dieses Dokument beschreibt geplante Releases. Nur Features, die im Repository nachweisbar implementiert sind, gelten als im jeweiligen Release **vorhanden**. Geplante, aber noch nicht umgesetzte Funktionen stehen unter „Nicht enthalten“ oder in späteren Releases.

---

# Release 0.1 – Foundation

**Status:** Abgeschlossen (Code im Repository)

**Ziel:** Technisches Fundament und erste Consumer-UI auf Basis lokaler Mock-Daten — ohne Cloud-Backend, ohne Accounts.

**Enthaltene Features:**

- Expo SDK 57 + TypeScript (strict) + Expo Router
- Design-Tokens und Basis-Komponenten (`src/design/`, `src/components/`)
- Tab-Navigation: Home, Search, Saved, Map (Platzhalter), Profile
- Home mit Event-Karten und Collections
- Search mit Filtern und Explore-Feed
- Event-Detail (`/event/[id]`)
- Lokale Favoriten (AsyncStorage, keine Cloud-Sync)
- Event-Pipeline mit lokalem Mock (`EXPO_PUBLIC_USE_SUPABASE=false` als Standard)
- Android-native Projekt, App-Icons, Bundle-ID `com.eternalrave.app`

### Zielgruppe

Internes Team, Design- und UX-Validierung.

### Features (Ist — im Repository)

| Bereich | Inhalt |
|---------|--------|
| UI | Home, Search, Saved, Profile, Event-Detail |
| Daten | Lokale Pipeline / Demo-Events |
| Plattform | Android (Expo), Basis für Web |
| Auth | Keiner |
| Admin | Keiner |
| Backend | Keiner |

### Nicht enthaltene Features

- Supabase-Anbindung
- Admin-Bereich
- Import-Engine
- Consumer-Login
- Echte Karte (Map-Tab zeigt `MapUnavailableState`)
- Push-Benachrichtigungen
- Cloud-Sync für Favoriten

### Voraussetzungen

- Node.js, `npm install` in `app-v2/`
- Keine Supabase-Konfiguration erforderlich

### Abnahmekriterien

- `npm run lint` und `npx tsc --noEmit` ohne Fehler
- App startet auf Android/Web mit Mock-Daten
- Tab-Navigation und Event-Detail erreichbar

### Risiken

- Veraltete Dokumentation (`BUILD_STATUS.md` beschreibt teils noch Sprint-1-Stand)
- Map-Tab bewusst unvollständig

---

# Release 0.2 – Closed Beta

**Status:** In Arbeit — Release Candidate `0.2.0`; **technisch bereit für Closed Beta** nach ER-011 (`npm run release:check` PASS, 449 Tests, 19 Migrationen). Go-Live erfordert noch operative Schritte (Supabase-Env, Seed, Rechtstexte — siehe `app-v2/docs/go-live.md`).

**Ziel:** Geschlossene Beta mit Admin-Web, Supabase-Backend, Import-Pipeline und Multi-Plattform-Builds (Android, Web/PWA, iOS-Vorbereitung). Öffentliche App weiterhin primär mit lokalen Daten, sofern `EXPO_PUBLIC_USE_SUPABASE=false`.

**Enthaltene Features:**

- Repository-Pattern mit Local- und Supabase-Datasources
- 19 Supabase-Migrationen (Schema, Import, RLS, ER-007–011 Domains)
- Admin-Web unter `/admin` (nur Browser)
- Admin-Login (`/admin/login`), JWT-Rollen (`app_metadata.role`)
- Events-CRUD im Admin
- Import: Adapter, Matching, Review, manueller Job-Start
- Web: statischer Export, responsive Layout, PWA-Foundation
- Notification Center (device-lokal, kein Push)
- SEO-Basis (`robots.txt`, Sitemap-Generierung, Schema.org)
- `npm run release:check` — **PASS** (ER-011)
- Vitest-Suite — **449 Tests PASS** (ER-011)
- Staging-Skripte und Seed-SQL (`scripts/staging/`)

### Zielgruppe

Geschlossene Tester-Gruppe (Team, ausgewählte Beta-Nutzer), Admin- und Redaktionspersonal.

### Features (Ist — im Repository)

| Bereich | Inhalt |
|---------|--------|
| **Datenbank** | Tabellen für Events, Referenzdaten, Import, Audit; RLS aktiv; 8 Migrationen |
| **Auth** | Admin-Login via Supabase Auth (oder lokaler Mock); 6 Rollen in App + `is_admin()` |
| **Admin** | Dashboard, Events, Import (Sources, Jobs, Review); Web-only Guard |
| **Website** | Statischer Web-Export, PWA installierbar; Events aus Repository (Mock standardmäßig) |
| **Mobile** | Android Release-Build möglich; iOS-Projekt + EAS-Config vorbereitet |
| **Import** | 6 Adapter, Orchestrator, Matching, Review; Approve → Event als `draft` |
| **CMS** | Nur Events-Admin; keine dedizierten Artists/Venues-Screens |
| **Tests** | Vitest, Staging-Validierungsskripte lokal |
| **Dokumentation** | Umfangreiche `app-v2/docs/`, `docs/PROJECT_STATE.md` |
| **Deployment** | Build-Skripte vorhanden; Remote-Staging laut Statusbericht nicht ausgeführt |

### Nicht enthaltene Features

| Feature | Referenz |
|---------|----------|
| Gemeinsamer Login (Consumer + Admin) | `BACKLOG.md` ER-001 |
| Admin Auth auf globale Session umgestellt | ER-003 |
| Event-Publish-Workflow (draft → published im Admin) | ER-004; Import legt nur `draft` an |
| Import-Scheduler / Webhook-Laufzeit | ER-005; nur Datenmodell |
| Website mit Live-Events aus Supabase als Standard | ER-009 |
| SEO mit echten Event-URLs als Hauptinhalt | ER-010 (Basis vorhanden, Event-Anbindung offen) |
| CMS Artists / Venues | ER-007, ER-008 |
| Consumer-Login und Cloud-Sync | `PROJECT_STATE.md` |
| Interaktive Karte | Map-Tab für Closed Beta ausgeblendet |
| Push-Notifications | Nur lokales Notification Center |
| Edge Functions | Nicht im Repository |
| Gehostete Rechtstexte (Privacy, Impressum) | `go-live.md` G3, G5 — dokumentiert, nicht live |
| Store-Einreichung | Nicht gestartet |

### Voraussetzungen

- Backlog-Tickets ER-001 bis ER-005 und ER-009, ER-010 für Beta-Zielbild (siehe `BACKLOG.md`)
- Supabase-Projekt mit angewendeten Migrationen
- Staging-Seed (`npm run seed:staging:remote` oder manuelles SQL)
- `.env` mit `EXPO_PUBLIC_USE_SUPABASE=true` für Cloud-Modus
- Admin-Benutzer mit JWT-Rolle in Supabase Auth
- Go-Live-Gates G1–G15 für formale Freigabe (`app-v2/docs/go-live.md`)

### Abnahmekriterien

- `npm run release:check` — PASS
- Admin: Login, Event anlegen/bearbeiten, Import manuell starten und Record approven
- RLS: Anonym liest nur `published` Events; Admin-Schreiben nur mit `is_admin()`
- Web-Build deploybar (`npm run build:web`)
- Android Release-Build erfolgreich
- Beta-Checkliste in `app-v2/docs/beta.md` / `launch-checklist.md` abgearbeitet
- `docs/PROJECT_STATE.md` aktuell

### Risiken

| Risiko | Auswirkung |
|--------|------------|
| Mock als Standard (`USE_SUPABASE=false`) | Beta-Tester sehen keine Cloud-Daten ohne explizite Konfiguration |
| Remote-Staging nicht befüllt | Leere Tabellen, FK-Fehler bei Event-Erstellung |
| Separater Admin-Login | Abweichung von Zielarchitektur (`CLAUDE.md`) |
| Kein Publish-Workflow | Import-Events bleiben `draft`, öffentliche App sieht sie nicht |
| Rechtstexte nicht gehostet | Kein öffentlicher Beta-Start in DE |
| iOS nur vorbereitet, kein Cloud-Build | Beta primär Android + Web |

---

# Release 0.3 – Public Beta

**Status:** Geplant

**Ziel:** Öffentliche Beta mit Live-Event-Daten auf Web und Mobile, erweitertem Admin-CMS und Store-Präsenz.

**Enthaltene Features:**

Noch nicht im Repository umgesetzt. Geplant über `BACKLOG.md`:

- ER-006 CMS Events (vollständiger Lebenszyklus, Bild-Upload)
- ER-007 CMS Artists
- ER-008 CMS Venues
- Voraussetzung: abgeschlossene Tickets aus Release 0.2 (Auth, Publish, Website-Events, SEO)

### Zielgruppe

Öffentliche Beta-Nutzer (Web, Android, optional iOS TestFlight), Veranstalter und Redaktion.

### Features (geplant)

| Bereich | Geplanter Inhalt |
|---------|------------------|
| Website | Publizierte Events aus Supabase, SEO mit Event-URLs |
| Admin | CMS für Events, Artists, Venues |
| Import | Optional Scheduler (ER-005) |
| Mobile | Store-Listings, Beta-Programm (`app-v2/docs/beta.md`) |
| Auth | Gemeinsamer Login, rollenbasierter Admin-Zugriff |

### Nicht enthaltene Features

- Release-1.0-Produktions-SLA und vollständiges Monitoring
- Push-Notifications / Community-Features (nicht in `BACKLOG.md` ER-001–010)
- Interaktive Karte (nicht in Backlog-Tickets 001–010)
- CRM, Automation (nur in Sprint-Roadmap-Docs erwähnt, nicht in Backlog)

### Voraussetzungen

- Release 0.2 Abnahmekriterien erfüllt
- ER-001 bis ER-010 aus `BACKLOG.md` umgesetzt
- Store-Assets (Screenshots, Feature Graphic — siehe `launch-checklist.md`)
- Gehostete Legal-URLs (Privacy, Impressum, Support)
- Developer-Accounts (Google Play, Apple) aktiv

### Abnahmekriterien

- Öffentliche Web-URL mit `published` Events
- Store-Beta oder öffentlicher Web-Zugang ohne Einladungscode
- Admin-CMS für Events, Artists, Venues nutzbar
- `go-live.md` Gates G3–G5, G8, G9 erfüllt
- Keine P0/P1-Bugs in Kernflows (Discovery, Event-Detail, Admin-Publish)

### Risiken

| Risiko | Auswirkung |
|--------|------------|
| CMS-Umfang wächst über ER-006–008 hinaus | Verzögerung Public Beta |
| Store-Review-Zeiten | Verzögerter Mobile-Start |
| SEO ohne ausreichend publizierte Events | Geringe organische Reichweite |

---

# Release 1.0 – First Stable

**Status:** Geplant

**Ziel:** Erste stabile Produktionsversion mit formaler Go-Live-Freigabe, Betriebsprozessen und dauerhaftem Deployment.

**Enthaltene Features:**

Noch nicht freigegeben. Baut auf Release 0.3 auf und schließt Betriebs- und Governance-Anforderungen aus `app-v2/docs/go-live.md` und `compliance.md`.

### Zielgruppe

Alle Endnutzer (öffentlicher Launch), dauerhafter Betrieb für Admin und Redaktion.

### Features (geplant)

| Bereich | Geplanter Inhalt |
|---------|------------------|
| Produktion | Stabiler Supabase-Produktionsbetrieb |
| Betrieb | Monitoring, Backups, Rollback, On-Call |
| Compliance | Alle Go-Live-Gates G1–G15 bestanden |
| Stores | Production-Release Android + iOS (falls im Scope) |
| Dokumentation | Vollständige Ops- und Release-Dokumentation |

### Nicht enthaltene Features

Alles, was nicht in Releases 0.1–0.3 oder `BACKLOG.md` ER-001–010 definiert ist (z. B. CRM, Community, Push — nicht als 1.0-Scope dokumentiert).

### Voraussetzungen

- Release 0.3 abgeschlossen und in Produktion validiert
- `go-live.md`: alle Sign-offs (Technical, Privacy, Security, QA, Operations, Product)
- EAS Production Builds (G14)
- Monitoring-Baseline (G11)
- Backup/Restore getestet (G13)

### Abnahmekriterien

- Formales Go-Entscheidungsprotokoll (`go-live.md` Sign-off-Matrix)
- 7-Tage-Post-Launch-Review ohne kritische Incidents
- `release:check` und Regression auf Android, iOS, Web (G7, G8)
- `PROJECT_STATE.md`, `CHANGELOG.md`, `README.md` auf Produktionsstand

### Risiken

| Risiko | Auswirkung |
|--------|------------|
| Vorzeitiges Go-Live ohne G1–G15 | Rechtliche und operative Haftung |
| Kein Rollback getestet | Längere Ausfallzeiten bei Deploy-Fehlern |
| Skalierung Supabase ungetestet | Performance unter Last unklar |

---

## Release Checklist

Stand jeweils gegen Repository und `PROJECT_STATE.md` (20. Juli 2026).  
`[x]` = im Code/dokumentiert vorhanden und für RC 0.2 nutzbar · `[~]` = teilweise · `[ ]` = nicht erfüllt / nicht gestartet

### Datenbank

- [x] Supabase-Migrationen im Repository (8 Dateien)
- [x] RLS auf allen relevanten Tabellen
- [x] SQL-Hilfsfunktionen `is_admin()`, `admin_role()`, `has_admin_role()`
- [x] Staging-Seed-SQL und Remote-Seed-Skript
- [~] Migrationen auf Remote-Staging angewendet (lokal validiert, Remote laut Statusbericht offen)
- [~] Referenzdaten (Cities, Genres) in Remote-DB befüllt

### Auth

- [x] Supabase Auth Integration (`auth-service.ts`)
- [x] Admin-Login `/admin/login`
- [x] JWT-Rollen in App und DB
- [x] Lokaler Mock-Auth für Entwicklung
- [ ] Gemeinsamer Login für alle Benutzer (ER-001)
- [ ] Consumer-Accounts

### Admin

- [x] Admin-Web-Routen und Shell
- [x] Rollen-Guards und Route-Permissions
- [x] Events-CRUD
- [x] Import: Sources, Jobs, Review
- [x] Web-only-Zugriff
- [ ] Admin Auth auf globale Session (ER-003)
- [ ] Vollständiger Publish-Workflow (ER-004)
- [ ] CMS Artists / Venues (ER-007, ER-008)

### Website

- [x] Statischer Web-Export
- [x] Responsive Layout, PWA-Foundation
- [x] Home, Search, Saved, Event-Detail (Mock/Repository)
- [x] SEO-Generierung (Basis)
- [ ] Standardbetrieb mit Supabase-Events (ER-009)
- [ ] SEO mit Live-Event-URLs (ER-010)
- [ ] Gehostete Legal-URLs live

### Mobile

- [x] Android-native Projekt und Release-Build-Pfad
- [x] iOS-Projekt und EAS-Konfiguration
- [x] App-Icons, Bundle-ID
- [~] iOS Cloud-Build / TestFlight (vorbereitet, nicht ausgeführt)
- [ ] Store-Einreichung gestartet
- [ ] Manuelle Geräte-QA abgeschlossen (G8)

### Import

- [x] Adapter-Registry (6 Formate)
- [x] Orchestrator, Matching, Duplicate Detection
- [x] Review-Workflow und Audit-Log
- [x] Manueller Import-Start
- [ ] Scheduler / Webhook-Laufzeit (ER-005)
- [ ] Automatisches Publish nach Approve (Events bleiben `draft`)

### CMS

- [x] Events-Admin (Basis-CRUD)
- [ ] Erweitertes Event-CMS inkl. Bild-Upload (ER-006)
- [ ] Artists-Admin (ER-007)
- [ ] Venues-Admin (ER-008)

### Tests

- [x] Vitest Unit-Tests (214 laut Statusbericht)
- [x] `npm run release:check`
- [x] Staging-Validierung lokal (`validate:staging:local`)
- [~] Remote RLS-Validierung (Skript vorhanden, Ausführung offen)
- [ ] Vollständige Beta-Regression (G8)

### Dokumentation

- [x] `app-v2/docs/` (Architektur, Backend, Import, Admin, Release, Legal)
- [x] `docs/PROJECT_STATE.md`
- [x] `BACKLOG.md`, `CLAUDE.md`, `RELEASE_PLAN.md`
- [ ] `CHANGELOG.md` (im Repository nicht vorhanden)
- [~] Einzelne Docs veraltet (`database.md`, `BUILD_STATUS.md`)

### Deployment

- [x] Web-Build-Pipeline (`build:web`, `validate:build-output`)
- [x] Env-Validierung (`validate:env`)
- [x] Go-Live-Prozess dokumentiert (`go-live.md`)
- [ ] Produktions-Deployment durchgeführt
- [ ] Monitoring und On-Call aktiv (G11, G12)
- [ ] Rollback getestet (G10)
- [ ] EAS Production Builds (G14)
