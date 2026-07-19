# Eternal Rave — Projektstatusbericht nach den letzten 11 Sprints

**Projekt:** Eternal Rave (`app-v2`)  
**Version:** 0.2.0  
**Bundle-ID:** `com.eternalrave.app`  
**Berichtsdatum:** 19. Juli 2026  
**Berichtszeitraum:** Sprint 12.5 bis Sprint 12.7F (11 Sprints)  
**Status:** Offizieller Projektstatus — dokumentationsbasiert, keine Codeänderungen in diesem Bericht

---

## Executive Summary

Eternal Rave hat in den letzten elf Sprints den Übergang von einer technisch validierten Backend-/Admin-Plattform (Sprint 12.5) zu einer **release-fähigen Multi-Plattform-Anwendung** vollendet. Die Sprints 12.6A–12.6D lieferten funktionale Implementierungen für Web, PWA, Notification Center und Admin-Web-Zugang. Die Sprints 12.7A–12.7F bereiteten iOS/TestFlight, Business-/Legal-Foundation, Analytics/SEO, Store-Beta und Release-Governance vor — überwiegend als Dokumentation und Infrastruktur, ohne neue Produktfeatures.

**Kernbefund:** Das Projekt ist **technisch bereit für eine geschlossene Beta** (Android, iOS-Vorbereitung, Web/PWA), aber **nicht freigegeben für Produktion**. Kritische Blocker sind gehostete Rechtstexte (Datenschutz, Impressum, Support), Store-Assets (Screenshots, Feature Graphic), manuelle Geräte-QA, Developer-Account-Enrollment und formale Go/No-Go-Freigaben.

**Validierungsstand:** `npm run release:check` — PASS; 214 Unit-Tests — PASS; TypeScript und ESLint (0 Fehler) — PASS.

---

## Projektstatus

### Aktueller Entwicklungsstand

| Bereich | Status | Anmerkung |
|---------|--------|-----------|
| Android | Produktionsreif (Build) | `assembleRelease` PASS |
| iOS | Vorbereitet | Native Projekt, EAS-Config; kein Cloud-Build |
| Web | Produktionsreif (Build) | Statischer Export, 25+ Routen |
| PWA | Foundation complete | Online-first, installierbar |
| Admin (Web) | Produktionsreif | Rollen, Guards, RLS |
| Supabase Backend | Validiert (lokal) | Remote-Staging nicht ausgeführt |
| Notification Center | Implementiert | Device-lokal, kein Push |
| Analytics (GA4) | Vorbereitet | Consent-gated, standardmäßig deaktiviert |
| SEO | Implementiert | robots.txt, sitemap, Schema.org |
| Legal/Privacy | Dokumentiert | Hosting ausstehend |
| Store Submission | Nicht gestartet | Templates und Checklisten vorhanden |
| Production Go-Live | **Nicht freigegeben** | Go/No-Go-Gates offen |

### Projektstatus-Gesamtbewertung

**Release Candidate 0.2.0** — technisch validiert, governance-seitig blockiert.

### Roadmap-Übersicht

| Phase | Sprint | Fokus | Status |
|-------|--------|-------|--------|
| Validierung | 12.5 | Production Validation, RLS, Migrationen | ✅ Abgeschlossen |
| Web & Plattform | 12.6A | Web Foundation, Responsive Layout | ✅ Abgeschlossen |
| Features | 12.6B | Notification Center (lokal) | ✅ Abgeschlossen |
| Admin | 12.6C | Admin Web Access, RLS-Härtung | ✅ Abgeschlossen |
| Release-Härtung | 12.6D | PWA, Env-Validation, `release:check` | ✅ Abgeschlossen |
| iOS | 12.7A | iOS Foundation, TestFlight-Vorbereitung | ✅ Abgeschlossen |
| Business | 12.7B | Domain, E-Mail, Brand Foundation | ✅ Abgeschlossen |
| Legal | 12.7C | Legal, Privacy & Consent Audit | ✅ Abgeschlossen |
| SEO/Analytics | 12.7D | Analytics, Search Console & SEO | ✅ Abgeschlossen |
| Store/Beta | 12.7E | Store Preparation & Public Beta | ✅ Abgeschlossen |
| Governance | 12.7F | Release Compliance & Governance | ✅ Abgeschlossen |
| **Geplant** | 13 | CMS | 🔜 Nächster Sprint |
| **Geplant** | 14 | CRM | 🔜 Geplant |
| **Geplant** | 15 | Automation | 🔜 Geplant |
| **Geplant** | 16 | Accounts, Push & Community | 🔜 Geplant |

### Sprintübersicht (11 Sprints)

| # | Sprint | Typ | PR (Referenz) | Tests (Endstand) |
|---|--------|-----|---------------|------------------|
| 1 | 12.5 Production Validation | Validierung | — | 130 |
| 2 | 12.6A Web Foundation | Implementierung | — | 140 |
| 3 | 12.6B Notification Center | Implementierung | — | 162 |
| 4 | 12.6C Admin Web Access | Implementierung + RLS | — | 188 |
| 5 | 12.6D PWA & Release Hardening | Implementierung | — | 194 |
| 6 | 12.7A iOS Foundation & TestFlight | Config + Docs | #32 | 199 |
| 7 | 12.7B Domain, Email & Brand | Docs only | #33 | — |
| 8 | 12.7C Legal, Privacy & Consent | Docs + Audit | #34 | 202 |
| 9 | 12.7D Analytics, SEO | Code + Docs | #35 | 214 |
| 10 | 12.7E Store & Public Beta | Docs only | #36 | 214 |
| 11 | 12.7F Compliance & Governance | Docs only | #37 | 214 |

---

## Architekturübersicht

### Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| Framework | React Native + Expo SDK 57 |
| Navigation | Expo Router (file-based, typed routes) |
| Sprache | TypeScript (strict) |
| Web | React Native Web, statischer Export (`web.output: static`) |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| State/Data | Repository-Pattern, `RepositoryProvider`, Feature Flags |
| Styling | React Native StyleSheet + Design-Tokens |
| Tests | Vitest |
| Builds | EAS (iOS/Android), Metro (Web) |

### Frontend

- **Architektur:** Feature-Module unter `src/features/`, wiederverwendbare Komponenten unter `src/components/`, Design-Tokens unter `src/design/`
- **Screens:** Dünne Expo-Router-Screens in `app/`; Geschäftslogik in Features/Repositories
- **Responsive Web (12.6A):** Breakpoints Mobile/Tablet/Desktop, `ResponsiveScreen`, `WebTopNav` ab 1024px
- **Plattform-Abstraktionen:** `src/platform/` — SEO, Analytics, PWA, Linking, Responsive Layout
- **Consumer-Daten:** Favoriten, Notifications, Event-Snapshots ausschließlich device-lokal (AsyncStorage/localStorage)
- **Keine Endnutzer-Accounts:** Kein Login, keine Cloud-Sync für Consumer-Daten

