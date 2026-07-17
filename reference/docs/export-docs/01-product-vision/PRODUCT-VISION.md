# Eternal Rave — Product Vision & Design Specification

> **Status:** Kurzreferenz. **Kanonisch ab v3.0:** [MASTER-PROMPT-v3.0.md](./MASTER-PROMPT-v3.0.md)  
> **UI Mockup:** [MOCKUP-SCREENS.md](../02-ui-design/MOCKUP-SCREENS.md) · **Ist/Soll:** [MOCKUP-ALIGNMENT.md](../02-ui-design/MOCKUP-ALIGNMENT.md)

---

## Project

**Project Name:** Eternal Rave

**Mission:** Build the world's largest platform for electronic music events.

The platform should eventually combine:

- Event Discovery
- Clubs
- Festivals
- DJs
- Organizers
- Tickets
- Maps
- Community
- Favorites
- Notifications
- AI Recommendations

The MVP starts much smaller.

---

## Main Goal

The first useful version answers exactly one question:

> **"What electronic music events are happening near me?"**

Everything else is secondary.

---

## Target Audience

- 18–40 years
- Electronic music fans
- Techno, Hard Techno, House, Melodic Techno, Industrial, Hardcore, Drum & Bass, Psytrance
- Festival visitors, club visitors, travelers

---

## Product Philosophy

Do **NOT** build a flashy gaming UI.  
Do **NOT** build a cyberpunk UI.

Instead create a **premium lifestyle application**.

**Design inspiration:** Spotify · Apple · Airbnb · Resident Advisor · Instagram · Google Maps

The app should feel modern, elegant and trustworthy.

---

## Platform

| Layer | Choice |
|-------|--------|
| Primary target | Android first |
| Framework | React Native + Expo |
| Language | TypeScript |
| Routing | Expo Router |
| Backend | Supabase |
| Maps | Mapbox (later) |
| Push | Notifications (later) |

---

## Long Term Roadmap

| Version | Scope |
|---------|-------|
| **0.1** | Beautiful frontend, navigation, dummy events, premium UI |
| **0.2** | Supabase, authentication, users, organizers, admins |
| **0.3** | Real events, favorites, published feed |
| **1** | Public release |
| **2** | Automatic event discovery |
| **3** | Organizer ecosystem |
| **4** | Community |
| **5** | AI powered recommendations |

---

## Design System

| Token | Value |
|-------|-------|
| Background | `#0B0B0F` |
| Surface | `#15151B` |
| Elevated | `#1F1F27` |
| Primary | `#7C3AED` |
| Highlight | `#A855F7` |
| Text Primary | `#F5F5F5` |
| Text Secondary | `#9CA3AF` |
| Border | `#2A2A35` |
| Success | `#22C55E` |
| Danger | `#EF4444` |

**Principles:** Premium · Minimal · Calm · Elegant · No excessive glow.

---

## Home Screen

The Home screen is the heart of the app. Users should instantly understand: *There are real events near me.*

Home should contain:

- Current location
- Search
- Date filters
- Genre filters
- Featured event
- Nearby events
- Trending
- Tonight
- Weekend
- Popular organizers

**Never make Home feel empty.**

---

## Event Cards

Cards should always contain:

- Flyer
- Title
- Date
- Time
- Venue
- City
- Distance
- Genres
- Price
- Favorite button
- Ticket button
- Verified organizer badge

Cards should be premium.

---

## Event Detail

- Hero image / Flyer
- Description
- Venue & Address
- Genres
- Date & Time
- Organizer
- Line-up
- Ticket button
- Share
- Favorite
- Map preview
- Similar events

---

## Event Sources

Events should **NEVER** rely on only one source.

Support multiple source types:

- Organizer submission
- User submission
- Ticketmaster, Eventim, Eventbrite, Shotgun, Resident Advisor
- Club Websites, Festival Websites
- Instagram Links
- CSV, Text Import, Flyer Import
- Future AI Import

---

## Event Lifecycle

```
Draft
  ↓
Pending Review
  ↓
Imported Draft
  ↓
Needs Review
  ↓
Approved
  ↓
Published

Rejected · Duplicate
```

**Public users only see Published events.**

---

## Roles

| Role | Access |
|------|--------|
| Guest | Discover (limited) |
| User | Discover, favorites, submissions |
| Organizer | Dashboard, create/manage events |
| Admin | Review, import, sources, stats |

Each role only sees relevant tools.

---

## Admin

- Dashboard
- Review Queue
- Import Manager
- Source Manager
- Duplicate Detection
- Reports
- Statistics
- Organizer Verification

---

## Organizer

- Organizer Dashboard
- Create Event
- Drafts · Pending · Published · Rejected
- Analytics (later)

---

## User

- Discover Events
- Favorites
- My Submissions
- Notifications (later)

---

## Source Manager

The platform should eventually support automatic discovery.

Sources include: club websites, festival websites, ticket platforms, event platforms, organizer feeds, CSV, manual imports, flyer parsing, AI extraction.

**The architecture must allow adding new sources without rewriting the system.**

---

## Automation

**Never publish automatically.**

```
Source → Import → Duplicate Detection → Review → Publish
```

---

## Code Quality

- Modular architecture
- No large duplicated code blocks
- Reusable components
- Business logic separated into services
- Hooks for state
- Strong types, constants, reusable UI

---

## UX

The app should feel alive. Add subtle:

- Fade animations
- Button feedback
- Card press feedback
- Smooth transitions
- Skeleton loading
- Empty states
- Success states
- Error states

Do **NOT** overuse animations.

---

## Important Principles

1. Always think long-term
2. Never implement a feature in a way that blocks future scalability
3. Every Sprint must leave the app in a working state

When adding new functionality:

1. Preserve existing features
2. Preserve UI consistency
3. Preserve architecture quality
4. Fix all TypeScript errors
5. Fix all navigation errors
6. Test routes
7. Summarize changes after each Sprint

Think like the CTO of a startup that aims to become the world's largest electronic music platform.
