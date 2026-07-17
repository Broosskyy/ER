# Eternal Rave — UI Mockup Screen Reference

> **Primäre Design-Referenz** für alle UI-Implementierungen.  
> Regel: **Nicht neu designen — Mockup als North Star nutzen und schrittweise annähern.**

**Master Prompt:** [MASTER-PROMPT-v3.0.md](../01-product-vision/MASTER-PROMPT-v3.0.md)

---

## Design System (Mockup)

| Element | Spec |
|---------|------|
| Background | `#0B0B0F` deep black |
| Surface / Cards | `#15151B` charcoal |
| Primary accent | `#7C3AED` purple — buttons, active nav, highlights |
| Text primary | `#F5F5F5` white |
| Text secondary | `#9CA3AF` light gray |
| Border radius | ~12–16px on cards and buttons |
| Typography | Clean sans-serif, clear hierarchy |
| Nav | Persistent bottom bar: Home · Events · Map · Saved · Profile |

---

## 1. Home Screen

| Mockup-Element | Soll | Ist (Code) | Priorität |
|----------------|------|------------|-----------|
| Location header | „Berlin, Germany" + notification bell | Location pill „Hamburg · Near you", kein Bell | 🟡 |
| Search bar | „Suche nach Events, Künstlern, Clubs…" | `SearchBar` auf Home | ✅ |
| Quick filter chips | Heute · Dieses Wochenende · Techno · House | Today · Tomorrow · Weekend · This Month | 🟡 |
| Featured hero | Großes Flyer-Card, Datum, VOID-Style | `FeaturedEventCard` | ✅ |
| „Raves in deiner Nähe" | Featured section title | „Raves near you" | ✅ |
| „Heute Abend" | Horizontal scroll cards | Tonight section | ✅ |
| Trending | Eigene Sektion | — | 🔴 |
| Popular organizers | Eigene Sektion | — | 🔴 |
| Never empty | Dummy fallback + skeleton | ✅ | ✅ |

**Dateien:** `app/(tabs)/home.tsx`, `FeaturedEventCard`, `EventCard`

---

## 2. Events Screen

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Search + Filter row | Date · Genre · Location | Search + FilterChips | 🟡 |
| Result count | „145 Events gefunden" | Kein Count-Label | 🔴 |
| List layout | Thumbnail links, Meta rechts | `EventCard` vertical | ✅ |
| Distance | „1.2 km" | `distanceKm` (mock) | 🟡 |

**Dateien:** `app/(tabs)/search.tsx`

---

## 3. Map Screen

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Full dark map | Mapbox-style mit Clustern | Placeholder „Real map coming soon" | 🔴 |
| Purple event clusters | Pin clusters mit Count | — | 🔴 |
| User location dot | Blauer Punkt | — | 🔴 |
| Bottom sheet preview | Event card bei Pin-Tap | `MapBottomSheet` basic | 🟡 |

**Dateien:** `app/(tabs)/map.tsx`, `MapPlaceholder`

**Sprint:** Mapbox Integration (3.1)

---

## 4. Event Detail

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Hero flyer | Full-width oben | ✅ `expo-image` hero | ✅ |
| Title · Date · Time | Prominent | ✅ | ✅ |
| Venue + Address | Mit Icon | ✅ | ✅ |
| Line-up | Artist list | ✅ | ✅ |
| Organizer + Verified | „Verifiziert" Badge lila | `OrganizerCard`, Badge teilweise | 🟡 |
| „Tickets sichern" | Full-width purple CTA | `PrimaryButton` Get tickets | ✅ |
| Share | Icon/Button | — | 🔴 |
| Map preview | Mini-map unter Adresse | `LocationPreview` placeholder | 🟡 |
| Similar events | Horizontal scroll | ✅ `SimilarEvents` | ✅ |

**Dateien:** `app/event/[id].tsx`

---

## 5. Add Event

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Clean form sections | Title · Date/Time · Location · Genres · Description | `FormSection` cards | ✅ |
| Genre picker | Dropdown/chips | Chip multi-select | ✅ |
| Duplicate warning | — (User-facing optional) | `DuplicateWarningBanner` | ✅ |

**Dateien:** `app/add-event.tsx`

---

## 6. Profile & My Submissions

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| User stats | Favorites · Submissions · Visited | Profile basic, keine Stats-Row | 🔴 |
| Settings menu | Settings · Support | Profile links | 🟡 |
| My Submissions tabs | Alle · Pending · In Review · Rejected | List ohne Tabs | 🔴 |
| Status badges | Orange Pending, etc. | `StatusBadge` | ✅ |

**Dateien:** `app/(tabs)/profile.tsx`, `app/my-submissions.tsx`

---

## 7. Organizer Dashboard

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Stats row | Events total · Pending · Published | Basic dashboard | 🟡 |
| Create Event CTA | Prominent | ✅ | ✅ |
| Drafts / Pending / Published menus | Separate views | Screens vorhanden, Supabase teilweise | 🟡 |

**Dateien:** `app/organizer.tsx`, `app/organizer/create-event.tsx`

---

## 8. Admin Dashboard & Review

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Stats | Total Events · Pending Review counts | `StatCard` auf Admin | ✅ |
| Quick actions | Review · Import · Sources · Reports | Links auf `admin.tsx` | ✅ |
| Review tabs | Pending (128) · Imported (65) | Filter tabs Pending/Imported/… | ✅ |
| Review list item | Title · Venue · Source · Review button | `ReviewCard` | ✅ |
| Duplicate warning | Match event · Score · Reasons | `DuplicateWarningBanner` | ✅ |
| Actions | Publish anyway · Mark duplicate · Merge | ✅ (Merge placeholder) | ✅ |

**Dateien:** `app/admin.tsx`, `app/admin/review-events.tsx`, `DuplicateWarningBanner`

---

## 9. Source Manager

| Mockup-Element | Soll | Ist | Priorität |
|----------------|------|-----|-----------|
| Source list | Name · Type · Status toggle Aktiv/Inaktiv | `SourceManagerCard` | ✅ |
| Examples | Sisyphos · Berghain · RA · Eventim | Seed + CRUD | ✅ |
| Last Sync · Import Status | Pro source | `lastCheckedAt`, `importStatus` | 🟡 |

**Dateien:** `app/admin/sources/index.tsx`

---

## Priorisierte Mockup-Gaps (nächste Sprints)

| Prio | Screen | Feature |
|------|--------|---------|
| 1 | Home | GPS Location · Notification bell · DE quick filters |
| 2 | Home | Trending + Popular Organizers |
| 3 | Events | „X Events gefunden" count |
| 4 | Profile | Stats row (Favorites · Submissions · Visited) |
| 5 | My Submissions | Tab filter (Alle · Pending · In Review · Rejected) |
| 6 | Event Detail | Share button · Verified badge konsistent |
| 7 | Map | Mapbox mit Clustern |
| 8 | Admin | Reports UI · Organizer Verification |

---

## Implementierungsregel

Bei jedem UI-Sprint:

1. Mockup-Screen in dieser Datei öffnen
2. Gap-Tabelle prüfen
3. **Bestehende Komponenten erweitern** — keine Redesigns
4. `MOCKUP-ALIGNMENT.md` Status aktualisieren
5. Design Tokens aus `theme.ts` — nie hardcoded Abweichungen