### Backend

- **Supabase:** 14 Tabellen, alle RLS-aktiviert
- **Import-Pipeline:** Sources → Jobs → Records → Review → Draft Events → Publish
- **Admin-Rollen:** JWT `app_metadata.role` mit 6 Rollen (viewer, editor, reviewer, source_manager, admin, owner)
- **Funktionen:** `is_admin()`, `admin_role()`, `has_admin_role()`
- **Storage:** 4 Buckets (events, artists, venues, collections)
- **Migrationen:** 6 chronologische Migrationen (initial schema bis admin events RLS)
- **Staging-Validierung:** Lokal auf PostgreSQL 16 mit Supabase-Stubs — PASS; Remote Supabase Staging nicht konfiguriert

### Web

- **Export:** Statischer Build nach `dist/` via `npm run build:web`
- **Routing:** 25+ statische HTML-Routen; Deep Links und Refresh unterstützt
- **HTML-Shell:** `app/+html.tsx` — Meta-Tags, OG, Twitter Cards, JSON-LD, Canonical
- **SEO-Hook:** `useWebSeo()` für per-Route Titel, Description, Canonical
- **Deployment:** HTTPS-Static-Hosting dokumentiert in `docs/web-deployment.md`

### Android

- **Native Projekt:** `android/` vorhanden (CNG/Prebuild-Warnung in Expo Doctor 19/20)
- **Build:** `./gradlew assembleRelease` — PASS in allen Sprint-Regressionen
- **versionCode:** 5
- **Adaptive Icons:** Konfiguriert
- **Keine Regressionen** durch Web/iOS/SEO-Änderungen auf Phone-Viewports

### iOS

- **Native Projekt:** Generiert via `expo prebuild --platform ios` (Sprint 12.7A)
- **Deployment Target:** iOS 15.1
- **Bundle ID:** `com.eternalrave.app`
- **Privacy Manifest:** UserDefaults CA92.1 (AsyncStorage)
- **Universal Links:** Vorbereitet via `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN`
- **EAS:** `eas.json` mit development/preview/production Profilen
- **TestFlight:** Dokumentiert, nicht ausgeführt (Apple-Credentials erforderlich)
- **EAS Cloud Build:** Nicht ausgeführt

### Adminbereich

- **Zugang:** Web-only; Native blockiert mit Web-only-State
- **Shell:** `AdminShell` mit Sidebar/Drawer, responsive
- **Guards:** Auth → Role → Route Permission (fail-closed)
- **Routen:** Dashboard, Events, Imports (Sources, Jobs, Review), Login
- **RLS (12.6C):** Migration `20260725000000_admin_events_rls.sql` — Events/Reference nur für Admins
- **Login:** Keine vorausgefüllten Credentials, Show/Hide Password, Return-Route

### Supabase

- **Auth:** Admin-only; Supabase Auth mit JWT-Session
- **RLS:** 14/14 Tabellen aktiviert; Anon liest nur published Events
- **Import-Tabellen:** Admin-only via `is_admin()`
- **Audit:** `import_audit_logs`, `import_logs` mit Retention-Zielen dokumentiert
- **Offene Punkte:** Storage-RLS für artists/venues/collections; Remote-Staging-Validierung; PITR nicht aktiviert; DPA nicht signiert

### Notification Center

- **Architektur:** `NotificationRepository` → `NotificationDatasource` → AsyncStorage
- **Provider:** `NotificationsProvider` als Single Source of Truth
- **Generierung:** Diff-basiert gegen Event-Snapshots (Favoriten-Änderungen, Cancelled, Starting Soon, Ticket Available, New Events)
- **Deduplizierung:** `deduplicationKey`
- **Kein Push:** Kein Firebase, Expo Notifications oder APNs

### Analytics

- **GA4:** Web-only, Consent Mode V2, opt-in Banner
- **Aktivierung:** `EXPO_PUBLIC_ANALYTICS_ENABLED=true` UND Nutzer-Consent
- **Speicher:** `@eternal_rave/analytics_consent_v1` in localStorage
- **IP-Anonymisierung:** Aktiviert
- **Keine Marketing-Pixels, kein Remarketing, keine User-IDs**

### SEO

- **robots.txt / sitemap.xml:** Generiert via `scripts/generate-seo-files.ts`
- **Schema.org:** Organization, WebSite, WebApplication, Event (Event-Detail)
- **Canonical URLs:** Per-Route via `useWebSeo`
- **Admin:** Aus sitemap/robots ausgeschlossen
- **Staging:** `EXPO_PUBLIC_WEB_NOINDEX=true` unterstützt

### Privacy

- **Datenminimierung:** Keine Consumer-Accounts, device-lokale Daten
- **Consent:** Analytics opt-in; Functional/Necessary standardmäßig granted
- **Rechtstexte:** Strukturen in `docs/privacy.md`, `docs/terms.md`, `docs/legal.md` — nicht gehostet
- **Retention:** Dokumentiert in `docs/data-retention.md`; Automatisierung ausstehend

### Release

- **Validierung:** `npm run release:check` — TypeScript, ESLint, Tests, PWA, iOS, SEO, Web-Build, Build-Output-Scan
- **Governance:** Release Gate (15 Kriterien), Go/No-Go (8 Sign-offs) in `docs/go-live.md`
- **Rollback:** Web (vorheriges `dist/`), Mobile (Store-Version), DB (PITR/Backup) dokumentiert
- **Status:** NOT READY für Produktion (G3, G4, G5, G9, G11, G14 pending)

---

## Sprint-Zusammenfassung

### Sprint 12.5 — Production Validation

**Ziel:** Sprint-12-Gesamtvalidierung gegen Staging-Datenbank und Build-Pipeline.

| Kategorie | Ergebnis |
|-----------|----------|
| Ergebnis | PASS WITH ACCEPTED WARNINGS |
| TypeScript/ESLint/Tests | PASS (130 Tests) |
| Migrationen (lokal) | 5 Migrationen auf leerer PostgreSQL — PASS |
| RLS (lokal, JWT-Mock) | PASS |
| Adapter/Import E2E (lokal) | PASS |
| Remote Supabase Staging | Nicht ausgeführt |
| Storage Live-Tests | Nicht ausgeführt |
| Performance unter Last | Nicht ausgeführt |

**Architekturentscheidungen:** Lokale PostgreSQL mit Supabase-kompatiblen Stubs als Abnahme-Fallback; Remote-Validierung als Release-Voraussetzung dokumentiert.

