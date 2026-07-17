# Eternal Rave — Mockup Alignment (Ist vs. Soll)

**Referenz:** [MASTER-PROMPT-v3.0.md](../01-product-vision/MASTER-PROMPT-v3.0.md) · [MOCKUP-SCREENS.md](./MOCKUP-SCREENS.md)  
**Stand:** Juni 2026 · APK v1.6.0 · Branch `cursor/release-v1-5-0-apk-a932`

Dieses Dokument mappt die Product Vision auf den aktuellen Implementierungsstand und definiert priorisierte Lücken.

---

## Versions-Stand

| Vision | Status | Anmerkung |
|--------|--------|-----------|
| **V0.1** Premium Frontend | ✅ Erledigt | Sprint 1.1–1.4 |
| **V0.2** Supabase + Auth + Rollen | ✅ Erledigt | Sprint 2.0 |
| **V0.3** Real Events + Favorites + Feed | 🟡 Fast | Feed live, Favorites teilweise, echte Events via Seed |
| **V1** Public Release | 🔴 Offen | APK v1.3.0, v1.4.0 Build ausstehend |
| **V2** Auto Discovery | 🔴 Foundation | Source Manager + Import-Pipeline, kein Cron/Scraping |
| **V3–V5** Organizer Ecosystem, Community, AI | 🔴 Zukunft | Architektur vorbereitet |

---

## Design System

| Token (Vision) | Code (`src/constants/theme.ts`) | Status |
|----------------|-----------------------------------|--------|
| Background `#0B0B0F` | `Colors.background` | ✅ Identisch |
| Surface `#15151B` | `Colors.surface` | ✅ Identisch |
| Elevated `#1F1F27` | `Colors.surfaceElevated` | ✅ Identisch |
| Primary `#7C3AED` | `Colors.primary` | ✅ Identisch |
| Highlight `#A855F7` | `Colors.primaryHighlight` | ✅ Identisch |
| Text / Border / Success / Danger | Alle vorhanden | ✅ Identisch |
| No excessive glow | Sprint 1.4 reduziert Neon | ✅ Aligniert |

---

## Home Screen

| Vision-Element | Implementierung | Status |
|----------------|-----------------|--------|
| Current location | Location-Pill (Hamburg · Near you) | 🟡 Statisch, kein GPS |
| Search | `SearchBar` auf Home | ✅ |
| Date filters | Today, Tomorrow, Weekend, This Month | ✅ |
| Genre filters | Auf Events/Search Screen | 🟡 Nicht auf Home |
| Featured event | `FeaturedEventCard` | ✅ |
| Nearby events | Sortiert nach `distanceKm` | 🟡 Mock-Distanz, kein GPS |
| Trending | — | 🔴 Fehlt |
| Tonight | Eigene Sektion | ✅ |
| Weekend | Via Date-Filter | 🟡 Kein eigener Block |
| Popular organizers | — | 🔴 Fehlt |
| Never empty | Dummy-Fallback + Skeleton | ✅ |

**Nächste Schritte Home:** GPS/Standort, Trending-Sektion, Popular Organizers, Genre-Chips auf Home.

---

## Event Cards

| Feld | Status |
|------|--------|
| Flyer | ✅ |
| Title, Date, Time | ✅ |
| Venue, City, Distance | ✅ |
| Genres (bis 3 Tags) | ✅ |
| Price | ✅ |
| Favorite button | ✅ |
| Ticket button | 🟡 Detail ja, List teilweise |
| Verified organizer badge | 🟡 Flag vorhanden, nicht überall sichtbar |

---

## Event Detail

| Element | Status |
|---------|--------|
| Hero / Flyer | ✅ |
| Description | ✅ |
| Venue & Address | ✅ |
| Genres, Date, Time | ✅ |
| Organizer | ✅ `OrganizerCard` |
| Line-up | ✅ |
| Ticket button | ✅ öffnet `ticketUrl` |
| Share | 🔴 Fehlt |
| Favorite | ✅ |
| Map preview | 🟡 `LocationPreview` Placeholder |
| Similar events | ✅ aus Live-Feed |

---

## Event Sources & Source Manager

| Source-Typ (Vision) | DB / UI | Status |
|---------------------|---------|--------|
| User submission | `source_type = user_submission` | ✅ |
| Organizer submission | Organizer-Flow | 🟡 Draft lokal, kein vollständiger Supabase-Flow |
| Ticketmaster, Eventim, Eventbrite, Shotgun, RA | `event_sources` Enum | ✅ Konfigurierbar |
| Club / Festival Websites | ✅ | ✅ |
| Instagram, CSV, Text, Flyer | ✅ | ✅ |
| Text Import (real parser) | Sprint 2.5 | ✅ |
| URL Import (real fetch) | Mock only | 🔴 |
| Flyer OCR / AI | — | 🔴 |
| Auto Cron Import | — | 🔴 |

