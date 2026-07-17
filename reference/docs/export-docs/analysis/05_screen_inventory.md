# 05 — Screen Inventory

**Routing:** Expo Router file-based · **Gesamt:** 27 Screen-Dateien

---

## Tab Screens (öffentlich)

| Route | Datei | Screen-Name | Mockup | Band-Feature | Status |
|-------|-------|-------------|--------|--------------|--------|
| `/home` | `app/(tabs)/home.tsx` | HomeScreen | 09 | Featured, Tonight, Filters | 🟡 |
| `/search` | `app/(tabs)/search.tsx` | SearchScreen | 10, 13 | Events list + filters | 🟡 |
| `/map` | `app/(tabs)/map.tsx` | MapScreen | 12 | Mapbox map | 🔴 |
| `/favorites` | `app/(tabs)/favorites.tsx` | FavoritesScreen | 14 | Saved events | ✅ |
| `/profile` | `app/(tabs)/profile.tsx` | ProfileScreen | 15, 19 | Stats, settings | 🟡 |

### Tab-Layout
| Route | Datei | Beschreibung |
|-------|-------|--------------|
| — | `app/(tabs)/_layout.tsx` | Custom `BottomNav`, `lazy: false` (alle Tabs mounten sofort) |

---

## Auth & User Flows

| Route | Datei | Mockup | Guard | Status |
|-------|-------|--------|-------|--------|
| `/login` | `app/login.tsx` | 07 | Supabase required | 🟡 |
| `/register` | `app/register.tsx` | 08 | Supabase required | 🟡 |
| `/add-event` | `app/add-event.tsx` | — (Form) | User wenn remote | ✅ |
| `/my-submissions` | `app/my-submissions.tsx` | 22 | User wenn remote | 🟡 Tabs ✅ |

---

## Event Detail

| Route | Datei | Mockup | Status |
|-------|-------|--------|--------|
| `/event/[id]` | `app/event/[id].tsx` | 11 | 🟡 Share fehlt |

---

## Organizer (intern)

| Route | Datei | Mockup | Rolle | Status |
|-------|-------|--------|-------|--------|
| `/organizer` | `app/organizer.tsx` | 20, 25 | organizer | 🟡 |
| `/organizer/create-event` | `app/organizer/create-event.tsx` | 21 | organizer | 🟡 |
| `/organizer/edit/[id]` | `app/organizer/edit/[id].tsx` | 26–30 | organizer | 🟡 1 Form vs 5 Steps |
| `/organizer/preview/[id]` | `app/organizer/preview/[id].tsx` | 32 | organizer | 🟡 |

---

## Admin (intern)

| Route | Datei | Mockup | Guard | Status |
|-------|-------|--------|-------|--------|
| `/admin` | `app/admin.tsx` | 41 | Demo: none | ✅ |
| `/admin/review-events` | `app/admin/review-events.tsx` | 42, 43 | Demo: none | ✅ |
| `/admin/review/edit/[id]` | `app/admin/review/edit/[id].tsx` | 43 | ⚠️ nicht in Stack.Screen | ✅ |
| `/admin/import` | `app/admin/import.tsx` | 45 | — | ✅ |
| `/admin/import/preview/[id]` | `app/admin/import/preview/[id].tsx` | 45 | — | ✅ |
| `/admin/import/edit/[id]` | `app/admin/import/edit/[id].tsx` | 45 | — | ✅ |
| `/admin/sources/index` | `app/admin/sources/index.tsx` | 44 | isAdmin wenn remote | ✅ |
| `/admin/sources/add` | `app/admin/sources/add.tsx` | 44 | — | ✅ |
| `/admin/sources/edit/[id]` | `app/admin/sources/edit/[id].tsx` | 44 | — | ✅ |
| `/admin/sources/[id]/drafts` | `app/admin/sources/[id]/drafts.tsx` | 44 | — | ✅ |

---

## Root & Redirect

| Route | Datei | Funktion |
|-------|-------|----------|
| `/` | `app/index.tsx` | Redirect → `/home` |
| — | `app/_layout.tsx` | Provider tree + Stack config |

---

## Fehlende Screens (Mockups ohne Code)

| Mockup | Geplanter Screen | Priorität | Band |
|--------|------------------|-----------|------|
| 02 | Brand Splash | Niedrig | 2 |
| 03–06 | Onboarding (4 slides) | Mittel | 1 |
| 16–17 | My Tickets / Ticket Detail | V3+ | 1 |
| 18 | Notifications | Mittel | 2 |
| 19 | Settings (dediziert) | Mittel | 2 |
| 33 | Draft Filter | Niedrig | Organizer |
| 34–37 | Analytics (4 screens) | V3+ | 1 |
| 38–40 | Organizer Profile, Team, Integrations | V3+ | 1 |
| 46 | Reports | Hoch | 4 |
| 47 | User Management | Mittel | 4 |
| 48 | Admin Statistics (erweitert) | Mittel | 5 |
| 49–50 | Organizer Onboarding / Verification | Mittel | 4 |
| 51 | Help & Support | Niedrig | 5 |

---

## Screen → Hook → Service Mapping

| Screen | Primary Hooks | Services |
|--------|---------------|----------|
| home, search, map, favorites | `usePublicEventFeed`, `useFavorites` | events (via store) |
| profile | `useAuth`, `useFavorites` | auth, profiles |
| add-event | `useEventStore`, `useDuplicateCheck` | events |
| my-submissions | `useEventStore`, `useAuth` | events |
| event/[id] | `useEventStore`, `useFavorites` | events |
| organizer/* | `useEventStore`, `useAuth` | events |
| admin/* | `useEventStore`, `useEventSources`, `useAuth` | events, imports, eventSources |
| login/register | `useAuth` | authService |

---

## Navigation-Transitions

Definiert in `src/constants/navigation.ts`:
- **none:** Tabs, Index
- **modal:** login, register
- **push:** alle anderen Stack-Screens

Mockup 71/76 (Navigation Animations): nur Basis-Expo-Defaults implementiert.

---

## Screen-Abweichungen von Mockups (Top 10)

1. **Home (09):** Kein Bell, keine Trending/Organizers, Hamburg statt Berlin
2. **Map (12):** Komplett Placeholder
3. **Profile (15):** Visited-Stat fehlt, Following hardcoded
4. **Event Detail (11):** Kein Share
5. **Organizer Create (21):** Kein visueller Step-Wizard wie Mockup
6. **Settings (19):** Nur Placeholder-Zeilen in Profile
7. **Reports (46):** Screen existiert nicht
8. **Onboarding (03–06):** Komplett fehlend
9. **Tickets (16–17):** Komplett fehlend (Vision V3+)
10. **Analytics (34–37):** Komplett fehlend (Vision V3+)

---

*27 implementierte Screens · 52+ Mockup-Screens/States ohne dedizierte Route*