**Offene Punkte:** Echte Supabase-Staging-Instanz bereitstellen; `validate:staging:remote` ausführen.

---

### Sprint 12.6A — Web Foundation

**Ziel:** Browser-Baseline für Eternal Rave auf bestehendem Expo/RN-Stack.

**Implementierungen:**
- Responsive Layout (`responsive-layout.ts`, `ResponsiveScreen`, Breakpoints)
- Desktop Top Navigation (`WebTopNav` ab 1024px)
- Custom HTML Shell (`app/+html.tsx`)
- Web Share URLs für Events
- `build:web` / `web:export` Scripts

**Dokumentation:** `docs/web-foundation.md`

**Tests:** +4 responsive Tests (140 gesamt)

**Risiken:** Map-Tab Placeholder; Admin-Routen in Static Export dokumentiert

---

### Sprint 12.6B — Notification Center

**Ziel:** Lokales Notification Center ohne Push-Infrastruktur.

**Implementierungen:**
- `NotificationRepository`, `NotificationsProvider`, UI-Komponenten
- Bell + Badge auf Home
- Screen `/notifications`
- 7 Generierungsregeln (Baseline, Saved Changes, Cancelled, Starting Soon, Ticket, New Events)
- Persistenz: `@eternal_rave/notifications_v2`, Snapshots, Sync-State

**Dokumentation:** `docs/notifications.md`

**Tests:** +22 Tests (162 gesamt)

**Bewusst nicht implementiert:** Push, Realtime, User Accounts, Cross-Device Sync

---

### Sprint 12.6C — Admin Web Access

**Ziel:** Browser-first Admin mit Sicherheitshärtung.

**Implementierungen:**
- Erweiterter `AdminAuthProvider` (Session, Role, Loading, Error)
- `admin-permissions.ts`, `admin-guard.ts` (fail-closed)
- `AdminShell` (Sidebar/Drawer)
- Login-Härtung (keine Prefill-Credentials)
- RLS-Migration für Events/Reference-Tabellen
- 26 neue Tests

**Dokumentation:** `docs/admin-web.md`, `docs/security.md`

**Manuelle Schritte:** RLS-Migration auf Supabase anwenden; Admin-User mit Rolle anlegen

**Offene Punkte:** Browser Deep-Link/Refresh manuell testen; optional Import-List-Reads durch Service-Layer

---

### Sprint 12.6D — PWA & Release Hardening

**Ziel:** Installierbare PWA und Release-Validierungspipeline.

**Implementierungen:**
- Web App Manifest, PWA-Icons (192/512/maskable)
- Service Worker (`public/sw.js`) — online-first, Admin/Auth bypass
- Offline-Fallback (`public/offline.html`)
- `PwaProvider`, Update/Offline-Banner
- `validate-env.ts`, `validate:pwa`, `validate:build-output`
- `release:check` npm Script
- Route Document Titles via `useWebDocumentTitle`

**Dokumentation:** `docs/pwa.md`, `docs/web-deployment.md`, `docs/release-checklist.md`

**Tests:** +6 Tests (194 gesamt)

**Einschränkungen:** Kein Full Offline; SW deaktiviert auf localhost; Lighthouse nicht in CI

---

### Sprint 12.7A — iOS Foundation & TestFlight

**Ziel:** iOS-Build-Vorbereitung ohne Store-Submission.

**Implementierungen:**
- `app.config.ts` iOS-Konfiguration (buildNumber, Privacy Manifest, Associated Domains)
- `eas.json` (development/preview/production)
- Native iOS-Projekt (`ios/`)
- `src/platform/linking/` — Deep Links, External URL Validation
- `scripts/validate-ios-config.ts`, `npm run validate:ios`

**Dokumentation:** `docs/ios-build.md`

**Tests:** +5 Tests (199 gesamt)

**Nicht ausgeführt:** EAS Cloud Build, TestFlight Upload, On-Device QA

---

### Sprint 12.7B — Domain, Email & Brand Foundation

**Ziel:** Business-Infrastruktur dokumentieren (keine Registrierungen).

**Dokumentation erstellt:**
- `docs/domain.md` — Domain-Strategie, DNS, HTTPS, Cloudflare
- `docs/email.md` — Mailbox-Struktur, SPF/DKIM/DMARC
- `docs/business-setup.md` — Social Handles, GitHub-Audit
- `docs/brand.md` — Brand Guidelines, Asset-Gaps

**Keine Codeänderungen.** Keine Domains registriert, keine Accounts erstellt.

**Fehlende Assets:** SVG-Logo, Wordmark, Store-Screenshots, Play Feature Graphic

---

### Sprint 12.7C — Legal, Privacy & Consent

**Ziel:** Vollständige Legal/Privacy-Dokumentationsgrundlage und Audit.

**Audit-Ergebnis:** Privacy-favorable Architektur — keine Endnutzer-Accounts, device-lokale Consumer-Daten, admin-only Auth mit RLS.

**Dokumentation erstellt:**
- `docs/privacy.md` — Architektur, Inventar, GDPR, Third-Party, Consent
- `docs/terms.md` — AGB-Struktur (13 Kapitel)
- `docs/legal.md` — Impressum-Struktur
- `docs/data-retention.md` — Retention-Schedule
- `docs/security-privacy.md` — Security/Privacy Review, RLS-Audit, Risiken

**Keine Codeänderungen.** Kein Consent-Banner (nicht benötigt bis Analytics).

**Kritische Lücken:** Rechtstexte nicht verfasst (Anwalt erforderlich); Privacy Policy nicht gehostet; Admin Idle Timeout fehlt

---

### Sprint 12.7D — Analytics, Search Console & SEO

**Ziel:** SEO-Infrastruktur und privacy-konforme Analytics-Vorbereitung.

**Implementierungen:**
- `src/platform/seo/` — Config, Meta, Structured Data, `useWebSeo`
- `src/platform/analytics/` — GA4 Client, Consent Storage, `AnalyticsProvider`, Cookie Banner
- `public/robots.txt`, `public/sitemap.xml`
- `scripts/generate-seo-files.ts`, `scripts/validate-seo.ts`
- Enhanced `app/+html.tsx`, `app/_layout.tsx`, `app/event/[id].tsx`

**Dokumentation:** `docs/analytics.md`, `docs/seo.md`, `docs/search-console.md`, `docs/performance.md`, `docs/web-manifest.md`

**Tests:** +20 Tests (214 gesamt)

**Nicht registriert:** Google Search Console, Bing Webmaster Tools

---

### Sprint 12.7E — Store Preparation & Public Beta

**Ziel:** Store- und Beta-Vorbereitung ohne Submission.

