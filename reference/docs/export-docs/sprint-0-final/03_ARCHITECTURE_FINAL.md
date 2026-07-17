# 03 — Architecture Final (Sprint 0 FINAL)

> **Perspektive:** Senior Software Architect · **Scope:** MVP → V1 Foundation

---

## 1. System-Übersicht

```
┌──────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo SDK 56)                   │
│  app/ (27 Screens) · src/components/ (36) · src/hooks/ (7)   │
├──────────────────────────────────────────────────────────────┤
│  AuthProvider → EventStoreProvider → EventSourceProvider     │
│              → FavoritesProvider                              │
├──────────────────────────────────────────────────────────────┤
│  src/services/ (15 Module) · ServiceResult<T> Pattern        │
├──────────────────────────────────────────────────────────────┤
│  Supabase JS Client · AsyncStorage Session Persistence       │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                    SUPABASE (BaaS)                            │
│  Auth (JWT) · PostgreSQL · RLS · 4 Migrationen               │
│  Future: Realtime · Edge Functions · Storage CDN             │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Technologie-Stack (Final)

| Layer | Technologie | ADR | Status |
|-------|-------------|-----|--------|
| Mobile Framework | React Native 0.85 | ADR-001 | ✅ Accepted |
| Runtime / Build | Expo SDK 56 | ADR-002 | ✅ Accepted |
| Language | TypeScript strict | — | ✅ |
| Styling | NativeWind + theme.ts | — | ✅ |
| Navigation | Expo Router (file-based) | ADR-005 | ✅ Accepted |
| Tab Navigation | 5 Tabs (Home, Events, Map, Saved, Profile) | ADR-004 | ✅ Accepted |
| Backend | Supabase (PostgreSQL + Auth) | ADR-003 | ✅ Accepted |
| State (Ist) | React Context | ADR-006 | ✅ Accepted |
| State (Soll Band 3) | Zustand + TanStack Query | — | 🔴 Future |
| Maps (Soll) | Mapbox | ADR-007 | 🔴 Proposed |
| Payments (Soll) | Stripe / IAP | ADR-008 | 🔴 Proposed |
| Analytics (Soll) | Firebase / Amplitude | ADR-009 | 🔴 Proposed |

---

## 3. Navigation & Routing

### Tab-Struktur
- `/(tabs)/home` · `search` · `map` · `favorites` · `profile`

### Stack-Routen (Auszug)
- Auth: `/login`, `/register`
- Consumer: `/event/[id]`, `/add-event`, `/my-submissions`
- Organizer: `/organizer/*` (4 Screens)
- Admin: `/admin/*` (10+ Screens)

### Architektur-Lücken
- 🔴 Keine Route Guards (Admin in Demo offen)
- 🟡 `admin/review/edit/[id]` nicht explizit in `_layout.tsx`
- 🔴 Tabs `lazy: false` — Performance-Risiko

---

## 4. State Management

### Ist-Architektur (Accepted ADR-006)
```
AuthProvider (useAuth)
  └── EventStoreProvider (~1050 LOC) — Feed, Admin, Imports, Organizer
        └── EventSourceProvider — Managed Sources
              └── FavoritesProvider — abgeleitet aus publishedEvents
```

### Bekannte Schuld (TD-01 P0)
Monolithischer EventStore — dokumentiert in analysis/09, Mitigation Sprint 10.

### Soll-Architektur (Band 3, nicht implementiert)
- Zustand Slices oder TanStack Query für Server-State
- Minimaler UI-State in Context

---

## 5. Backend-Architektur

### Supabase Schema (4 Migrationen)
- `001` — Schema, Auth, RLS, profiles, events, organizers
- `002` — event_sources (Source Manager)
- `003` — User Submission RLS
- `004` — Duplicate Warning Events

### Event Lifecycle
```
draft → imported_draft → pending_review → needs_review
  → approved → published → updated → archived → deleted
```
**Public Feed:** nur `lifecycle_status = published`

### Dual-Mode Runtime
| Modus | Trigger | Verhalten |
|-------|---------|-----------|
| Demo | Keine Supabase Env | src/data/ Seeds |
| Live | Env gesetzt | Supabase + Auth |
| Fallback | Live, 0 published | Dummy + Banner |

---

## 6. Event Automation (Band 4.5)

```
Quellen → Import → Normalisierung → KI → Geocoding → Dedup
  → Confidence → Moderation → Published → Push → Analytics
```

| Komponente | Code | Doku |
|------------|------|------|
| Source Manager | ✅ | ✅ |
| URL/Text Import | 🟡 Mock | ✅ |
| Duplicate Detection | ✅ | ✅ |
| Confidence Score | 🟡 | ✅ |
| Moderation Queue | ✅ | ✅ |
| Cron / Workers | 🔴 | ✅ |
| KI Agent | 🔴 | ✅ |

---

## 7. Authentication (Band 4.6)

```
App → Supabase Auth → JWT + Refresh → profiles (RLS) → role
```

| Feature | Code | Doku |
|---------|------|------|
| Email/Password | ✅ | ✅ |
| Gastmodus | ✅ | ✅ |
| JWT / Session | ✅ | ✅ |
| Google / Apple OAuth | 🔴 | ✅ Roadmap |
| Organizer Verification UI | 🔴 | ✅ |
| Moderator Role | 🔴 | ✅ |
| MFA / Passkeys | 🔴 | ✅ Future |

---

## 8. Cross-Cutting Concerns

| Concern | Status | Referenz |
|---------|--------|----------|
| **Storage** | AsyncStorage (Auth) | Supabase Client |
| **Realtime** | 🔴 Nicht genutzt | Band 4 Kap. 06 |
| **Edge Functions** | 🔴 | Band 4.5 Phase 3+ |
| **Analytics** | 🔴 | ADR-009 Proposed |
| **Push** | 🔴 | Band 4.5 Pipeline |
| **Maps** | Placeholder | ADR-007 Proposed |
| **Payments** | 🔴 | ADR-008 Proposed |
| **Images** | expo-image + URLs | 🟡 Kein CDN |
| **i18n** | EN only | Band 1 DE geplant |

---

## 9. Sicherheitsarchitektur

| Bereich | Status |
|---------|--------|
| RLS (Supabase) | ✅ |
| JWT Auth | ✅ |
| Client role checks | 🟡 UX only |
| Admin route protection | 🔴 |
| Rate Limiting | 🟡 Supabase built-in |
| DSGVO / Privacy | 🔴 Policy fehlt |
| Input Validation | 🟡 Form-level |

---

## 10. Skalierbarkeits-Urteil

| Dimension | MVP (<1k Events) | Growth (100k Events) |
|-----------|------------------|----------------------|
| Feed | ✅ Funktioniert | 🔴 Pagination + Virtualization nötig |
| State | ✅ | 🔴 Store split nötig |
| Imports | ✅ Manual | 🔴 Worker Queue nötig |
| Auth | ✅ | 🟡 OAuth + MFA |
| DB | ✅ Indexed basics | 🟡 Query optimization |

**Urteil:** Architektur trägt MVP und Early Growth. Dokumentierte Meilensteine definieren Skalierungspfad.

---

## 11. Strategische Meilenstein-Kette

```
Authentication → Organizer Verification → Event Automation
  → AI Automation → Monitoring
```

Siehe [analysis/10_migration_roadmap.md](../analysis/10_migration_roadmap.md)

---

## 12. ADR-Index (Final)

| ADR | Entscheidung | Status |
|-----|--------------|--------|
| 001 | React Native | Accepted |
| 002 | Expo SDK 56 | Accepted |
| 003 | Supabase BaaS | Accepted |
| 004 | 5-Tab Navigation | Accepted |
| 005 | Expo Router | Accepted |
| 006 | React Context State | Accepted |
| 007 | Mapbox (Future) | Proposed |
| 008 | Payments (Future) | Proposed |
| 009 | Analytics (Future) | Proposed |

Pfad: [docs/ADR/](../ADR/README.md)

---

*Architektur Final — Stand Sprint 0 FINAL, Juni 2026.*
