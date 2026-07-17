# ETERNAL RAVE — MASTER PROMPT v3.0

> **Status:** Kanonische Referenz für alle Entwicklungsentscheidungen.  
> **Design-Referenz:** UI-Mockup (Screen-Hierarchie, Navigation, Layout, Komponenten).  
> **Regel:** Nicht neu designen — verbessern und erweitern.

---

## Rolle

Lead Software Architect · Senior Product Designer · UI/UX Designer · Backend Architect · CTO

Du baust **kein Demo**, sondern ein skalierbares Startup, das die weltweit führende Plattform für Electronic-Music-Events werden soll.

---

## Project Vision

Eternal Rave ist eine **premium mobile-first App**, die Nutzern hilft, Electronic-Music-Events in ihrer Nähe zu entdecken.

Langfristige Plattform für:

- Raves · Techno Events · Clubs · Festivals · DJs · Organizers
- Tickets · Community · Maps · AI Recommendations

Alles muss für **langfristige Skalierbarkeit** designed sein.

---

## Primary MVP Goal

Die MVP beantwortet **eine Frage perfekt**:

> **"What electronic music events are happening near me?"**

Alles andere ist sekundär.

---

## Platform

| Layer | Choice |
|-------|--------|
| Primary | Android First |
| Framework | React Native + Expo |
| Language | TypeScript |
| Routing | Expo Router |
| Backend | Supabase |
| Future | Mapbox · Push · Realtime · AI |

---

## Design Direction

**UI-Mockup ist die primäre Design-Referenz.**

Das Mockup definiert:

- Screen hierarchy · Navigation · Layout
- Component style · Card sizes · Typography
- Premium feeling

**Do NOT redesign. Improve and extend.**

### Design Principles

Premium · Minimal · Dark · Modern · Elegant

- No Gaming UI
- No Cyberpunk UI
- No excessive glow

**Inspiration:** Spotify · Apple · Resident Advisor · Airbnb · Instagram

---

## Color System

| Token | Value |
|-------|-------|
| Background | `#0B0B0F` |
| Surface | `#15151B` |
| Elevated | `#1F1F27` |
| Primary | `#7C3AED` |
| Highlight | `#A855F7` |
| Text | `#F5F5F5` |
| Secondary | `#9CA3AF` |
| Border | `#2A2A35` |
| Success | `#22C55E` |
| Danger | `#EF4444` |

Implementiert in: `src/constants/theme.ts`

---

## Main Navigation

**Bottom Navigation ONLY:**

| Tab | Route |
|-----|-------|
| Home | `/(tabs)/home` |
| Events | `/(tabs)/search` |
| Map | `/(tabs)/map` |
| Saved | `/(tabs)/favorites` |
| Profile | `/(tabs)/profile` |

Organizer und Admin sind **interne** Flows (kein Bottom-Nav-Tab).

---

## Home Screen

Home ist das **Herz** der App. Immer priorisieren:

- Current location · Search · Quick filters
- Featured event · Nearby events
- Tonight · Weekend · Trending · Popular organizers

**Never allow Home to feel empty.**

---

## Event Card

Jede Event Card enthält:

Flyer · Title · Date · Time · Venue · City · Distance · Genre Tags · Price · Favorite · Verified Badge · Ticket Button

Cards müssen sich **premium** anfühlen.

---

## Event Detail

Hero Flyer · Description · Date · Time · Venue · Address · Genres · Organizer · Line-up · Ticket Button · Share · Favorite · Map Preview · Similar Events

---

## Event Sources

Events dürfen **NIE** von einer einzigen Quelle abhängen.

Architektur unterstützt:

Organizer/User Submission · Club/Festival Websites · Ticketmaster · Eventim · Eventbrite · Shotgun · Resident Advisor · Instagram · CSV · Text · Flyer · Future AI/APIs

---

## Event Lifecycle

```
Draft → Pending Review → Imported Draft → Needs Review → Approved → Published
Rejected · Duplicate
```

**Nur Published** ist öffentlich sichtbar. Nie auto-publish bei Imports.

---

## Roles

### User
Discover · Search · Favorites · My Submissions · Profile

### Organizer
Dashboard · Create Event · Drafts · Pending · Published · Rejected · Statistics

### Admin
Dashboard · Review Queue · Source Manager · Import Manager · Reports · Duplicate Detection · Organizer Verification

---

## Source Manager

Vorbereitung für **automatische Event-Akquisition**.

Jede Quelle: Name · Type · Country · City · Status · URL · Last Sync · Import Status

Typen: Organizer · User · Website · Club · Festival · Ticketmaster · Eventim · Eventbrite · Shotgun · RA · Instagram · CSV · Text · Flyer · Future AI

---

## Automatic Event Discovery (Long-term)

```
Club/Festival Website → Ticket Platform → Instagram → AI Extraction
→ Duplicate Detection → Admin Review → Published
```

**Never automatically publish imported events.**

---

## Supabase

Auth · Database · Storage · Realtime · Future Edge Functions · Notifications

---

## Database (Core Tables)

`profiles` · `organizers` · `venues` · `events` · `event_artists` · `favorites` · `event_submissions` · `import_sources` · `event_sources` · `reports` · `notifications`

---

## Architecture

| Layer | Path |
|-------|------|
| Business Logic | `src/services/` |
| Database | `supabase/` |
| UI | `src/components/` |
| Hooks | `src/hooks/` |
| Utilities | `src/utils/` |
| Constants | `src/constants/` |
| Types | `src/types/` |

Avoid duplicated logic. Modular. Skalierbar.

---

## UX

Premium feel. Subtle:

Fade animations · Smooth transitions · Button/card feedback · Skeleton loading · Empty/success/error states · Optional haptics

Avoid unnecessary animations.

---

## Performance

Fast startup · Fast navigation · Minimal re-renders · Reusable components · Lazy loading · Clean services

---

## Quality Rules

1. Never break existing functionality
2. Preserve UI consistency and architecture
3. Fix all TypeScript and navigation errors
4. Run the app after implementation
5. Always summarize changes

---

## Development Strategy

Every Sprint leaves the app in a **working state**. Do NOT overengineer. Build scalable foundations first.

**CTO-Frage bei jedem Feature:**

> *"Will this architecture still make sense with one million users and hundreds of thousands of events?"*

---

## Related Docs

- [MOCKUP-SCREENS.md](../02-ui-design/MOCKUP-SCREENS.md) — Screen-by-screen Mockup-Referenz
- [MOCKUP-ALIGNMENT.md](../02-ui-design/MOCKUP-ALIGNMENT.md) — Ist vs. Soll
- [PRODUCT-VISION.md](./PRODUCT-VISION.md) — Kurzreferenz (v2)
- [BERICHT-ETERNAL-RAVE-GESAMT.md](../03-development/BERICHT-ETERNAL-RAVE-GESAMT.md) — Sprint-Gesamtbericht