**Dokumentation erstellt:**
- `docs/release.md` — Release-Prozess, Versioning, RC, Rollback
- `docs/store.md` — Store Listings, Assets, Screenshots-Plan
- `docs/beta.md` — TestFlight, Play Testing, QA, Crash-Strategie
- `docs/launch-checklist.md` — Pre-Beta Checkliste, Smoke Tests

**Keine Codeänderungen.**

**Blocker:** Privacy/Support URLs, Screenshots, Developer Accounts, `ascAppId` Placeholder

---

### Sprint 12.7F — Release Compliance & Governance

**Ziel:** Release-Governance-Framework vor Produktion.

**Dokumentation erstellt/erweitert:**
- `docs/compliance.md` — Compliance-Matrix (Apple, Google, GDPR)
- `docs/operations.md` — Monitoring, Backup, Restore, Eskalation
- `docs/go-live.md` — Release Gate, Go/No-Go, Production Checklist
- `docs/security.md` — Erweitert: Secrets, Incident Response, DR, OWASP

**Keine Codeänderungen.**

**Bewertung:** Technisch beta-ready; produktionsseitig NOT READY.

---

## Implementierte Funktionen (gesamt)

### Neue Funktionen (Code)

| Funktion | Sprint | Plattform |
|----------|--------|-----------|
| Responsive Web Layout | 12.6A | Web |
| Desktop Top Navigation | 12.6A | Web |
| Web Share URLs | 12.6A | Web |
| Notification Center (lokal) | 12.6B | Android, Web |
| Notification Badge | 12.6B | Android, Web |
| Admin Web Shell + Guards | 12.6C | Web |
| Admin Role Permissions | 12.6C | Web |
| PWA Install (Manifest + SW) | 12.6D | Web |
| Offline Banner + Update Banner | 12.6D | Web |
| Environment Validation | 12.6D | Alle |
| `release:check` Pipeline | 12.6D | CI/Release |
| iOS Native Project + EAS | 12.7A | iOS |
| Deep Link / Universal Link Helpers | 12.7A | iOS, Android |
| SEO Meta + Schema.org | 12.7D | Web |
| GA4 + Consent Banner | 12.7D | Web |
| robots.txt + sitemap.xml | 12.7D | Web |

### Verbesserungen

| Verbesserung | Sprint |
|--------------|--------|
| Fail-closed Admin Role Resolution | 12.6C |
| Login-Härtung (keine Prefill-Credentials) | 12.6C |
| RLS für Events/Reference (admin-only writes) | 12.6C |
| Per-Route Document Titles | 12.6D |
| Build-Output Secret Scan | 12.6D |
| Ticket URL Validation (iOS Safari) | 12.7A |
| Manifest Enhancement (categories, id) | 12.7D |

### Refactorings

| Refactoring | Sprint |
|-------------|--------|
| `ResponsiveScreen` Wrapper auf Hauptscreens | 12.6A |
| Admin Stack Presentation (modal → card) | 12.6C |
| `useAdminRole()` mit Loading/Error State | 12.6C |
| Event Actions → Platform Linking Module | 12.7A |

### Build-Änderungen

| Änderung | Sprint |
|----------|--------|
| `build:web`, `web:export` Scripts | 12.6A |
| `validate:pwa`, `validate:build-output` | 12.6D |
| `validate:ios` | 12.7A |
| `generate:seo`, `validate:seo` | 12.7D |
| `release:check` erweitert (PWA, iOS, SEO) | 12.6D–12.7D |
| `eas.json` Profile | 12.7A |

---

## Datenschutz

### DSGVO

| Prinzip | Status |
|---------|--------|
| Rechtmäßigkeit | Dokumentiert (Rechtsgrundlagen in `docs/privacy.md` §7) |
| Transparenz | Struktur bereit; Policy nicht gehostet — **Medium Risk** |
| Zweckbindung | Compliant |
| Datenminimierung | Stark (keine Consumer-Accounts) |
| Richtigkeit | Import-Review-Workflow vorhanden |
| Speicherbegrenzung | Retention dokumentiert; Automatisierung ausstehend |
| Integrität/Vertraulichkeit | RLS + TLS |

### Consent

| Kategorie | Default | Mechanismus |
|-----------|---------|-------------|
| Necessary | granted | — |
| Functional | granted | — |
| Analytics | **denied** | Opt-in Banner (12.7D) |
| Marketing | **denied** | Nicht angeboten |

### Privacy

- **Verarbeitungsverzeichnis:** Intern in `docs/privacy.md` §8
- **Datenklassifizierung:** Öffentlich, Intern, Personenbezogen (Admin), Sensibel (keine)
- **Consumer-Daten:** Favoriten, Notifications, Snapshots — device-lokal, nicht account-gebunden

### Export

- **Aktuell:** Kein Cloud-Export (keine Accounts)
- **Konzept:** Dokumentiert in `docs/privacy.md` §16 — App-Daten löschen via „App-Daten löschen"

### Löschung

- **Device:** App-Daten löschen entfernt Favoriten/Notifications
- **Admin:** Hard Delete dokumentiert mit Abhängigkeitsreihenfolge
- **Events:** Soft Delete via Status-Feld
- **Automatisierung:** Retention-Purge-Jobs nicht implementiert

### Retention

| Daten | Ziel-Retention | Automatisierung |
|-------|----------------|-----------------|
| Device-Daten | Bis App-Clear | Nutzer-gesteuert |
| Import Logs | 90 Tage | Nicht implementiert |
| Import Records | 6 Monate | Nicht implementiert |
| Audit Logs | 24 Monate | Nicht implementiert |
| Admin Sessions | Supabase Defaults | — |

### Drittanbieter

| Dienst | Aktiv | DPA |
|--------|-------|-----|
| Supabase | Ja | **Ausstehend** |
| Expo/EAS | Ja | ToS prüfen |
| Google (Maps, GA4) | Konfiguriert / Consent-gated | GA nur mit Consent |
| Apple App Store | Vorbereitet | Developer Agreement |
| Google Play | Vorbereitet | Developer Agreement |
| Firebase/Sentry/PostHog | Nein | — |
| E-Mail-Provider | Nein | Bei Setup |

---

## Sicherheit

### Authentication

- **Consumer:** Keine Authentifizierung
- **Admin:** Supabase Auth, JWT-Session, `app_metadata.role`
- **Fail-closed:** Unbekannte Rollen erhalten keinen Admin-Zugang (12.6C)

### Authorization

- **Frontend:** Route Guards + Permission Matrix (6 Rollen)
- **Backend:** RLS auf allen 14 Tabellen
- **Service Role:** Nie im Client; validiert durch `validate-env.ts` und Build-Scan

### RLS

