# 09 — Technical Debt Register

**Methodik:** Statische Code-Analyse + Abgleich Band 0–5 + Mockups  
**Priorität:** P0 (kritisch) · P1 (hoch) · P2 (mittel) · P3 (niedrig)

---

## TD-01 · Monolithischer EventStore
| Feld | Wert |
|------|------|
| **ID** | TD-01 |
| **Priorität** | P0 |
| **Ort** | `src/hooks/useEventStore.tsx` (~1050 LOC) |
| **Beschreibung** | Ein Context verwaltet Public Feed, User Submissions, Imports, Organizer Drafts, Admin Stats, Duplicate Orchestration |
| **Impact** | Re-Render-Kaskaden, schwer testbar, hohe Merge-Konflikt-Gefahr |
| **Empfehlung** | Inkrementelle Aufspaltung oder TanStack Query Migration |
| **Nicht löschen** | Bestehende API nach außen stabil halten während Refactor |

---

## TD-02 · Legacy event_submissions Pfad
| Feld | Wert |
|------|------|
| **ID** | TD-02 |
| **Priorität** | P1 |
| **Ort** | `src/services/submissions.ts`, `event_submissions` Tabelle, `adminService.ts` |
| **Beschreibung** | Aktiver Code nutzt `events` Tabelle für Submissions; Legacy-Tabelle und Service ungenutzt |
| **Impact** | Verwirrung, Schema-Bloat, falsche Annahmen bei neuen Entwicklern |
| **Empfehlung** | Deprecation-Kommentar → später Migration/Entfernung mit DB-Migration |

---

## TD-03 · Ungenutzte Service Facades
| Feld | Wert |
|------|------|
| **ID** | TD-03 |
| **Priorität** | P2 |
| **Ort** | `eventService.ts`, `submissionService.ts`, `favoriteService.ts`, `importService.ts`, `services/index.ts` |
| **Beschreibung** | Sprint 2.0 Re-Export-Layer ohne Consumer |
| **Impact** | Naming-Verwirrung, tote Imports |
| **Empfehlung** | Entweder Hooks auf Facades umstellen ODER Facades entfernen (Breaking: nein — nur Cleanup) |

---

## TD-04 · adminService Orphan
| Feld | Wert |
|------|------|
| **ID** | TD-04 |
| **Priorität** | P2 |
| **Ort** | `src/services/adminService.ts` |
| **Beschreibung** | Vollständige Admin-API, aber useEventStore dupliziert alles |
| **Impact** | Doppelte Wartung |
| **Empfehlung** | Store soll adminService aufrufen statt events.ts direkt |

---

## TD-05 · database.ts Schema Drift
| Feld | Wert |
|------|------|
| **ID** | TD-05 |
| **Priorität** | P1 |
| **Ort** | `src/types/database.ts` vs. `supabase/migrations/002` |
| **Beschreibung** | `event_sources` Tabelle fehlt in Database type; `event_source_id` auf events fehlt |
| **Impact** | Untyped queries, Runtime-Fehler bei Refactors |
| **Empfehlung** | database.ts synchronisieren; Supabase client typisieren |

---

## TD-06 · Untyped Supabase Client
| Feld | Wert |
|------|------|
| **ID** | TD-06 |
| **Priorität** | P1 |
| **Ort** | `src/lib/supabase/client.ts` |
| **Beschreibung** | `createClient()` ohne `Database` generic |
| **Impact** | Kein compile-time Schema check |
| **Empfehlung** | `createClient<Database>(...)` nach TD-05 |

---

## TD-07 · ScrollView statt Virtualisierung
| Feld | Wert |
|------|------|
| **ID** | TD-07 |
| **Priorität** | P0 |
| **Ort** | home, search, favorites, review-events, organizer |
| **Beschreibung** | Alle Event-Listen via ScrollView.map() |
| **Impact** | Jank + Memory bei großen Listen |
| **Empfehlung** | FlashList schrittweise pro Screen |

---

## TD-08 · EventCard + useFavorites Kopplung
| Feld | Wert |
|------|------|
| **ID** | TD-08 |
| **Priorität** | P1 |
| **Ort** | `src/components/EventCard.tsx` |
| **Beschreibung** | Card subscribed auf Favorites Context |
| **Impact** | O(n) re-renders bei Toggle |
| **Empfehlung** | isFavorite + onToggle als Props |

---

## TD-09 · Dummy Fallback in Production
| Feld | Wert |
|------|------|
| **ID** | TD-09 |
| **Priorität** | P1 |
| **Ort** | `useEventStore.tsx` usingDummyFallback |
| **Beschreibung** | 0 published events → zeigt Demo-Daten ohne klaren Dev-only Gate |
| **Impact** | Falsche Events in Prod |
| **Empfehlung** | Fallback nur wenn !isSupabaseConfigured \|\| __DEV__ |

---

## TD-10 · Admin Routes ungeschützt
| Feld | Wert |
|------|------|
| **ID** | TD-10 |
| **Priorität** | P1 |
| **Ort** | `app/admin*.tsx` |
| **Beschreibung** | Demo-Modus: Admin ohne Login; Remote: meist kein Screen-Guard |
| **Impact** | Unauthorized Admin UI access |
| **Empfehlung** | requireAdmin HOC; Demo explizit labeln |

