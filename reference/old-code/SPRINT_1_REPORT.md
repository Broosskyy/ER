# Sprint 1 — Foundation & Code Alignment

**Projekt:** Eternal Rave  
**Branch:** `cursor/sprint-1-foundation-a932`  
**Datum:** 28. Juni 2026  
**Scope:** Inkrementelle Angleichung Code ↔ Dokumentation (Band 0–5, 4.5, 4.6)  
**Constraints eingehalten:** Keine Breaking Changes · Keine Neuimplementierung · Keine neuen Screens/Auth/Automation/Backend

---

## Zusammenfassung

Sprint 1 vereinheitlicht Design Tokens, Theme und Komponenten-Patterns mit der Development Bible. Hardcodierte Farben in UI-Komponenten wurden entfernt, Listen-Komponenten memoisiert, Accessibility-Labels ergänzt und ein Performance-Quick-Win (lazy Tabs) umgesetzt. Dokumentation (`DESIGN_RULES`, `analysis/06`) wurde aktualisiert. TypeScript-Check (`npm run typecheck`) bestanden.

---

## 1. Code vs. Development Bible

| Prüfbereich | Befund | Maßnahme |
|-------------|--------|----------|
| Farb-Tokens (Band 2) | `warning`, `mapSurface` fehlten; Hex in Components | Tokens + Helpers in `theme.ts` / Tailwind |
| Lifecycle-Farben | Hardcoded Hex in `lifecycle.ts` | `Colors.warning`, `Colors.primary` etc. |
| Import-Confidence (Band 4.5) | `#F59E0B` in Import/Duplicate UI | `getImportConfidenceColor()`, `getDuplicateConfidenceColor()` |
| Event-Gradients | Inline-Arrays in Mapper/Store | `ImageGradients.default` / `.fallback` |
| Lifecycle-Reihenfolge (Band 4.5 SSOT) | Falsch in `analysis/06` | Diagramm korrigiert |
| Version (QG-01) | `package.json` 1.0.0 ≠ `app.json` 1.7.0 | Sync auf 1.7.0 |
| Legacy submissions (AR-02) | Undokumentiert | `@deprecated` JSDoc in `submissions.ts` |

---

## 2. Design Tokens — Vereinheitlichung

### `src/constants/theme.ts`

| Kategorie | Ergänzung |
|-----------|-----------|
| **Colors** | `warning`, `white`, `mapSurface`, `primaryDeep` |
| **Typography** | `caption` … `display` (10–30) |
| **Shadows** | `Shadows.card` |
| **ImageGradients** | `default`, `fallback` |
| **Helpers** | `getImportConfidenceColor()`, `getDuplicateConfidenceColor()` |

### `tailwind.config.js`

- Colors: `warning`, `map-surface`, `primary-deep`
- Spacing: `xs` … `screen` (sync mit `Spacing`)
- BorderRadius: `sm` … `xl`
- FontSize: `caption` … `display`

---

## 3. Theme — Vereinheitlichung

- **Single Source:** `theme.ts` bleibt SSOT; Tailwind spiegelt Werte für NativeWind-Klassen.
- **Regel durchgesetzt:** Keine Hex-Werte mehr in `src/components/` (Mock-Daten in `src/data/events.ts` unverändert — bewusst).
- **Dokumentation:** `docs/rules/DESIGN_RULES.md` auf Sprint-1-Stand (Tokens, Typography, Shadows).

---

## 4. Komponenten

| Komponente | Änderung |
|------------|----------|
| `EventCard` | `React.memo`, `accessibilityRole`/`Label` |
| `FeaturedEventCard` | `memo`, a11y |
| `FilterChip` / `FilterChipRow` | `memo`, a11y, `tablist` |
| `PrimaryButton` / `SecondaryButton` | a11y props, `Colors.white` für Loader |
| `SearchBar` | `accessibilityLabel`, `accessibilityRole="search"` |
| `AnimatedFavoriteButton` | a11y (Add/Remove favorites) |
| `ImportPreviewCard` | Theme-Helper statt Hex |
| `DuplicateWarningBanner` | Theme-Helper, a11y auf Match-Link |
| `MapPlaceholder` | `bg-map-surface`, `Colors.white`, Pin-a11y |
| `EventImageFallback` | `ImageGradients.fallback` |

**Duplikate:** Keine sicheren Duplikat-Merges identifiziert (36 Komponenten — jeweils unterschiedlicher Zweck). Keine Ordner-Umstrukturierung nötig.

**Props:** Keine Breaking Prop-Änderungen; bestehende APIs unverändert.

---

## 5. Ordnerstruktur

**Keine Änderung.** Bestehende Struktur (`app/`, `src/components/`, `src/constants/`, …) entspricht `docs/PROJECT_STRUCTURE.md`.

---

## 6. Performance Quick Wins

| Maßnahme | Datei | Wirkung |
|----------|-------|---------|
| `React.memo` | EventCard, FeaturedEventCard, FilterChip | Weniger Re-Renders in Feed/Filter-Listen |
| `lazy: true` | `app/(tabs)/_layout.tsx` | Inaktive Tabs werden erst bei Bedarf gemountet |

**Nicht angefasst (höheres Risiko):** EventStore-Decomposition, Query-Library, Pagination.

