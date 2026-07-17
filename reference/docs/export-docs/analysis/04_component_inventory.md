# 04 — Component Inventory

**Stand:** Juni 2026 · **Pfad:** `src/components/` (36 Dateien + `index.ts`)

---

## Übersicht nach Kategorie

### Layout & Screen Shells

| Komponente | Datei | Verwendung | Mockup-Ref | Wiederverwendung |
|------------|-------|------------|------------|------------------|
| `TabScreenLayout` | TabScreenLayout.tsx | Alle 5 Tabs | 56 Navigation | ✅ Hoch |
| `AppScreen` | AppScreen.tsx | Legacy wrapper | — | 🟡 Selten |
| `FormScreenLayout` | FormScreenLayout.tsx | Add Event, Organizer Forms | 53 Inputs | ✅ |
| `ScreenHeader` | ScreenHeader.tsx | Stack screens mit Back | 56 | ✅ Hoch |
| `SectionHeader` | SectionHeader.tsx | Home sections | 09 Home | ✅ |

### Navigation

| Komponente | Datei | Mockup | Status |
|------------|-------|--------|--------|
| `BottomNav` | BottomNav.tsx | 56 | ✅ a11y Labels |
| `FilterChip` / `FilterChipRow` | FilterChip.tsx | 55, 13 | ✅ |
| `DateChip` | DateChip.tsx | 55 | 🟡 Wenig genutzt |

### Buttons & Interaktion

| Komponente | Datei | Mockup | Anmerkung |
|------------|-------|--------|-----------|
| `PrimaryButton` | PrimaryButton.tsx | 52 | Standard CTA |
| `SecondaryButton` | SecondaryButton.tsx | 52 | Outline style |
| `AnimatedPressable` | AnimatedPressable.tsx | 72 | Scale feedback |
| `AnimatedFavoriteButton` | AnimatedFavoriteButton.tsx | 54 | Heart toggle |
| `AnimatedCard` | AnimatedCard.tsx | 75 | Elevation anim |

### Event Display

| Komponente | Datei | Mockup | Varianten |
|------------|-------|--------|-----------|
| `EventCard` | EventCard.tsx | 10, 54 | list, compact |
| `FeaturedEventCard` | FeaturedEventCard.tsx | 09 | Hero |
| `EventTag` | EventTag.tsx | 55 | Genre chips |
| `EventCoverImage` | EventImageFallback.tsx | 54, 67 | thumb, hero, fallback gradient |
| `EventImageFallback` | EventImageFallback.tsx | 67 | No-flyer state |
| `SimilarEvents` | SimilarEvents.tsx | 11 | Horizontal list |
| `OrganizerCard` | OrganizerCard.tsx | 11, 38 | verified badge |
| `OrganizerListItem` | OrganizerCard.tsx | 09 | — |
| `StoryCircle` / `StoryCircleRow` | StoryCircle.tsx | 09 | Instagram-style |

### Forms

| Komponente | Datei | Mockup |
|------------|-------|--------|
| `FormField` | FormField.tsx | 53 |
| `FormSection` | FormField.tsx | 53 |
| `SearchBar` | SearchBar.tsx | 09, 10 |

### Status & Feedback

| Komponente | Datei | Mockup |
|------------|-------|--------|
| `StatusBadge` | StatusBadge.tsx | 55, 22 |
| `EmptyState` | EmptyState.tsx | 57 |
| `SuccessState` | SuccessState.tsx | 24, 74 |
| `LoadingSkeleton` | LoadingSkeleton.tsx | 60 |
| `EventCardSkeleton` | LoadingSkeleton.tsx | 60 |
| `EventDetailSkeleton` | EventDetailSkeleton.tsx | 60 |
| `DuplicateWarningBanner` | DuplicateWarningBanner.tsx | 43, 45 |
| `BackendStatusBanner` | BackendStatusBanner.tsx | — (Dev UX) |
| `PublishedFeedStatus` | PublishedFeedStatus.tsx | — (Dev UX) |