| Tabelle | Anon | Authenticated (non-admin) | Admin |
|---------|------|---------------------------|-------|
| Published Events | Read | Read | Full (seit 12.6C) |
| Draft Events | — | — | Admin only |
| Import-Tabellen | — | — | Admin only |
| Reference (genres, cities, etc.) | Read | Read | Admin write (seit 12.6C) |

**Lücken:** Storage-Buckets artists/venues/collections ohne RLS-Policies

### Secrets

- Keine Secrets im Repository
- `validate:build-output` scannt `dist/` auf Service Role Keys
- EAS Secrets für Production: ausstehend
- Rotation-Prozedur dokumentiert in `docs/security.md`

### Environment

- `EXPO_PUBLIC_*` nur für Client-sichere Werte
- `validate-env.ts` blockiert Service Role in Client-Env
- Mock-Admin-Credentials nur bei `USE_SUPABASE=false` — Production muss `USE_SUPABASE=true` erzwingen

### API Security

- Supabase Anon Key im Client (erwartet)
- RLS als primäre Zugriffskontrolle
- Import-Fetch: SSRF-Mitigation dokumentiert
- Admin-Routen: SW network-only (kein Cache)

### Security Review (12.7F)

| Finding | Severity | Status |
|---------|----------|--------|
| RLS auf allen Tabellen | — | Pass |
| Service Role im Client | Critical | Blocked |
| Mock Admin in Prod | Critical | Mitigate via Env |
| Storage Bucket RLS | Medium | Offen |
| Admin Idle Timeout | Medium | Nicht implementiert |
| OWASP Gesamt | Low-Med | Akzeptabel für Beta |

---

## SEO

| Element | Status | Sprint |
|---------|--------|--------|
| Meta Tags (title, description) | ✅ Global + per-page | 12.7D |
| robots.txt | ✅ Generiert | 12.7D |
| sitemap.xml | ✅ Generiert | 12.7D |
| Canonical URLs | ✅ Per-Route | 12.7D |
| Open Graph | ✅ Vollständig | 12.7D |
| Twitter Cards | ✅ | 12.7D |
| Schema.org | ✅ Organization, WebSite, WebApplication, Event | 12.7D |
| Lighthouse | ❌ Nicht in CI; manuell post-deploy | 12.7D |
| Core Web Vitals | Dokumentiert (LCP <2.5s, INP <200ms, CLS <0.1) | 12.7D |
| Google Search Console | Vorbereitet, nicht registriert | 12.7D |
| Alt-Texte | Teilweise (Gap) | — |
| Dedicated OG Image (1200×630) | Fehlt | — |

---

## Store Readiness

### TestFlight (iOS)

| Item | Status |
|------|--------|
| EAS Production Profile | ✅ Konfiguriert |
| iOS Native Project | ✅ Generiert |
| Privacy Manifest | ✅ |
| Build Upload | ❌ Nicht ausgeführt |
| Internal/External Testers | ❌ Nicht konfiguriert |
| Beta Release Notes | Template bereit |
| `ascAppId` | Placeholder |

### Google Play

| Item | Status |
|------|--------|
| Package `com.eternalrave.app` | ✅ |
| versionCode 5 | ✅ |
| AAB via EAS | Dokumentiert |
| Data Safety Form | Vorbereitet |
| Content Rating (IARC) | Ausstehend |
| Closed Testing Track | Dokumentiert, nicht erstellt |
| Feature Graphic 1024×500 | ❌ Fehlt |

### App Store Connect

| Item | Status |
|------|--------|
| Bundle ID | ✅ Konfiguriert |
| Version 0.2.0 | ✅ |
| Store Metadata | Templates in `docs/store.md` |
| Screenshots | ❌ Nicht erstellt |
| Privacy/Support URLs | ❌ Nicht gehostet |
| Age Rating | Ausstehend |

### Store Assets

| Asset | Status |
|-------|--------|
| App Icon 1024 (RGB, no alpha) | ✅ |
| PWA Icons 192/512/maskable | ✅ |
| Android Adaptive Icons | ✅ |
| Splash Screen | ✅ |
| Screenshots (iOS/Android) | ❌ Geplant, nicht erstellt |
| Feature Graphic | ❌ |
| App Preview Video | Dokumentiert, nicht produziert |
| SVG Logo / Wordmark | ❌ |

### Release Notes

- Struktur und Beta-Template in `docs/store.md` §8
- Nicht finalisiert

### Beta

- 5-Phasen-Plan in `docs/beta.md` (Pre-Beta → Internal → Closed → Open → Production)
- Aktuelle Phase: **Pre-Beta**
- Feedback-Prozess: P0–P3 Triage, 48h Response-Ziel
- Crash Reporting: Apple ASC / Google Play Vitals (primär); kein Sentry SDK

---

## Release Readiness

### QA

| Kategorie | Status |
|-----------|--------|
| Automatisierte Unit-Tests | ✅ 214 PASS |
| `release:check` | ✅ PASS |
| Android assembleRelease | ✅ PASS |
| Web Production Build | ✅ PASS |
| iOS Config Validation | ✅ PASS |
| Manuelle Geräte-QA | ❌ Nicht ausgeführt |
| Browser-Tests (Chrome/Safari/Firefox) | ❌ Nicht in CI |
| PWA Install-Test | ❌ Manuell ausstehend |
| Lighthouse Audit | ❌ Manuell ausstehend |

### Smoke Tests

- Checklisten in `docs/release-checklist.md`, `docs/launch-checklist.md`, `docs/beta.md`
- Nicht auf physischen Geräten ausgeführt

### Rollback

| Plattform | Strategie | Dokumentiert |
|-----------|-----------|--------------|
| Web | Vorheriges `dist/` redeployen + SW-Cache-Hinweis | ✅ |
| Android/iOS | Store-Version zurückstufen | ✅ |
| Datenbank | Supabase Backup/PITR | ✅ (PITR nicht aktiviert) |
| Git | Tag-basierter Rollback | ✅ |

### Release Gate (15 Kriterien)

**Status: NOT READY** — G3, G4, G5, G9, G11, G14 pending (Legal, QA, Monitoring, DPA, Sign-offs)

### Go/No-Go

- 8 Sign-off-Gates definiert in `docs/go-live.md`
- Keine Go-Live-Entscheidung getroffen
- Verantwortliche Rollen und Entscheidungsmatrix dokumentiert

### Governance

- Compliance-Matrix: `docs/compliance.md`
- Incident Response: SEV-1 bis SEV-4, GDPR 72h Meldepflicht
- Disaster Recovery: Szenarien dokumentiert (RTO 15 Min – 48h)
- Audit Logs: `import_audit_logs`, `import_logs`; Admin Login Failures nicht zentralisiert

---

## Dokumentation

