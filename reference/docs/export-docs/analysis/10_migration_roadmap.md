# 10 — Migration Roadmap (Sprint-Plan)

**Prinzip:** Bestehenden Code erhalten · Inkrementell annähern · Mockups + Band 0–5 (+ 4.5, 4.6) als Zielbild  
**Aufwand:** S (klein) · M (mittel) · L (groß) · XL (sehr groß) — **keine Kalender-Schätzung**  
**Stand Codebase:** v1.7.0 · Expo SDK 56 · Supabase Sprint 2.x abgeschlossen

---

## Strategische Meilensteine (Band 4.5 / 4.6)

Langfristige Architektur- und Produkt-Meilensteine in dokumentierter Reihenfolge:

```
Authentication
  ↓
Organizer Verification
  ↓
Event Automation
  ↓
AI Automation
  ↓
Monitoring
```

| Meilenstein | Band | Sprint-Zuordnung | Status Doku | Status Code |
|-------------|------|------------------|---------------|-------------|
| **Authentication** | 4.6 | Sprint 7 (OAuth), laufend | ✅ | 🟡 Email only |
| **Organizer Verification** | 4.6 + 4.5 | Sprint 7–8 | ✅ | 🔴 UI fehlt |
| **Event Automation** | 4.5 | Sprint 9, 15 | ✅ | 🟡 Manual Import |
| **AI Automation** | 4.5 Phase 5–6 | Post-V1 | ✅ | 🔴 |
| **Monitoring** | 4.5 + 5 | Sprint 15+ | ✅ | 🔴 |

**Referenz:** [Band 4.5 Roadmap](../04.5-event-automation/12_Roadmap.md) · [Band 4.6 Roadmap](../04.6-authentication-identity/09_Roadmap.md)

---

## Übersicht

| Sprint | Ziel | Priorität | Aufwand |
|--------|------|-----------|---------|
| 1 | Dokumentation & Baseline | P0 | S |
| 2 | UI Quick Wins (Mockup-Annäherung) | P0 | M |
| 3 | Home Discovery & Location | P0 | M |
| 4 | Performance Foundation | P0 | M |
| 5 | Type Safety & Schema Sync | P1 | M |
| 6 | Mapbox Integration | P1 | L |
| 7 | Organizer Supabase Vollständig | P1 | L |
| 8 | Admin Completion (Reports, Guards) | P1 | M |
| 9 | Import V2 (URL Fetch) | P1 | L |
| 10 | State Architecture Refactor | P1 | XL |
| 11 | Design System Tokens | P2 | M |
| 12 | Onboarding & Settings | P2 | M |
| 13 | Accessibility Baseline | P1 | M |
| 14 | Testing Foundation | P0 | L |
| 15 | Automation & Cron (V2) | P2 | XL |
| 16 | V1 Launch (Play Store) | P0 | L |

---

## Sprint 1 — Dokumentation & Baseline

| Feld | Inhalt |
|------|--------|
| **Ziel** | Analyse-Paket verankern; veraltete Docs korrigieren; Mockup-Index pflegen |
| **Priorität** | P0 |
| **Aufwand** | S |
| **Risiko** | Niedrig |
| **Abhängigkeiten** | Keine (dieses Analyse-Paket) |

**Deliverables:**
- `docs/analysis/*` (01–10) ✅
- Band 4.5 + 4.6 Integration ✅ — siehe [BAND-4-5-4-6-INTEGRATION-BERICHT.md](./BAND-4-5-4-6-INTEGRATION-BERICHT.md)
- MOCKUP-SCREENS.md: Result Count, Submission Tabs korrigieren
- MOCKUP-ALIGNMENT.md auf v1.7.0 aktualisieren
- package.json Version sync mit app.json

**Kein App-Code** außer ggf. Version bump.

---

## Sprint 2 — UI Quick Wins

