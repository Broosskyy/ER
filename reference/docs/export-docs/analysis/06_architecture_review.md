# 06 — Architecture Review

**Perspektive:** Senior Software Architect · **Scope:** Eternal Rave MVP → V1  
**Aktualisiert:** Sprint 2 · Juni 2026

---

## Sprint 3 Update

| Bereich | Status |
|---------|--------|
| Event Domain Model (`EventEntity`) | ✅ |
| Event Repository | ✅ |
| Lifecycle transitions enforced | ✅ |
| Draft / Submission / Review services | ✅ |
| Audit + submission history tables | ✅ Migration 006 |
| Automation (RSS/Crawler/AI) | 🔴 Deferred |

## Sprint 2 Update

| Bereich | Status |
|---------|--------|
| Supabase Auth (Email/Password) | ✅ Production path |
| Guest mode | ✅ |
| Password reset + email verify | ✅ Deep links |
| AuthGate / Protected routes | ✅ Admin, Organizer |
| Moderator role (DB) | ✅ Migration 005 |
| OAuth | 🔴 Sprint 3+ |

---

## Sprint 1 Update

**Foundation & Code Alignment** — inkrementelle Anpassungen ohne Breaking Changes.

| Bereich | Änderung | Status |
|---------|----------|--------|
| Design Tokens | `theme.ts` + `tailwind.config.js` sync (warning, mapSurface, Typography, Shadows, ImageGradients) | ✅ |
| Hardcoded Colors | lifecycle, import UI, MapPlaceholder → Tokens/Helpers | ✅ |
| Components | memo + a11y auf EventCard, FeaturedEventCard, FilterChip; Button/Search a11y | ✅ |
| Performance | Tab `lazy: true`; React.memo auf Listen-Karten | ✅ |
| Tech Debt | `submissions.ts` @deprecated (AR-02) | ✅ |
| Version | `package.json` = `app.json` = 1.7.0 | ✅ |
| Lifecycle SSOT | Diagramm korrigiert (Band 4.5) | ✅ |

**Unverändert (bewusst):** God Store, Zustand/Query, Tests, Auth, neue Screens.

---

## Sprint 0 Update

Architecture Decisions sind jetzt formal dokumentiert:

| Artefakt | Pfad |
|----------|------|
| ADR Index | [docs/ADR/README.md](../ADR/README.md) |
| Architecture Rules | [docs/rules/ARCHITECTURE_RULES.md](../rules/ARCHITECTURE_RULES.md) |
| Project Structure | [docs/PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) |
| Project Ready | [docs/PROJECT_READY.md](../PROJECT_READY.md) |

**Accepted:** RN, Expo, Supabase, Bottom Nav, Expo Router, React Context  
**Proposed:** Mapbox, Payments, Analytics

Keine Architektur-Änderungen in Sprint 0 — nur Dokumentation.

---

## 1. Architektur-Stil

**Aktuell:** Layered Monolith in einer Mobile App

```
┌─────────────────────────────────────┐
│  Presentation (app/ + components/)  │
├─────────────────────────────────────┤
│  Application State (hooks/context)  │
├─────────────────────────────────────┤
│  Domain Services (src/services/)    │
├─────────────────────────────────────┤
│  Infrastructure (supabase client)   │
├─────────────────────────────────────┤
│  Demo Fallback (src/data/)          │
└─────────────────────────────────────┘
```

**Bewertung:** ✅ Angemessen für MVP. Skaliert bis ~10k Events / kleines Team.  
**Abweichung Band 3:** Geplant Zustand + TanStack Query — nicht umgesetzt.

---

## 2. Provider-Architektur

```
GestureHandlerRootView
  SafeAreaProvider
    AuthProvider
      EventStoreProvider          ← Monolith (~1050 LOC)
        EventSourceProvider       ← depends on EventStore
          FavoritesProvider       ← depends on publishedEvents
            Stack Navigator
```

### Stärken
- Klare Boot-Reihenfolge
- Favorites abgeleitet aus published feed (Single Source of Truth für Public Events)
- Demo/Live branching zentral in Store

### Schwächen
- **EventStoreProvider** verletzt Single Responsibility (Feed + Admin + Submissions + Imports + Organizer)
- Context value mit 25+ deps → breite Re-Renders
- EventSourceProvider kann nicht unabhängig testen ohne EventStore

### Empfehlung (später, nicht jetzt)
Option A: Store aufteilen in `PublicFeedContext`, `ReviewContext`, `OrganizerContext`  
Option B: TanStack Query für Server-State + minimaler UI-State  
Option C: Zustand slices mit Selektoren

---

## 3. Service Layer