### Neu erstellte Dokumente (Sprints 12.5–12.7F)

| Dokument | Zweck | Inhalt | Status |
|----------|-------|--------|--------|
| `docs/web-foundation.md` | Web-Architektur und Breakpoints | Responsive Layout, Routing, Limitations | ✅ Aktuell (12.6A) |
| `docs/notifications.md` | Notification Center Referenz | Repository, Generierung, Persistenz, API | ✅ Aktuell (12.6B) |
| `docs/admin-web.md` | Admin Web Access | Shell, Guards, Rollenmatrix, RLS | ✅ Aktuell (12.6C) |
| `docs/pwa.md` | PWA Foundation | Manifest, SW, Offline, Limitations | ✅ Aktuell (12.6D) |
| `docs/web-deployment.md` | Web Deployment | Hosting, Cache Headers, HTTPS | ✅ Aktuell (12.6D) |
| `docs/release-checklist.md` | Release Checkliste | Pre-Release Smoke Tests | ✅ Aktuell (12.6D) |
| `docs/ios-build.md` | iOS Build & TestFlight | EAS, ASC Templates, QA Checklist | ✅ Aktuell (12.7A) |
| `docs/domain.md` | Domain-Strategie | Canonical URL, DNS, HTTPS, Cloudflare | ✅ Aktuell (12.7B) |
| `docs/email.md` | E-Mail-Infrastruktur | Mailboxen, SPF/DKIM/DMARC | ✅ Aktuell (12.7B) |
| `docs/business-setup.md` | Business Setup | Social Handles, GitHub Audit | ✅ Aktuell (12.7B) |
| `docs/brand.md` | Brand Guidelines | Farben, Typografie, Asset-Gaps | ✅ Aktuell (12.7B) |
| `docs/privacy.md` | Privacy Architecture | Inventar, GDPR, Flows, Consent, Store Prep | ✅ Aktuell (12.7C) |
| `docs/terms.md` | Terms of Service | 13-Kapitel-Struktur | ✅ Struktur (12.7C) |
| `docs/legal.md` | Legal Documents | Impressum-Struktur, Kontakte | ✅ Struktur (12.7C) |
| `docs/data-retention.md` | Data Retention | Schedule, Backups, Löschreihenfolge | ✅ Aktuell (12.7C) |
| `docs/security-privacy.md` | Security & Privacy Review | RLS-Audit, Risiken, Testplan | ✅ Aktuell (12.7C) |
| `docs/analytics.md` | Analytics | GA4, Consent Mode, Event-Katalog | ✅ Aktuell (12.7D) |
| `docs/seo.md` | SEO | Inventory, Checkliste, Indexierung | ✅ Aktuell (12.7D) |
| `docs/search-console.md` | Search Console | GSC/Bing Setup, Verification | ✅ Aktuell (12.7D) |
| `docs/performance.md` | Performance | CWV Targets, Lighthouse | ✅ Aktuell (12.7D) |
| `docs/web-manifest.md` | Web Manifest | PWA Metadata, Icon Audit | ✅ Aktuell (12.7D) |
| `docs/release.md` | Release Management | Versioning, RC, Rollback | ✅ Aktuell (12.7E) |
| `docs/store.md` | Store Listings | ASC/Play Metadata, Assets, Release Notes | ✅ Aktuell (12.7E) |
| `docs/beta.md` | Beta Program | TestFlight, Play Testing, QA, Launch Plan | ✅ Aktuell (12.7E) |
| `docs/launch-checklist.md` | Launch Checkliste | Pre-Beta, Sign-off Template | ✅ Aktuell (12.7E) |
| `docs/compliance.md` | Compliance & Governance | Apple/Google/GDPR Matrix | ✅ Aktuell (12.7F) |
| `docs/operations.md` | Operations | Monitoring, Backup, Eskalation | ✅ Aktuell (12.7F) |
| `docs/go-live.md` | Go-Live | Release Gate, Go/No-Go, Production Checklist | ✅ Aktuell (12.7F) |

### Erweiterte Dokumente

| Dokument | Änderung | Sprint |
|----------|----------|--------|
| `docs/security.md` | Admin RLS, PWA Security, Secrets, IR, DR, OWASP | 12.6C, 12.6D, 12.7F |
| `docs/admin.md` | Verweis auf admin-web.md | 12.6C |
| `README.md` (Root) | Sprint-Status, Doc-Links | 12.6D–12.7F |

### Sprint-Berichte (Primärquellen)

| Bericht | Sprint |
|---------|--------|
| `SPRINT_12_5_PRODUCTION_VALIDATION_REPORT.md` | 12.5 |
| `SPRINT_12_6A_WEB_FOUNDATION_REPORT.md` | 12.6A |
| `SPRINT_12_6B_NOTIFICATION_CENTER_REPORT.md` | 12.6B |
| `SPRINT_12_6C_ADMIN_WEB_ACCESS_REPORT.md` | 12.6C |
| `SPRINT_12_6D_PWA_RELEASE_REPORT.md` | 12.6D |
| `SPRINT_12_7A_IOS_REPORT.md` | 12.7A |
| `SPRINT_12_7B_BUSINESS_FOUNDATION_REPORT.md` | 12.7B |
| `SPRINT_12_7C_LEGAL_PRIVACY_CONSENT_REPORT.md` | 12.7C |
| `SPRINT_12_7D_ANALYTICS_SEARCH_CONSOLE_SEO_REPORT.md` | 12.7D |
| `SPRINT_12_7E_STORE_PREPARATION_PUBLIC_BETA_REPORT.md` | 12.7E |
| `SPRINT_12_7F_RELEASE_COMPLIANCE_GOVERNANCE_REPORT.md` | 12.7F |

### Bestehende Architektur-Dokumentation (vor 12.5, weiterhin relevant)

| Dokument | Zweck | Status |
|----------|-------|--------|
| `docs/ARCHITECTURE.md` | Stack, Ordnerstruktur, Regeln | Basis (Juli 2026) |
| `docs/backend.md` | Backend-Architektur | Referenz |
| `docs/database.md` | Datenbankschema | Referenz |
| `docs/repository.md` | Repository-Pattern | Referenz |
| `docs/DESIGN_SYSTEM.md` | Design System | Referenz |
| `docs/import-*.md` | Import-Pipeline | Referenz |
| `docs/BUILD_STATUS.md` | Build-Status | Referenz |

---

## Teststatus

### Regressionstests (aktueller Stand)