### Admin & Organizer

| Komponente | Datei | Mockup |
|------------|-------|--------|
| `SubmissionCard` | SubmissionCard.tsx | 22, 43 |
| `ReviewCard` | SubmissionCard.tsx | 42, 43 |
| `ImportPreviewCard` | ImportPreviewCard.tsx | 45 |
| `SourceManagerCard` | SourceManagerCard.tsx | 44 |
| `StatCard` | StatCard.tsx | 15, 41, 48 |

### Map (Placeholder)

| Komponente | Datei | Mockup | Zukunft |
|------------|-------|--------|---------|
| `MapPlaceholder` | MapPlaceholder.tsx | 12 | → Mapbox wrapper |
| `LocationPreview` | LocationPreview.tsx | 11 | → Mini map |
| `MapBottomSheet` | SimilarEvents.tsx | 12, 59 | → echtes Sheet |

---

## Komponenten die zusammengeführt werden sollten

### Priorität 1 — Card-Familie
```
EventCard ──────────────┐
FeaturedEventCard ──────┤ → EventCardBase + variants
SubmissionCard ─────────┤
ReviewCard ─────────────┤
ImportPreviewCard ──────┘
```
**Grund:** Gemeinsame Meta-Zeile (Titel, Datum, Venue, Tags), unterschiedliche Actions.

### Priorität 2 — Status-Farben
```
StatusBadge
lifecycle.ts statusColor()
eventSource.ts getImportStatusColor()
DuplicateWarningBanner confidence colors
ImportPreviewCard confidence colors
```
**Grund:** `#F59E0B` Warning außerhalb `theme.ts`.

### Priorität 3 — Layout-Wrapper
```
TabScreenLayout vs AppScreen vs FormScreenLayout
```
**Grund:** Klare Hierarchie: AppShell → TabShell → FormShell.

### Priorität 4 — Preview/Review
```
SubmissionCard + ImportPreviewCard + DuplicateWarningBanner
```
**Grund:** Gleiche Admin-Review-Actions (Publish, Duplicate, Merge).

---

## Fehlende Komponenten (laut Mockups 52–61)

| Benötigt | Mockup | Priorität |
|----------|--------|-----------|
| `Dialog` / `AlertDialog` | 58 | Mittel |
| `Toast` / `Snackbar` | 61 | Mittel |
| `BottomSheet` (generisch) | 59 | Hoch (Map) |
| `NotificationBell` | 09 | Niedrig |
| `TicketCard` | 16–17 | V3+ |
| `OnboardingSlide` | 03–06 | Mittel |
| `StepIndicator` | 21, 26–30 | Mittel (Organizer wizard) |
| `Typography` primitives | 63 | Hoch (DS) |

---

## Export-Struktur

`src/components/index.ts` exportiert 37 Symbole — **gut für Wiederverwendung**.

**Anti-Pattern:** Einige Screens importieren direkt aus Unterpfaden statt Barrel (minor).

---

## Abhängigkeits-Graph (kritische Pfade)

```
EventCard
  ├── EventCoverImage
  ├── EventTag
  ├── AnimatedFavoriteButton → useFavorites (re-render risk)
  └── PrimaryButton (optional)

FeaturedEventCard
  ├── EventCoverImage
  └── LinearGradient

SubmissionCard / ReviewCard
  ├── StatusBadge
  ├── DuplicateWarningBanner
  └── PrimaryButton / SecondaryButton
```

**Performance-Hinweis:** `EventCard` bindet `useFavorites()` — jeder Favoriten-Toggle re-rendert alle sichtbaren Cards.

---

## Align Band 2 Komponentenbibliothek

Band 2 Kapitel `04_Komponentenbibliothek.md` ist Stub (1 Zeile).  
**Tatsächliche Bibliothek = dieser Inventory** — sollte später nach Band 2 zurückspielen.

---

*Read-only Analyse. Keine Refactorings durchgeführt.*
