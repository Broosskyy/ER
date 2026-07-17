# 01 — Architecture Validation (Sprint 0.5 Audit)

> **Rolle:** Unabhängiger Senior Software Architect · **Stand:** Juni 2026

---

## Audit-Methode

Sprint 0 FINAL wurde **nicht blind vertraut**. Abgleich: Code (read-only) · ADRs · Band 3 · analysis/06 · Band 4.5 Architecture.

---

## Stack-Validierung

| Technologie | Doku | ADR | Code | Urteil |
|-------------|------|-----|------|--------|
| React Native 0.85 | ✅ | ADR-001 | ✅ | ✅ Korrekt |
| Expo SDK 56 | ✅ | ADR-002 | ✅ package.json | ✅ Korrekt |
| TypeScript strict | ✅ | — | ✅ tsconfig | ✅ Korrekt |
| Supabase | ✅ | ADR-003 | ✅ 4 Migrationen | ✅ Korrekt |
| Expo Router | ✅ | ADR-005 | ✅ 27 Screens | ✅ Korrekt |
| 5-Tab Navigation | ✅ | ADR-004 | ✅ | ✅ Korrekt |
| React Context State | ADR-006 | ✅ | ✅ ~1050 LOC Store | ✅ Ist dokumentiert |
| Zustand + TanStack Query | Band 3 Stub | — | 🔴 | ⚠️ **Widerspruch** — Band 3 = Soll, ADR-006 = Ist; ADR gewinnt, Band 3 Stub irreführend |
| Mapbox | ADR-007 Proposed | — | 🔴 Placeholder | ✅ Korrekt als Future |
| Realtime | Band 4 Kap. 06 | — | 🔴 | ⚠️ Stub-Kapitel, kein Plan in Roadmap Sprint 1–8 |
| Edge Functions | Band 4.5 | — | 🔴 | ✅ Future Phase 3+ |
| Push | Band 4.5 Pipeline | — | 🔴 | ✅ Future |
| Payments | ADR-008 Proposed | — | 🔴 | ✅ Future |
| Analytics | ADR-009 Proposed | — | 🔴 | ✅ Future |
| Crash Reporting | BERICHT erwähnt Sentry | — | 🔴 | ❌ **Lücke** — nicht in ADR, nicht in Roadmap |

---

## Navigation & Routing

| Prüfpunkt | Status | Finding |
|-----------|--------|---------|
| File-based Expo Router | ✅ | Skaliert für Admin/Organizer |
| 27 Screens vs. 79 Mockups | 🟡 | ~34% Abdeckung — dokumentiert |
| Tab `lazy: false` | 🔴 | Alle 5 Tabs beim Start — Performance-Risiko (analysis/08) |
| Route Guards Admin | 🔴 | Nur `admin/sources` prüft `isAdmin`; andere Admin-Routen offen |
| Route Guards Organizer | 🔴 | Client-only, nicht server-side |
| `admin/review/edit/[id]` | 🟡 | Datei existiert, nicht in `_layout.tsx` registriert |

**Architektur-Risiko AR-05 bestätigt** — Sprint 0 FINAL unterschätzt Production-Impact.

---

## State Management — Kritische Prüfung

### Ist (ADR-006 Accepted)
```
AuthProvider → EventStoreProvider (1050 LOC) → EventSourceProvider → FavoritesProvider
```

### Auditor-Befund

| Aspekt | Bewertung |
|--------|-----------|
| ADR dokumentiert Limitationen | ✅ Ehrlich |
| Band 3 impliziert Zustand als aktuell | ❌ **Irreführend** für neue Entwickler |
| God Store (TD-01 P0) | ❌ **Bestätigt** — Single Responsibility verletzt |
| 25+ Context deps | ❌ Re-Render-Risiko bei Feed-Updates |
| TanStack Query in Roadmap Sprint 10 | ✅ Sinnvoller Zeitpunkt |

### Bessere Lösung (dokumentiert, nicht sofort umsetzen)

**Option B (empfohlen):** TanStack Query für Server-State + schmaler UI-Context  
**Begründung:** Feed, Favorites, Submissions sind Server-State — Context ist falsches Abstraktionsniveau für Skalierung.  
**Timing:** Sprint 10 nach Test-Baseline (Sprint 14) — Reihenfolge in Roadmap **sollte getauscht werden** (Tests vor Refactor).