| Prüfung | Ergebnis | Sprint (letzter Nachweis) |
|---------|----------|---------------------------|
| TypeScript (`typecheck`) | PASS | 12.7F |
| ESLint (`lint`) | PASS (0 Fehler) | 12.7F |
| Unit Tests (`vitest run`) | PASS (214/214) | 12.7D/12.7F |
| `validate:pwa` | PASS | 12.6D |
| `validate:ios` | PASS | 12.7A |
| `validate:seo` | PASS | 12.7D |
| `validate:build-output` | PASS | 12.6D |
| `release:check` (gesamt) | PASS | 12.7F |
| Web Build (`build:web`) | PASS | 12.7D |
| Android `assembleRelease` | PASS | 12.7D |
| Expo Doctor | 19/20 (CNG-Warnung) | Alle Sprints |

### Test-Wachstum über 11 Sprints

```
130 → 140 → 162 → 188 → 194 → 199 → 214 (Endstand)
```

### QA (manuell)

| Test | Status |
|------|--------|
| Browser Deep Links (Admin) | Nicht in CI |
| PWA Install (Android Chrome, iOS Safari) | Nicht ausgeführt |
| Offline-Simulation | Nicht in CI |
| Lighthouse PWA/Performance/SEO | Nicht in CI |
| iOS On-Device QA | Nicht ausgeführt |
| Android On-Device QA | Nicht ausgeführt |
| Token-Manipulation (Security) | Nicht in CI |
| App-Daten löschen (Privacy) | Nicht in CI |

### Performance Reviews

| Review | Ergebnis |
|--------|----------|
| Web Bundle (~3.2 MB) | Akzeptiert für MVP; Optimierung deferred |
| Android APK/AAB | Standard Expo RN Größe |
| iOS IPA | Nicht gemessen (kein EAS Build) |
| Cold Start | Manuell ausstehend |
| API Latency | Supabase-abhängig; nicht gemessen |
| Import Performance (100–500 Records) | Nicht auf Staging getestet |

### Security Reviews

| Review | Sprint | Ergebnis |
|--------|--------|----------|
| RLS Live-Tests (lokal) | 12.5 | PASS |
| Secret Scan (Source + dist) | 12.5, 12.6D | PASS |
| Admin Auth Hardening | 12.6C | Implementiert |
| Security-Privacy Audit | 12.7C | Dokumentiert |
| OWASP Assessment | 12.7F | Low-Med, akzeptabel für Beta |
| Storage Bucket RLS | 12.7C/12.7F | Gap identifiziert |

### Privacy Reviews

| Review | Sprint | Ergebnis |
|--------|--------|----------|
| Dateninventar (14 Tabellen) | 12.7C | Vollständig |
| Third-Party Inventar | 12.7C | Vollständig |
| Consent Architecture | 12.7C/12.7D | Compliant |
| Analytics Privacy Assessment | 12.7D | PASS |
| GDPR Principle Check | 12.7C | Dokumentiert |
| Store Privacy Labels | 12.7C | Vorbereitet |

---

## Risiken

| Risiko | Wahrscheinlichkeit | Impact | Priorität | Mitigation |
|--------|-------------------|--------|-----------|------------|
| Fehlende gehostete Privacy Policy | Hoch | Hoch | **Kritisch** | Rechtstexte hosten vor Store-Submit |
| Keine Remote Supabase-Staging-Validierung | Mittel | Hoch | Hoch | Staging-Instanz + `validate:staging:remote` |
| Manuelle QA nicht durchgeführt | Hoch | Mittel | Hoch | QA-Matrix auf physischen Geräten |
| Store-Rejection (fehlende URLs/Assets) | Hoch (bei jetzigem Submit) | Hoch | Hoch | Legal Pages + Screenshots |
| Supabase Single Point of Failure | Niedrig | Hoch | Hoch | PITR aktivieren + Restore Drill |
| Kein Uptime Monitoring | Mittel | Mittel | Hoch | Vor Go-Live konfigurieren |
| Mock Admin Credentials in Prod | Niedrig | Kritisch | Hoch | `USE_SUPABASE=true` erzwingen |
| RLS Fehlkonfiguration | Niedrig | Kritisch | Hoch | Per-Release RLS-Validierung |
| Storage Bucket RLS Lücken | Mittel | Mittel | Mittel | Policies vor Upload-Aktivierung |
| Map Placeholder verwirrt Nutzer | Mittel | Niedrig | Niedrig | Known Issues dokumentieren |
| Kein Crash Reporting SDK | Mittel | Mittel | Mittel | ASC/Play Vitals für Beta |
| Expo Doctor CNG-Warnung | Bekannt | Niedrig | Niedrig | Dokumentiert, Builds funktionieren |
| `raw_payload` PII in Import Staging | Mittel | Mittel | Mittel | Retention + Review Workflow |

---

## Technische Schulden

### Bekannte Einschränkungen

- Map-Tab ist Placeholder (kein natives Map auf Web/iOS)
- Keine Endnutzer-Accounts → kein Cross-Device Sync
- Web Bundle ~3.2 MB ohne Code-Splitting
- Service Worker deaktiviert auf localhost
- iOS: Kein On-Device QA, kein EAS Cloud Build
- Alt-Texte auf Bildern unvollständig
- Admin Idle Session Timeout fehlt
- Retention-Purge-Jobs nicht automatisiert
- Dynamic Sitemap aus Supabase-Events nicht implementiert
- Analytics Events nicht an alle UI-Aktionen verdrahtet
- Consent-Widerruf in Settings fehlt
- LICENSE, SECURITY.md, GitHub Templates fehlen im Root

### Offene Risiken (technisch)

- Remote Supabase Staging nie validiert
- Storage Upload/Download nie live getestet
- Performance unter Last unbekannt
- Lighthouse/CWV auf Production nicht gemessen
- WCAG 2.1 AA Audit nicht durchgeführt

### Spätere Verbesserungen

| Item | Priorität | Geplanter Sprint |
|------|-----------|------------------|
| CMS Publish Workflow | Hoch | Sprint 13 |
| CRM | Hoch | Sprint 14 |
| Automation | Hoch | Sprint 15 |
| User Accounts, Push, Community | Hoch | Sprint 16 |
| Native Map Implementation | Mittel | TBD |
| Crash Reporting SDK (Sentry) | Mittel | Post-Beta |
| Bundle Size Optimization | Niedrig | TBD |
| Lighthouse in CI | Niedrig | TBD |
| Dedicated OG Image | Niedrig | TBD |
| Admin Session Timeout | Mittel | Security Sprint |
| Automated Retention Purge | Mittel | Operations |

---

## Empfehlungen

### Vor geschlossener Beta (kurzfristig)