### Aktive Services (von Hooks genutzt)
| Service | Verantwortung |
|---------|---------------|
| `events.ts` | Kern-CRUD, Lifecycle, Published Feed |
| `imports.ts` | URL/Text Import → events table |
| `eventSources.ts` | Managed sources CRUD |
| `sourceImport.ts` | Mock crawl per source |
| `favorites.ts` | Favorites sync |
| `authService.ts` | Auth |
| `profiles.ts` | Profile + report count |

### Tote / Redundante Module
| Modul | Problem |
|-------|---------|
| `submissions.ts` | Legacy `event_submissions` — ungenutzt von Hooks |
| `adminService.ts` | Duplikat von Store-Logik |
| `*Service.ts` facades | Re-exports ohne Consumer |
| `services/index.ts` | Barrel ungenutzt |

### ServiceResult Pattern
```typescript
{ data, error, offline: boolean }
```
✅ Konsistent · Ermöglicht Demo-Modus ohne Exceptions

---

## 4. Datenmodell-Architektur

### Kanonischer Event-Lifecycle (DB — Band 4.5 SSOT)
```
draft → imported_draft → pending_review → needs_review → approved → published
                                                      ↘ rejected, duplicate
```

### Zwei Submission-Pfade (⚠️ Architektur-Schuld)
| Pfad | Tabelle | Status |
|------|---------|--------|
| **Aktiv** | `events` (source_type=user_submission) | ✅ Production path |
| **Legacy** | `event_submissions` (JSON payload) | 🔴 Dead code path |

### Multi-Source Architecture
```
event_sources (managed) → sourceImport → events (imported_draft)
import_sources (audit) ←─────────────────┘
User/Organizer → events (direct)
Admin Review → lifecycle update → published
```

✅ Entspricht Band 4 README und Master Prompt V2 Vision

---

## 5. Dual-Mode Runtime

| Modus | Trigger | Verhalten |
|-------|---------|-----------|
| Demo | Keine EXPO_PUBLIC_SUPABASE_* env | Seeds aus src/data/, Admin offen |
| Live | Env gesetzt | Supabase queries, Auth required für Submissions |
| Fallback | Live + 0 published | Dummy events + Banner |

**Risiko:** Fallback in Production kann leere DB verbergen.

---

## 6. Routing-Architektur

- **File-based Expo Router** — skalierbar für neue Admin/Organizer Screens
- **Tabs lazy: false** — alle 5 Tabs laden beim Start (Performance)
- **Fehlende Guards** — Admin/Organizer nicht server-side geschützt (client-only role check)

### Empfohlene Guard-Strategie (später)
```typescript
// Screen-level HOC oder Layout groups
(admin)/* → requireAdmin()
(organizer)/* → requireOrganizer()
```

---

## 7. TypeScript-Architektur

- `strict: true` ✅
- Domain types (`event.ts`, `lifecycle.ts`) getrennt von DB types (`database.ts`) ✅
- **Gap:** Supabase client untyped — kein generisches `Database` am Client
- **Gap:** `event_sources` nicht in database.ts

---

## 8. Skalierbarkeits-Check (Master Prompt CTO-Test)

| Dimension | 1M Users / 100k Events | Aktueller Stand |
|-----------|--------------------------|-----------------|
| Feed query | Paginated, indexed | ✅ status filter, ⚠️ no pagination |
| List UI | Virtualized | 🔴 ScrollView |
| State | Normalized, cached | 🔴 Denormalized arrays in Context |
| Imports | Queue/Workers | 🔴 Synchronous mock |
| Images | CDN + resize | 🟡 expo-image, external URLs |
| Auth | JWT + RLS | ✅ |

**Urteil:** Architektur trägt MVP + early growth. Vor 100k Events: Pagination + Virtualization + Store split nötig.

---

## 9. Sicherheitsarchitektur

| Bereich | Status |
|---------|--------|
| RLS on Supabase | ✅ Migrationen |
| Client-side role checks | 🟡 Profile.role |
| Admin route protection | 🔴 Demo offen |
| API keys in client | ✅ Anon key only |
| Input validation | 🟡 Form-level, kein Zod |
| Duplicate detection | ✅ Client-side heuristics |

Band 4 Kapitel Security/Compliance: Band 4.5 + 4.6 dokumentieren DSGVO, Missbrauch — Implementierung 🟡

---

## 10. Authentication & Identity (Band 4.6)

**Dokumentiert:** ✅ Vollständig in [Band 4.6](../04.6-authentication-identity/README.md)

| Komponente | Architektur | Code-Status |
|------------|-------------|-------------|
| Supabase Auth | Zentrale IdP, JWT + Refresh | ✅ |
| Rollen (Gast–Admin) | profiles.role + RLS | ✅ user/organizer/admin |
| Email/Password | signUp/signIn | ✅ |
| OAuth (Google/Apple) | Supabase Provider | 🔴 Geplant |
| Session Management | Multi-Device, Secure Storage | 🟡 Default Supabase |
| Organizer Verification | organizers.verification_status | 🟡 DB, 🔴 UI |
| Moderator Role | Dokumentiert | 🔴 Nicht implementiert |
| Admin (intern) | Keine Public Registration | 🟡 Demo offen |