| Feld | Inhalt |
|------|--------|
| **Ziel** | Niedrig-Risiko Mockup-Gaps schließen ohne Architektur-Änderung |
| **Priorität** | P0 |
| **Aufwand** | M |
| **Risiko** | Niedrig |
| **Abhängigkeiten** | Sprint 1 |

**Features:**
- Share-Button auf Event Detail (expo-sharing)
- Verified Badge konsistent auf EventCard + Detail
- Profile Stats Row: Favorites · Submissions · Visited (Visited = 0 oder placeholder)
- Notification Bell Icon auf Home (UI only, kein Screen)
- DE Copy optional oder i18n-Vorbereitung (strings.ts)

**Betroffene Dateien:** `event/[id].tsx`, `EventCard.tsx`, `profile.tsx`, `home.tsx`

---

## Sprint 3 — Home Discovery & Location

| Feld | Inhalt |
|------|--------|
| **Ziel** | MVP-Kernfrage „near me" glaubwürdig machen |
| **Priorität** | P0 |
| **Aufwand** | M |
| **Risiko** | Mittel (Permissions) |
| **Abhängigkeiten** | Sprint 2 |

**Features:**
- expo-location Integration
- Dynamische Stadt-Anzeige statt hardcoded Hamburg
- Echte Distanz-Berechnung (Haversine) statt CITY_DISTANCE_KM
- Trending-Sektion auf Home (Algorithmus: popular by favorites oder date proximity)
- Popular Organizers horizontal scroll
- Genre-Filter-Chips auf Home (Mockup 09)

**Betroffene Dateien:** `home.tsx`, `theme.ts` (AppConfig), `eventMappers.ts`, `utils/format.ts`

---

## Sprint 4 — Performance Foundation

| Feld | Inhalt |
|------|--------|
| **Ziel** | Listen skalierbar machen; Tab-Start optimieren |
| **Priorität** | P0 |
| **Aufwand** | M |
| **Risiko** | Mittel (Regression Layout) |
| **Abhängigkeiten** | Keine harte — parallel zu Sprint 3 möglich |

**Features:**
- FlashList auf search + favorites (+ home sections)
- `React.memo(EventCard)` + Favorites entkoppeln (TD-08)
- Tab `lazy: true`
- Feed Pagination (limit 20, load more)

**Betroffene Dateien:** `search.tsx`, `favorites.tsx`, `home.tsx`, `EventCard.tsx`, `events.ts` service

---

## Sprint 5 — Type Safety & Schema Sync

| Feld | Inhalt |
|------|--------|
| **Ziel** | database.ts vollständig; typed Supabase client |
| **Priorität** | P1 |
| **Aufwand** | M |
| **Risiko** | Niedrig |
| **Abhängigkeiten** | Keine |

**Features:**
- event_sources in database.ts
- event_source_id auf EventRow
- createClient<Database>()
- Deprecation-Kommentare auf submissions.ts

**Betroffene Dateien:** `database.ts`, `client.ts`, `eventSources.ts`

---

## Sprint 6 — Mapbox Integration

| Feld | Inhalt |
|------|--------|
| **Ziel** | Mockup 12 + Detail Map Preview (Mockup 11) |
| **Priorität** | P1 |
| **Aufwand** | L |
| **Risiko** | Hoch (Native deps, API keys, APK size) |
| **Abhängigkeiten** | Sprint 3 (Location) |

**Features:**
- @rnmapbox/maps oder expo-kompatible Alternative
- Event Pins + Cluster
- User Location Dot
- MapBottomSheet bei Pin-Tap
- LocationPreview Mini-Map auf Detail

**Betroffene Dateien:** `map.tsx`, `MapPlaceholder.tsx` → `EventMap.tsx`, `LocationPreview.tsx`, `app.json` plugins

---

## Sprint 7 — Organizer Supabase Vollständig

| Feld | Inhalt |
|------|--------|
| **Ziel** | Organizer Flow vollständig remote; Mockups 20–32 |
| **Priorität** | P1 |
| **Aufwand** | L |
| **Risiko** | Mittel |
| **Abhängigkeiten** | Sprint 5 |