1. Apple Developer + Google Play Accounts registrieren
2. Domain registrieren und DNS/HTTPS konfigurieren
3. Rechtstexte (Privacy, Terms, Impressum) mit Anwalt erstellen und hosten
4. `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_URL` setzen
5. Store-Screenshots erstellen (iOS 6.7", Android Phone)
6. Play Feature Graphic (1024×500) erstellen
7. `eas build` für iOS und Android mit Production-Env ausführen
8. Manuelle QA-Matrix auf physischen Geräten durchführen
9. Supabase Staging-Instanz bereitstellen und Remote-Validierung ausführen
10. Interne Beta (1 Woche Soak) vor Closed Beta

### Vor Produktion (mittelfristig)

1. Go/No-Go Sign-offs gemäß `docs/go-live.md` einholen
2. Supabase DPA signieren
3. PITR auf Production Supabase aktivieren
4. Backup-Restore-Drill auf Staging durchführen
5. Uptime Monitoring konfigurieren
6. Google Search Console + Sitemap einreichen
7. Lighthouse Baseline auf Production URL
8. WCAG 2.1 AA Accessibility Audit
9. Admin Idle Timeout implementieren
10. Storage Bucket RLS Policies ergänzen

### Strategisch (Roadmap)

- Sprint 13 (CMS): Content-Management und Publish-Workflow vertiefen
- Sprint 14 (CRM): Partner- und Event-Organizer-Beziehungen
- Sprint 15 (Automation): Import- und Event-Automatisierung
- Sprint 16 (Accounts, Push & Community): Endnutzer-Accounts, Push Notifications, soziale Features

---

## Offene Punkte

### Kritisch (Beta-Blocker)

- [ ] Privacy Policy URL gehostet
- [ ] Impressum gehostet (DE-Markt)
- [ ] Support-URL gehostet
- [ ] Store-Screenshots erstellt
- [ ] Play Feature Graphic erstellt
- [ ] Apple/Google Developer Enrollment
- [ ] EAS Production Builds (iOS + Android)
- [ ] Manuelle Geräte-QA abgeschlossen
- [ ] `ascAppId` in `eas.json` gesetzt

### Hoch (Produktions-Blocker)

- [ ] Go/No-Go Sign-offs eingeholt
- [ ] Supabase DPA signiert
- [ ] PITR auf Production aktiviert
- [ ] Uptime Monitoring konfiguriert
- [ ] Remote Supabase Staging validiert
- [ ] Backup-Restore-Drill durchgeführt
- [ ] Rechtsgrundlage: Juristische Prüfung der Privacy Policy und AGB

### Mittel

- [ ] Legal Page Routes (`/privacy`, `/terms`, `/impressum`) implementieren
- [ ] Analytics Events an UI-Aktionen verdrahten
- [ ] Consent-Widerruf in Profile/Settings
- [ ] Dynamic Sitemap mit Live-Event-IDs
- [ ] Admin Idle Session Timeout
- [ ] Storage Bucket RLS Policies
- [ ] Retention-Purge-Jobs automatisieren
- [ ] Google Search Console registrieren
- [ ] Lighthouse auf Production
- [ ] SVG Logo / Wordmark erstellen

### Niedrig

- [ ] LICENSE Datei im Repository
- [ ] GitHub SECURITY.md, Issue/PR Templates
- [ ] Dedicated OG Image (1200×630)
- [ ] favicon.svg
- [ ] Alt-Text Audit auf allen Bildern
- [ ] Admin Page noindex Meta Tag
- [ ] In-App Feedback Formular

---

## Roadmap

### Abgeschlossen

| Sprint | Name | Ergebnis |
|--------|------|----------|
| 12.5 | Production Validation | PASS WITH ACCEPTED WARNINGS |
| 12.6A | Web Foundation | Responsive Web, Desktop Nav |
| 12.6B | Notification Center | Lokales Notification Center |
| 12.6C | Admin Web Access | Admin Shell, Guards, RLS |
| 12.6D | PWA & Release Hardening | PWA, `release:check` |
| 12.7A | iOS Foundation & TestFlight | iOS Native, EAS, Linking |
| 12.7B | Domain, Email & Brand | Business-Docs |
| 12.7C | Legal, Privacy & Consent | Privacy-Audit, Legal-Strukturen |
| 12.7D | Analytics, SEO | GA4, SEO, Consent Banner |
| 12.7E | Store & Public Beta | Store/Beta-Dokumentation |
| 12.7F | Compliance & Governance | Release Gate, Go/No-Go, Operations |

### Aktueller Stand

**Release Candidate 0.2.0** — alle elf Sprints abgeschlossen. Technische Validierung bestanden. Governance-Freigabe für Produktion ausstehend. Nächster operativer Schritt: Beta-Vorbereitung (Legal Hosting, Store Assets, EAS Builds, Device QA) vor Sprint 13.

### Geplante Sprints

| Sprint | Name | Fokus (erwartet) |
|--------|------|------------------|
| **13** | CMS | Content Management, Publish-Workflow, Admin-Tiefe |
| **14** | CRM | Customer/Partner Relationship Management |
| **15** | Automation | Event- und Import-Automatisierung |
| **16** | Accounts, Push & Community | Endnutzer-Accounts, Push Notifications, Community-Features |

### Abhängigkeiten zwischen Roadmap und aktuellem Stand

- Sprint 13 (CMS) baut auf Admin Web Access (12.6C) und Import-Pipeline auf
- Sprint 16 (Accounts/Push) erfordert Privacy/Consent-Architektur (12.7C/12.7D) und ändert die aktuelle „keine Endnutzer-Accounts"-Architektur fundamental
- Store-Beta kann parallel zu Sprint 13 gestartet werden, sobald kritische Blocker gelöst sind

---

## Anhang: Validierungsbefehle

```bash
cd app-v2
npm install
npm run release:check    # Vollständige Release-Validierung
npm test               # 214 Unit-Tests
npm run build:web      # Web Production Build
npm run validate:ios   # iOS-Konfiguration
npm run generate:seo && npm run validate:seo  # SEO-Dateien
```

---

## Anhang: PR-Referenzen (12.7x)

| Sprint | Branch | PR |
|--------|--------|-----|
| 12.7A | `cursor/sprint-12-7a-ios-4f90` | #32 |
| 12.7B | `cursor/sprint-12-7b-business-foundation-4f90` | #33 |
| 12.7C | `cursor/sprint-12-7c-legal-privacy-consent-4f90` | #34 |
| 12.7D | `cursor/sprint-12-7d-analytics-seo-4f90` | #35 |
| 12.7E | `cursor/sprint-12-7e-store-preparation-public-beta-4f90` | #36 |
| 12.7F | `cursor/sprint-12-7f-release-compliance-governance-4f90` | #37 |

---

*Dieser Bericht wurde ausschließlich aus Sprint-Berichten, Dokumentation und Projektartefakten erstellt. Keine Codeänderungen wurden im Rahmen der Berichterstellung vorgenommen.*
