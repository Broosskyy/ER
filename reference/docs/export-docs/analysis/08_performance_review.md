# 08 — Performance Review

**Stack:** React Native 0.85 · Expo 56 · Reanimated 4 · Keine List-Library

---

## 1. Executive Summary

Die App performt **akzeptabel für ~17–30 Demo-Events**. Bei Skalierung auf hunderte/tausende Events entstehen **messbare Risiken** durch fehlende List-Virtualisierung, monolithischen Context und eager Tab-Loading.

**Keine akuten Crashes oder Memory-Leaks identifiziert** (statische Analyse). Runtime-Profiling wurde nicht durchgeführt.

---

## 2. Rendering & Re-Renders

### 2.1 EventStore Context Cascade
**Problem:** `useEventStore` liefert ein großes value-Objekt. Jede Änderung an `userSubmissions`, `importedDrafts`, `organizerDrafts`, `feedLoading`, etc. invalidiert **alle** Consumer.

**Betroffene Screens:** Potentiell alle — besonders Tabs die Store subscriben.

**Schwere:** 🔴 Hoch bei wachsender Nutzung

### 2.2 Favorites in EventCard
```typescript
// EventCard.tsx bindet useFavorites()
```
Jeder Favoriten-Toggle → Re-Render **aller** gemounteten EventCards auf Home/Search/Favorites.

**Schwere:** 🟡 Mittel (sichtbar bei 20+ Cards)

### 2.3 Tab Eager Loading
`app/(tabs)/_layout.tsx`: `lazy: false`  
→ Alle 5 Tab-Screens mounten beim App-Start.

**Impact:** Längere Initial Load Time, höherer Memory-Footprint  
**Schwere:** 🟡 Mittel

---

## 3. Listen-Performance

### Ist: ScrollView + .map()
| Screen | Pattern | Event-Anzahl |
|--------|---------|--------------|
| home | ScrollView | ~6–17 sichtbar |
| search | ScrollView | alle filtered |
| favorites | ScrollView | user favorites |
| review-events | ScrollView | admin queue |
| organizer | ScrollView | drafts lists |

### Soll (Band 3 Performance Kapitel + Mockup 79)
- `FlatList` oder `@shopify/flash-list` mit `keyExtractor`, `getItemLayout` wo möglich
- Pagination auf Feed-Query

**Schwere ohne Fix:** 🔴 Hoch ab ~100+ Events

---

## 4. Netzwerk & Data Fetching

### Published Feed
- `fetchPublishedEvents()` — ein Query + batch `event_artists`
- **Keine Pagination** — lädt alle published events
- Pull-to-refresh triggert full reload

### Duplicate Check
- `fetchAllEventsForDuplicateCheck()` — lädt alle non-rejected events bei Submission
- **O(n)** pro Submit — skaliert schlecht

### Admin Refresh
- `refresh()` lädt Review-Queue + Imports + Reports count in einem Batch
- Häufige Aufrufe nach jeder Admin-Aktion

**Schwere:** 🟡 Mittel (Admin-only, low frequency)

---

## 5. Bilder & Assets

### Positiv
- `expo-image` für Event-Flyer (Caching, besser als RN Image)
- `EventImageFallback` verhindert Layout-Shift bei fehlenden URLs

### Risiken
- Externe Unsplash URLs — keine Größen-Optimierung
- Kein Supabase Storage für Flyer — Band 4 Zukunft
- 79 Mockup PNGs in ZIPs (~15MB+) — nicht im JS bundle, ✅

---

## 6. Animation Performance

- Reanimated worklets auf UI thread — ✅ gut
- Skeleton pulse: kontinuierliche Animation auf sichtbaren Skeletons
- **Kein** `AccessibilityInfo.isReduceMotionEnabled` check

**Schwere:** 🟡 Niedrig (Accessibility, nicht FPS)

---

## 7. Bundle & APK

| Metrik | Wert | Anmerkung |
|--------|------|-----------|
| APK Größe | ~105 MB | Universal, 4 ABIs |
| JS Bundle | Nicht gemessen | Kein expo-atlas run |
| Dependencies | Minimal, kein Mapbox | Gut für Start |

**Band 5 Empfehlung:** arm64-only oder AAB → ~30–40 MB Download

---

## 8. Memory

### Demo Mode
- 17 events + seeds in memory — vernachlässigbar
- `dynamicPublished` wächst session-only

### Risiko
- Alle Tab-Screens + alle Event-Objekte im Store ohne Pagination

---

## 9. Startup Performance

**Cold Start Pfad:**
1. GestureHandler + SafeArea
2. Auth session restore (AsyncStorage)
3. EventStore init + feed fetch (oder demo seed)
4. 5 Tabs mount (lazy: false)
5. Reanimated init

**Optimierungspotential:** lazy tabs, defer admin data fetch

---

## 10. TypeScript Build

`npm run typecheck` — ✅ grün  
Build-Zeit nicht gemessen — kein signifikanter TS-Overhead erwartet.

---

## 11. Performance vs. Band 3 / Mockup 79

| Erwartung (Docs) | Ist |
|------------------|-----|
| Performance Kapitel | Stub |
| Mockup 79 Performance | Nicht implementiert |
| List optimization | 🔴 |
| Image CDN | 🟡 |
| Query caching | 🔴 |

---

## 12. Empfohlene Metriken (für spätere Sprints)

| Metrik | Ziel |
|--------|------|
| Time to Interactive | < 2s mid-range Android |
| Feed scroll FPS | 60fps bei 100 items |
| Favorite toggle | < 100ms perceived |
| APK download | < 40 MB (AAB) |

**Tools:** React DevTools Profiler, Flashlight (Android), Expo dev perf monitor

---

## 13. Performance-Roadmap-Prioritäten

1. FlatList/FlashList auf Home + Search + Favorites
2. EventStore selector pattern oder split contexts
3. Feed pagination (limit/offset)
4. memo(EventCard) + favorites decouple
5. lazy: true auf Tabs
6. Duplicate check server-side / indexed query

---

*Performance Review — statische Code-Analyse, keine Runtime-Messungen.*