**Architektur:** Modular via `event_sources` + `import_sources` + Services — ✅ skalierbar.

---

## Event Lifecycle

| Status (Vision) | DB Enum | UI Admin | Public Feed |
|-----------------|---------|----------|-------------|
| Draft | ✅ | ✅ | Hidden |
| Pending Review | ✅ | ✅ | Hidden |
| Imported Draft | ✅ | ✅ | Hidden |
| Needs Review | ✅ | ✅ | Hidden |
| Approved | ✅ | ✅ | Hidden |
| Published | ✅ | ✅ Publish | ✅ **Only these** |
| Rejected | ✅ | ✅ | Hidden |
| Duplicate | ✅ | ✅ | Hidden |

**Automation:** Nie auto-publish — ✅ eingehalten.

---

## Rollen

| Rolle | Vision | Status |
|-------|--------|--------|
| Guest | Discover | 🟡 App nutzbar ohne Login, kein expliziter Guest-Mode |
| User | Discover, Favorites, Submissions | ✅ |
| Organizer | Dashboard, Events | 🟡 Screens vorhanden, Backend-Anbindung unvollständig |
| Admin | Full toolkit | ✅ Dashboard, Review, Import, Sources |

---

## Admin (Vision vs. Ist)

| Feature | Status |
|---------|--------|
| Dashboard | ✅ |
| Review Queue | ✅ |
| Import Manager | ✅ URL + Text |
| Source Manager | ✅ |
| Duplicate Detection | 🟡 Heuristik + Mark Duplicate, kein Auto-Scan |
| Reports | 🔴 Tabelle da, kein UI |
| Statistics | 🟡 Basis-Stats auf Dashboard |
| Organizer Verification | 🔴 Schema da, kein UI |

---

## Organizer

| Feature | Status |
|---------|--------|
| Organizer Dashboard | 🟡 Basis-Screen |
| Create Event | ✅ |
| Drafts / Pending / Published / Rejected | 🟡 Lokal/Mock, nicht voll Supabase |
| Analytics | 🔴 Later |

---

## UX (Vision)

| Pattern | Status |
|---------|--------|
| Skeleton loading | ✅ Home, Events, Detail, Saved |
| Empty states | ✅ |
| Error states + Retry | ✅ |
| Success states | 🟡 Add Event Success |
| Pull-to-refresh | ✅ |
| Card press feedback | 🟡 Pressable, kein Haptics überall |
| Fade / smooth transitions | 🟡 Basis Expo Router |
| Button feedback | 🟡 Teilweise |

---

## Code Quality (Vision)

| Prinzip | Status |
|---------|--------|
| Modular architecture | ✅ `app/`, `src/services/`, `src/hooks/` |
| Reusable components | ✅ `@/components` |
| Services separated | ✅ |
| Hooks for state | ✅ |
| Types | ✅ `database.ts`, `event.ts`, `lifecycle.ts` |
| Constants | ✅ `theme.ts`, `navigation.ts` |
| No large duplication | ✅ |

---

## Priorisierte Roadmap (Vision-aligned)

### Sprint 3.0 — Home & Discovery Polish
- Echte Standort-Erkennung (Expo Location)
- Trending + Popular Organizers auf Home
- Genre-Filter auf Home
- Share auf Event Detail
- Verified-Badge konsistent auf Cards

### Sprint 3.1 — Mapbox
- Echte Karte mit Event-Pins
- Map Preview auf Detail

### Sprint 3.2 — Organizer Supabase
- Organizer Events vollständig in DB
- Draft → Pending → Published Flow ohne Admin-Zwang wo sinnvoll

### Sprint 3.3 — Import V2
- Echtes URL-Fetching (robots.txt, Rate Limits)
- Duplicate Detection Auto-Scan vor Review
- Flyer Upload → Storage

### Sprint 3.4 — Automation Foundation
- Supabase Edge Function / Cron für `event_sources`
- Immer: Import → Review → Publish (nie auto-publish)

### Sprint 4.0 — V1 Launch
- Play Store Listing
- Push Notifications Basis
- APK/ AAB Release Pipeline
- Privacy Policy, Analytics

---

## Fazit

Die aktuelle Codebase ist **stark aligned** mit der Product Vision:

- Design System 1:1 umgesetzt
- Kernfrage „Events near me“ beantwortbar (mit Seed/Demo)
- Lifecycle, Rollen, Admin-Pipeline architektonisch korrekt
- Premium Lifestyle UI statt Cyberpunk — eingehalten

**Größte Lücken bis V1:** GPS/Map, Share, Organizer-Backend, echtes URL-Import, Reports, Public Release.

Alle zukünftigen Sprints sollten [MASTER-PROMPT-v3.0.md](../01-product-vision/MASTER-PROMPT-v3.0.md) als Checkliste nutzen.