**Architektur-Bewertung:** Auth-Layer ist MVP-tauglich. Vor Skalierung: OAuth, Route Guards, Moderator-Rolle.

**Ops:** [Band 5 Identity Operations](../05-product-operations/14_Identity_Operations.md)

---

## 11. Event Automation (Band 4.5)

**Dokumentiert:** ✅ Vollständig in [Band 4.5](../04.5-event-automation/README.md)

```
Quellen → Import → Pipeline → Confidence → Moderation → Published → Push/Analytics
```

| Komponente | Architektur | Code-Status |
|------------|-------------|-------------|
| Source Manager | event_sources CRUD | ✅ |
| URL/Text Import | Admin Paste | 🟡 Mock Parser |
| Import Pipeline | Normalisierung → Dedup → Score | 🟡 Teilweise |
| Confidence Score | 0–100%, Routing | 🟡 Basis |
| Duplicate Detection | Heuristik + Fuzzy | ✅ |
| Moderation Queue | Admin Review | ✅ |
| RSS/API/Cron | Scheduled Workers | 🔴 |
| KI Agent | Autonome Erkennung | 🔴 Future |
| Auto-Publish | Nie ohne Policy | ✅ Regel eingehalten |

**Architektur-Bewertung:** Multi-Source-Design ist dokumentiert und teilweise implementiert. Bottleneck: synchroner Mock-Import, fehlende Worker-Queue.

**Ops:** [Band 5 Automation Operations](../05-product-operations/13_Automation_Operations.md)

Siehe [AUTOMATION_ARCHITECTURE.md](../04.5-event-automation/AUTOMATION_ARCHITECTURE.md)

---

## 12. Organizer Verification (Band 4.5 + 4.6)

**Dokumentiert:** ✅ Querverweise in Band 4.5 Kap. 08, Band 4.6 Kap. 05, Band 5 Kap. 15

| Aspekt | Architektur | Code-Status |
|--------|-------------|-------------|
| Antrag → Prüfung → Badge | Prozess definiert | 🔴 UI fehlt |
| verification_status | DB-Feld auf organizers | ✅ |
| Confidence Boost | +10–20 für verified | 🟡 Dokumentiert |
| Entzug / Missbrauch | Audit + Ops Runbook | 🔴 |

**Abhängigkeit:** Authentication (Band 4.6) muss vor Verification-UI stabil sein.

**Ops:** [Organizer Verification Operations](../05-product-operations/15_Organizer_Verification_Operations.md)

---

## 13. Architektur vs. Band 0–5 (+ 4.5, 4.6)

| Band | Architektur-Expectation | Match |
|------|-------------------------|-------|
| 0 | Docs structure | ✅ |
| 1 | MVP scope, roles, lifecycle | ✅ |
| 2 | Component reuse, DS tokens | 🟡 → verbessert (Sprint 1) |
| 3 | Zustand, Query, Testing | 🔴 |
| 4 | Supabase, RLS, services | ✅ |
| **4.5** | **Event Automation, Pipeline, Moderation** | **✅ Doku · 🟡 Code** |
| **4.6** | **Auth, Roles, Verification** | **✅ Doku · 🟡 Code** |
| 5 | CI/CD, monitoring, ops | 🟡 Ops-Kapitel 13–15 ✅ |

---

## 14. Architektur-Risiko-Matrix

| ID | Risiko | Impact | Likelihood | Mitigation (Roadmap) |
|----|--------|--------|------------|----------------------|
| AR-01 | God Store | Hoch | Hoch | Sprint 4 — Store split |
| AR-02 | Legacy submissions table | Mittel | Mittel | Sprint 3 — Deprecate |
| AR-03 | No pagination | Hoch | Mittel | Sprint 2 — Feed pagination |
| AR-04 | Untyped Supabase | Mittel | Hoch | Sprint 3 — database.ts sync |
| AR-05 | Admin demo open | Mittel | Niedrig (prod) | Sprint 2 — Route guards |
| AR-06 | No test pyramid | Hoch | Hoch | Sprint 14 — Testing foundation |
| AR-07 | No OAuth / Verification UI | Mittel | Hoch | Sprint 7–8 — Auth + Verification |
| AR-08 | Sync Import / No Workers | Hoch | Mittel | Sprint 15 — Automation Queue |

---

*Architektur ist solide für MVP. Haupthebel: State-Decomposition + Server-State-Library + Tests + dokumentierte Automation/Auth-Meilensteine — ohne Neuimplementierung.*