---

## TD-11 · Hardcoded UI Data
| Feld | Wert |
|------|------|
| **ID** | TD-11 |
| **Priorität** | P2 |
| **Ort** | profile.tsx (Following: 3), organizer.tsx (Views 1.2k), useEventStore (organizers: 5) |
| **Beschreibung** | Mock-Zahlen in Production UI |
| **Impact** | UX-Vertrauen |
| **Empfehlung** | Echte Queries oder „—“ placeholder |

---

## TD-12 · Dual Source Type Systems
| Feld | Wert |
|------|------|
| **ID** | TD-12 |
| **Priorität** | P2 |
| **Ort** | `lifecycle.ts` ImportSource vs. `eventSource.ts` EventSourceType |
| **Beschreibung** | Zwei Enums + mapEventSourceTypeToLegacyImport() |
| **Impact** | Mapping-Bugs bei neuen Source-Typen |
| **Empfehlung** | Ein kanonisches Enum + Adapter |

---

## TD-13 · Hardcoded Warning Color
| Feld | Wert |
|------|------|
| **ID** | TD-13 |
| **Priorität** | P3 |
| **Ort** | lifecycle.ts, DuplicateWarningBanner, ImportPreviewCard |
| **Beschreibung** | #F59E0B nicht in theme.ts |
| **Impact** | Design-Inkonsistenz |
| **Empfehlung** | Colors.warning Token |

---

## TD-14 · Keine Tests
| Feld | Wert |
|------|------|
| **ID** | TD-14 |
| **Priorität** | P0 |
| **Ort** | Gesamtprojekt |
| **Beschreibung** | 0 Unit/Integration/E2E Tests trotz Test-Strategy Stub |
| **Impact** | Regression bei jedem Sprint |
| **Empfehlung** | duplicateDetection + format utils + mappers zuerst testen |

---

## TD-15 · Dokumentation veraltet
| Feld | Wert |
|------|------|
| **ID** | TD-15 |
| **Priorität** | P2 |
| **Ort** | MOCKUP-SCREENS.md, MOCKUP-ALIGNMENT.md, package.json version |
| **Beschreibung** | Behauptet fehlende Features die existieren; Versions-Mismatch |
| **Impact** | Falsche Sprint-Planung |
| **Empfehlung** | Docs-Sync Sprint (kein Code) |

---

## TD-16 · URL Import Mock
| Feld | Wert |
|------|------|
| **ID** | TD-16 |
| **Priorität** | P1 (V2 Feature) |
| **Ort** | `src/utils/urlImporterMock.ts` |
| **Beschreibung** | Kein HTTP fetch, heuristische Parsing only |
| **Impact** | V2 Auto-Discovery blockiert |
| **Empfehlung** | Edge Function + Import Queue |

---

## TD-17 · Map Placeholder
| Feld | Wert |
|------|------|
| **ID** | TD-17 |
| **Priorität** | P1 |
| **Ort** | MapPlaceholder, map.tsx |
| **Beschreibung** | Kein Map SDK |
| **Impact** | MVP Mockup 12 nicht erfüllt |
| **Empfehlung** | Mapbox Sprint |

---

## TD-18 · Accessibility Debt
| Feld | Wert |
|------|------|
| **ID** | TD-18 |
| **Priorität** | P1 |
| **Ort** | Gesamt-UI |
| **Beschreibung** | ~4 accessibilityLabel im ganzen Projekt |
| **Impact** | Nicht barrierefrei, Store-Risiko |
| **Empfehlung** | Baseline a11y Pass |

---

## TD-19 · Merge Duplicate Placeholder
| Feld | Wert |
|------|------|
| **ID** | TD-19 |
| **Priorität** | P2 |
| **Ort** | DuplicateWarningBanner, ImportPreviewCard, SubmissionCard |
| **Beschreibung** | onMerge={() => {}} — disabled „Merge (soon)" |
| **Impact** | Admin-Workflow unvollständig |
| **Empfehlung** | Merge-Logik definieren + implementieren |

---

## TD-20 · package.json vs app.json Version
| Feld | Wert |
|------|------|
| **ID** | TD-20 |
| **Priorität** | P3 |
| **Ort** | package.json (1.0.0) vs app.json (1.7.0) |
| **Beschreibung** | Versions-Inkonsistenz |
| **Impact** | Release-Verwirrung |
| **Empfehlung** | Single source of truth |

---

## Schulden-Heatmap

| Bereich | P0 | P1 | P2 | P3 |
|---------|----|----|----|----|
| State/Architektur | 1 | 2 | 3 | 0 |
| UI/Performance | 1 | 2 | 1 | 1 |
| Backend/Types | 0 | 3 | 1 | 0 |
| Docs/Process | 0 | 0 | 2 | 1 |
| Features | 0 | 2 | 1 | 0 |
| Quality | 1 | 1 | 0 | 0 |

**Gesamt:** 20 identifizierte Schulden — **keine davon erfordert Neuimplementierung**.

---

*Technical Debt Register — zur Priorisierung in 10_migration_roadmap.md*