**Features:**
- Organizer CRUD vollständig über Supabase (kein local-only draft)
- Draft → Pending → Published ohne Admin-Zwang wo sinnvoll
- Multi-Step Create/Edit Wizard (Mockups 21, 26–30)
- Echte Organizer Stats statt hardcoded

**Betroffene Dateien:** `organizer/*.tsx`, `useEventStore.tsx`, `events.ts`

---

## Sprint 8 — Admin Completion

| Feld | Inhalt |
|------|--------|
| **Ziel** | Admin Mockups 46–48; Route Security |
| **Priorität** | P1 |
| **Aufwand** | M |
| **Risiko** | Mittel |
| **Abhängigkeiten** | Sprint 5 |

**Features:**
- Reports Screen (Mockup 46) — reports Tabelle
- Route Guards admin/* (requireAdmin)
- Organizer Verification UI (Mockup 50)
- Merge Duplicate implementieren (TD-19)
- adminService in Store nutzen (TD-04)

**Betroffene Dateien:** neue `app/admin/reports.tsx`, `_layout.tsx`, `DuplicateWarningBanner.tsx`

---

## Sprint 9 — Import V2 (URL Fetch)

| Feld | Inhalt |
|------|--------|
| **Ziel** | V2 Foundation — echtes URL-Fetching |
| **Priorität** | P1 |
| **Aufwand** | L |
| **Risiko** | Hoch (Scraping, Legal, Rate limits) |
| **Abhängigkeiten** | Sprint 8 |

**Features:**
- Supabase Edge Function für URL fetch
- robots.txt Respekt
- Auto Duplicate Scan vor Review Queue
- Flyer Upload → Supabase Storage

**Betroffene Dateien:** `imports.ts`, `urlImporterMock.ts` → real parser, neue edge function

---

## Sprint 10 — State Architecture Refactor

| Feld | Inhalt |
|------|--------|
| **Ziel** | TD-01 lösen ohne Feature-Break |
| **Priorität** | P1 |
| **Aufwand** | XL |
| **Risiko** | Hoch |
| **Abhängigkeiten** | Sprint 4, 14 (Tests!) |

**Optionen (Entscheidung im Sprint):**
- A) Context split: PublicFeed / Review / Organizer
- B) TanStack Query für Server State + minimal UI state
- C) Zustand slices

**Regel:** Bestehende Hook-API (`useEventStore`) als Facade behalten während Migration.

---

## Sprint 11 — Design System Tokens

| Feld | Inhalt |
|------|--------|
| **Ziel** | Mockups 62–69 als Code-Tokens |
| **Priorität** | P2 |
| **Aufwand** | M |
| **Risiko** | Niedrig |
| **Abhängigkeiten** | Sprint 2 |

**Features:**
- Typography scale in theme.ts
- Colors.warning (#F59E0B)
- Elevation/shadow tokens
- Icon size constants
- assets/design-system/ mit exportierten Specs

---

## Sprint 12 — Onboarding & Settings

| Feld | Inhalt |
|------|--------|
| **Ziel** | Mockups 03–06, 19, 51 |
| **Priorität** | P2 |
| **Aufwand** | M |
| **Risiko** | Niedrig |
| **Abhängigkeiten** | Sprint 2 |

**Features:**
- 4-Slide Onboarding (first launch)
- Settings Screen (Notifications, Language, Appearance)
- Help & Support Screen

---

## Sprint 13 — Accessibility Baseline

| Feld | Inhalt |
|------|--------|
| **Ziel** | Mockup 79 — Minimum Viable A11y |
| **Priorität** | P1 |
| **Aufwand** | M |
| **Risiko** | Niedrig |
| **Abhängigkeiten** | Sprint 2 |

**Features:**
- accessibilityLabel auf alle icon buttons
- FormField error announcements
- accessibilityRole="header" auf SectionHeader
- Reduce motion check für Reanimated
- Touch target audit

---

## Sprint 14 — Testing Foundation

| Feld | Inhalt |
|------|--------|
| **Ziel** | TD-14 — Regression-Schutz |
| **Priorität** | P0 |
| **Aufwand** | L |
| **Risiko** | Mittel (CI Setup) |
| **Abhängigkeiten** | Sprint 1 |

**Features:**
- Jest + React Native Testing Library
- Unit: duplicateDetection, format, eventMappers, lifecycleMap
- Integration: events service (mocked Supabase)
- E2E: Detox oder Maestro (1 critical path: browse → detail → favorite)
- CI typecheck + test in GitHub Actions

---

## Sprint 15 — Automation & Cron (V2)

| Feld | Inhalt |
|------|--------|
| **Ziel** | Band 4 + Master Prompt V2 Auto-Discovery |
| **Priorität** | P2 |
| **Aufwand** | XL |
| **Risiko** | Hoch |
| **Abhängigkeiten** | Sprint 9 |

**Features:**
- Supabase pg_cron oder Edge Function Scheduler
- event_sources.last_sync automatisch
- Import → Review → Publish (nie auto-publish)
- Monitoring/Alerting Stub → real (Band 5)

---

## Sprint 16 — V1 Launch

| Feld | Inhalt |
|------|--------|
| **Ziel** | Band 5 — Public Release |
| **Priorität** | P0 |
| **Aufwand** | L |
| **Risiko** | Mittel |
| **Abhängigkeiten** | Sprint 3, 4, 6, 8, 13, 14 |

**Features:**
- Play Store Listing + AAB (arm64)
- Privacy Policy + Impressum
- Analytics (Firebase/PostHog minimal)
- Push Notifications Basis (Expo Notifications)
- APK-Größe Optimierung (~40MB)
- Production: Dummy Fallback deaktivieren (TD-09)

---

## Abhängigkeits-Diagramm (vereinfacht)

```
Sprint 1 (Docs)
    ↓
Sprint 2 (UI Quick Wins) ──→ Sprint 11 (DS Tokens)
    ↓              ↓
Sprint 3 (Location)  Sprint 12 (Onboarding)
    ↓
Sprint 6 (Mapbox)

Sprint 4 (Perf) ──→ Sprint 10 (State Refactor)
                         ↑
Sprint 14 (Tests) ───────┘

Sprint 5 (Types) ──→ Sprint 7 (Organizer + Auth OAuth) ──→ Sprint 8 (Admin + Verification)
                                                    ↓
                                              Sprint 9 (Import V2)
                                                    ↓
                                              Sprint 15 (Automation + Monitoring)

Meilenstein-Kette (Doku):
Authentication → Organizer Verification → Event Automation → AI Automation → Monitoring

Sprint 13 (A11y) ──┐
Sprint 14 (Tests) ─┼──→ Sprint 16 (V1 Launch)
Sprint 3,4,6,8 ────┘
```

---

## Entscheidungspunkt — Erster Entwicklungsschritt

**Empfohlen nach dieser Analyse:**

> **Sprint 2 (UI Quick Wins)** — maximaler Mockup-Impact bei minimalem Architektur-Risiko.

Alternative wenn Performance dringend: **Sprint 4 parallel zu Sprint 2**.

**Nicht empfohlen als Erstschritt:** Sprint 10 (State Refactor) oder Sprint 6 (Mapbox) — zu invasiv ohne Test-Baseline.

---

## Referenzen

- Analyse: `docs/analysis/01` – `09`
- Zielbild: `docs/01-product-vision/MASTER-PROMPT-v3.0.md`
- Mockups: `docs/analysis/02_mockup_index.md`
- Schulden: `docs/analysis/09_technical_debt.md`

---

*Roadmap erstellt ohne Codeänderungen. Bereit für gemeinsame Sprint-Entscheidung.*