⚠️ **Finding QG-ARCH-01:** Sprint 14 (Tests) nach Sprint 10 (Refactor) ist **riskant**. Empfehlung: Tests vor Store-Split.

---

## Backend-Architektur

| Prüfpunkt | Status |
|-----------|--------|
| RLS auf Kern-Tabellen | ✅ |
| ServiceResult Pattern | ✅ |
| Dual-Mode Demo/Live | ✅ |
| Legacy `event_submissions` | 🔴 TD-02 — tot, verwirrend |
| Untyped Supabase Client | 🔴 TD-05 |
| `event_sources` nicht in database.ts | 🔴 Schema drift |

### Lifecycle — WIDERSPRUCH GEFUNDEN

| Quelle | Reihenfolge |
|--------|-------------|
| **analysis/06** §4 | `draft → pending_review → imported_draft → needs_review` |
| **Band 4.5** Kap. 07 | `draft → imported_draft → pending_review → needs_review` |
| **Code + BERICHT** | User Submission → `pending_review`; Import → `imported_draft` |

**Urteil:** Band 4.5 + Code sind **korrekt**. analysis/06 §4 ist **falsch** und muss in Sprint 1 korrigiert werden.

**Finding QG-04:** SSOT für Lifecycle sollte **Band 4.5 Kap. 07** oder dediziertes ADR sein.

---

## Skalierbarkeits-Audit (CTO-Test)

| Dimension | 100 Events | 10k Events | 100k Events |
|-----------|------------|------------|-------------|
| Feed Query | ✅ | 🟡 kein Pagination | 🔴 |
| List UI (ScrollView) | ✅ | 🔴 | 🔴 |
| God Store | ✅ | 🔴 | 🔴 |
| Sync Import | ✅ | 🔴 | 🔴 |
| Auth/RLS | ✅ | ✅ | 🟡 |

**Urteil:** Architektur trägt MVP. Sprint 0 FINAL „72% Health" ist für **Skalierung** optimistisch (~52%).

---

## Event Automation — Architektur-Sinnhaftigkeit

| Aspekt | Technisch | Organisatorisch | Langfristig |
|--------|-----------|-----------------|-------------|
| Pipeline-Design | ✅ Sinnvoll | ✅ Moderation-Pflicht | ✅ |
| Confidence vor Moderation | ✅ | ✅ Admin-Entlastung | ✅ |
| Kein Auto-Publish MVP | ✅ | ✅ Vertrauen | ✅ |
| KI Agent Phase 6 | 🟡 API-Kosten ungeplant | 🟡 Moderator-Kapazität | ✅ |
| Client-side Dedup only | 🟡 OK MVP | — | 🔴 Server-side nötig ab Scale |

**Finding QG-AUTO-ARCH:** Duplicate Detection nur client-side — bei Multi-Admin und Cron **Race Conditions** möglich. Server-side Dedup in Sprint 9/15 planen.

---

## Storage & Offline

| Aspekt | Status |
|--------|--------|
| AsyncStorage (Auth Session) | ✅ |
| Demo Seeds (src/data/) | ✅ |
| Offline Queue für Submissions | 🔴 |
| Image Cache (expo-image) | 🟡 |

---

## Architektur-Score

| Kategorie | Score | Anmerkung |
|-----------|-------|-----------|
| MVP-Tauglichkeit | 82% | Funktioniert |
| Dokumentations-Kohärenz | 68% | Lifecycle-Widerspruch |
| Skalierbarkeit | 52% | Bekannt, unterpriorisiert |
| Sicherheits-Architektur | 65% | RLS ja, Guards nein |
| Zukunftsfähigkeit | 75% | ADRs + Roadmap vorhanden |

---

## Empfohlene Korrekturen (Sprint 1 — Docs only)

1. analysis/06 Lifecycle-Diagramm korrigieren
2. Band 3 State-Kapitel: „Ist: Context (ADR-006), Soll: Query" explizit
3. ADR-010 Crash Reporting (Proposed) erstellen
4. Roadmap: Sprint 14 vor Sprint 10 prüfen
5. Lifecycle SSOT in Band 0 Master Index verlinken

---

## Referenzen

- [ADR/](../ADR/README.md)
- [analysis/06_architecture_review.md](../analysis/06_architecture_review.md)
- [04.5-event-automation/AUTOMATION_ARCHITECTURE.md](../04.5-event-automation/AUTOMATION_ARCHITECTURE.md)