---

## 7. Accessibility Quick Wins

| Vor Sprint 1 | Nach Sprint 1 |
|--------------|---------------|
| ~2 Komponenten mit `accessibilityLabel` | 11 Dateien mit a11y-Props |

Abgedeckt: Event-Karten, Filter, Buttons, Suche, Favorit-Toggle, Map-Pins, Duplicate-Match-Link, BottomNav/ScreenHeader (bereits vorhanden).

**Offen:** Vollständige Screen Reader-Audit, Reduce Motion, Kontrast-Tests.

---

## 8. TypeScript

- `npm run typecheck` — **bestanden**
- Keine neuen `any`-Casts
- `@deprecated` auf Legacy-Service dokumentiert
- Theme-Helpers typisiert (`string` return)

---

## 9. Technische Schulden (geringes Risiko)

| Item | Maßnahme |
|------|----------|
| AR-02 Legacy `event_submissions` | `@deprecated` JSDoc + Sprint-3-Hinweis |
| QG-01 Version drift | package.json + lock root → 1.7.0 |
| Hardcoded design values | Entfernt aus Components |

---

## 10. Architecture Review

Aktualisiert: `docs/analysis/06_architecture_review.md`

- Sprint-1-Update-Sektion
- Lifecycle-Diagramm Band 4.5 SSOT
- Band-2-Match: 🟡 → verbessert

---

## Liste aller geänderten Dateien

```
app/(tabs)/_layout.tsx
docs/analysis/06_architecture_review.md
docs/rules/DESIGN_RULES.md
package.json
package-lock.json
src/constants/theme.ts
tailwind.config.js
src/types/lifecycle.ts
src/types/eventSource.ts
src/utils/eventMappers.ts
src/hooks/useEventStore.tsx
src/services/submissions.ts
src/components/EventCard.tsx
src/components/FeaturedEventCard.tsx
src/components/FilterChip.tsx
src/components/EventImageFallback.tsx
src/components/PrimaryButton.tsx
src/components/SecondaryButton.tsx
src/components/SearchBar.tsx
src/components/AnimatedFavoriteButton.tsx
src/components/ImportPreviewCard.tsx
src/components/DuplicateWarningBanner.tsx
src/components/MapPlaceholder.tsx
SPRINT_1_REPORT.md
```

**Statistik:** 24 Dateien, +197 / −57 Zeilen (ohne Report)

---

## Performance-Verbesserungen (messbar erwartet)

1. **Tab lazy loading** — Map/Search/Favorites/Profile mounten erst bei erstem Besuch → schnellerer Home-Start.
2. **Memoized list items** — EventCard/FeaturedEventCard/FilterChip re-rendern nur bei Prop-Änderung.
3. **Token-Lookup statt Inline-Logik** — marginal; Hauptnutzen ist Wartbarkeit.

*Keine Benchmarks in Sprint 1 — empfohlen für Sprint 2 Profiling.*

---

## Risiken

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| `lazy: true` auf Tabs | Niedrig | Erster Tab-Wechsel minimal verzögert; akzeptiert für MVP |
| Memo + Context (Favorites) | Niedrig | Favorites-Hook in Parent — Cards re-rendern bei Favorit-Änderung (korrekt) |
| package-lock nur Root-Version | Niedrig | Keine Dependency-Änderungen |
| MOCKUP-ALIGNMENT noch veraltet | Mittel | Sprint-2-Doku-Task (QG-06) |
| God Store / keine Tests | Hoch | Bewusst Sprint 2+ (Roadmap) |

---

## Offene Punkte

| ID | Thema | Priorität | Sprint |
|----|-------|-----------|--------|
| OP-01 | MOCKUP-ALIGNMENT.md auf v1.7.0 | P0 | 2 |
| OP-02 | analysis/README Index | P1 | 2 |
| OP-03 | Vollständige a11y-Audit aller Screens | P1 | 2 |
| OP-04 | Typography — Custom Font / Mockup 63–65 | P2 | 3+ |
| OP-05 | EventStore split (AR-01) | P1 | 4 |
| OP-06 | Test-Pyramid (AR-06) | P1 | 14 |
| OP-07 | `src/data/events.ts` Gradient-Hex → Tokens | P2 | 2 |
| OP-08 | PR Merge #27–#29 auf main | P0 | Ops |

---

## Sprint-2 Readiness

| Kriterium | Status |
|-----------|--------|
| Design Tokens aligned | ✅ |
| Keine Component-Hex-Leaks | ✅ |
| TypeScript clean | ✅ |
| Version sync | ✅ |
| Breaking Changes | ✅ Keine |
| Feature-Sprint freigegeben? | 🟡 **Ja für UI Quick Wins** nach OP-08 (main sync) |

**Empfohlener Sprint-2-Fokus:** Share Button, Verified Badge, Profile Stats, Notification Bell (UI only) — laut Sprint 0.5 Readiness.

---

## Verification

```bash
npm run typecheck   # ✅ exit 0
```

Manuell empfohlen: Home Feed scroll, Tab-Wechsel, Favorit-Toggle, Import Preview (Admin), Map Pin selection.

---

*Sprint 1 abgeschlossen — Foundation & Code Alignment.*
