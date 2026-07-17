# 03 — Gap Analysis (Code vs. Dokumentation vs. Mockups)

**Referenz:** Band 0–5 unter `/docs` · 79 Mockups unter `/assets/mockups`  
**Legende:** ✅ Vorhanden · 🟡 Teilweise · 🔴 Fehlt · ⚠️ Inkonsistent

---

## 1. Was bereits vorhanden ist

### Produkt & MVP (Band 1)
- Kernfrage „Events near me" beantwortbar (Feed + Filter + Detail)
- 5-Tab-Navigation exakt wie Master Prompt
- Premium Dark UI ohne Cyberpunk-Gaming-Look
- Rollenmodell user / organizer / admin in DB + Hooks
- Event-Lifecycle vollständig modelliert; Public Feed = nur `published`
- User Submission + Admin Review + Import Pipeline (Mock-Parser)
- Duplicate Detection (Heuristik + Admin-Aktionen)
- Dual-Mode: Demo ohne Supabase + Live mit Fallback-Banner

### UI (Band 2 + Mockups 09–15, 41–45)
- Home, Events, Saved, Profile, Event Detail, Add Event
- Featured Card, Event Cards (list/compact), Story Circles
- Filter Chips (Date, Genre, City)
- Skeleton, Empty, Error, Pull-to-Refresh
- Admin Dashboard, Review Queue, Import, Source Manager
- Flyer-Fallback (`EventImageFallback`) — Sprint 1.5

### Backend (Band 4)
- Supabase Client + Auth Persistence (AsyncStorage)
- Migrationen 001–004, Seed-Scripts (30 published Events)
- RLS, Profile-Trigger, Favorites-Tabelle
- Service-Layer mit `ServiceResult<T>` + offline-Flag

### Development (Band 3)
- TypeScript strict, Expo SDK 56, Expo Router
- Modulare Ordnerstruktur wie dokumentiert
- APK-Release v1.7.0 (Band 5 README)

---

## 2. Was fehlt

### Gegenüber Mockups (hohe Priorität)
| Feature | Mockup(s) | Band |
|---------|-----------|------|
| Onboarding Flow | 03–06 | Band 1 User Journey |
| Notification Bell + Center | 09, 18 | Band 2 Home |
| Echte Map (Mapbox) | 12 | Band 1 Future |
| GPS / echte Distanz | 09, 10 | Band 1 MVP |
| Trending + Popular Organizers | 09 | MOCKUP-SCREENS |
| Share Event | 11 | MASTER-PROMPT Detail |
| Tickets (Wallet, QR) | 16–17 | V3+ laut Vision |
| Reports UI | 46 | Band 4 / Admin |
| User Management | 47 | Admin Bible |
| Organizer Verification UI | 50 | Band 4 |
| Dialog/Toast System | 58, 61 | Band 2 Components |
| Typography/Spacing DS als Code | 63–65 | Band 2 |

### Gegenüber Dokumentation (Band 3 Tech Stack)
| Geplant | Ist |
|---------|-----|
| Zustand | React Context |
| TanStack Query | Manuelles fetch in Hooks |
| Mapbox | MapPlaceholder |
| expo-location | Statische Stadt Hamburg |
| Echtes URL-Scraping | urlImporterMock |
| Cron/Edge Functions | — |
| Unit/E2E Tests | — |
| i18n DE/EN | UI Englisch |

### Gegenüber Band 5 Operations
| Prozess | Status |
|---------|--------|
| Play Store Listing | 🔴 |
| Privacy Policy | 🔴 |
| Analytics (Firebase/Amplitude) | 🔴 |
| Push Notifications | 🔴 |
| QA-Runbooks | Nur Stub-Kapitel |
| AAB/arm64 APK-Optimierung | Universal 105MB APK |

---

## 3. Was doppelt oder inkonsistent ist

| Thema | Detail | Risiko |
|-------|--------|--------|
| Submission-Datenmodell | `event_submissions` Tabelle + `submissions.ts` vs. aktiver Pfad über `events` | Verwirrung, Dead Code |
| Service-Facades | `eventService.ts`, `submissionService.ts`, … re-export only, ungenutzt | Naming-Noise |
| `adminService.ts` | Vollständig, aber `useEventStore` dupliziert Logik | Wartbarkeit |
| Source-Typen | `ImportSource` (lifecycle) vs. `EventSourceType` (eventSource) | Mapping nötig |
| UI-Status-Strings | Title Case UI vs. snake_case DB | lifecycleMap.tsx als Brücke |
| Default-Stadt | Code: Hamburg · Mockup/Docs: Berlin | UX-Inkonsistenz |
| MOCKUP-SCREENS.md | Behauptet „kein Result Count", „keine Submission Tabs" — **Code hat beides** | Docs veraltet |
| package.json version | 1.0.0 vs. app.json 1.7.0 | Release-Inkonsistenz |
| Verified Badge | `Event.isVerified` vs. `Organizer.verified` — unterschiedliche Logik in Mapper | UI uneinheitlich |
| Demo Admin | Admin ohne Auth im Demo-Modus | Sicherheit (Dev-only OK) |
| Dummy Fallback | 0 published in Prod → zeigt Demo-Events | Produktions-Risiko |

---

## 4. Screens die nicht zur Dokumentation passen

| Screen | Abweichung |
|--------|------------|
| `/(tabs)/home` | EN-Labels, kein Notification-Bell, keine Trending/Organizers-Sektion |
| `/(tabs)/map` | Placeholder statt Mapbox (Band 1 Future, Mockup 12) |
| `/(tabs)/profile` | „Following: 3" hardcoded; „Visited" fehlt (Mockup 15) |
| `/organizer` | Mock-Stats (Views 1.2k); kein 5-Step-Edit wie Mockups 26–30 |
| `/admin` | Kein Link zu Reports (Mockup 46) trotz DB-Tabelle |
| — fehlend — | Onboarding 03–06, Tickets 16–17, Settings 19, Analytics 34–37 |

---

## 5. Komponenten die vereinheitlicht werden müssen (später)

| Gruppe | Komponenten | Problem |
|--------|-------------|---------|
| Event Cards | `EventCard`, `FeaturedEventCard`, `SubmissionCard`, `ImportPreviewCard`, `ReviewCard` | Ähnliche Layouts, unterschiedliche Props/Styles |
| Form Layouts | `FormScreenLayout`, inline ScrollViews in Screens | Kein einheitliches Step-Wizard-Pattern |
| Status Anzeige | `StatusBadge`, inline status colors in lifecycle.ts, eventSource.ts | Farben `#F59E0B` hardcoded außerhalb theme |
| Preview Cards | `ImportPreviewCard`, `SubmissionCard` | Duplicate-Warning-Duplikation |
| Screen Shells | `TabScreenLayout`, `AppScreen`, `FormScreenLayout` | 3 Layout-Wrapper — Rolle überlappend |
| Map UI | `MapPlaceholder`, `LocationPreview`, `MapBottomSheet` | Alle Placeholder — später Mapbox-Wrapper |

---

## 6. Fehlende Design-Tokens

| Token-Kategorie | In theme.ts | In Mockups 62–69 |
|-----------------|-------------|------------------|
| Colors | ✅ Vollständig | ✅ |
| Spacing | ✅ Basis-Scale | 🟡 Grid-System fehlt |
| BorderRadius | ✅ | ✅ |
| Typography | 🔴 | Font sizes, weights, line-heights |
| Elevation/Shadow | 🔴 | Mockup 65 |
| Icon sizes | 🔴 | Mockup 66 |
| Motion durations/easing | 🔴 | Mockup 70–76 |
| Semantic colors (warning) | 🔴 `#F59E0B` ad-hoc | — |
| Z-Index layers | 🔴 | Bottom sheet, modal |

---

## 7. Technische Risiken

| Risiko | Schwere | Beschreibung |
|--------|---------|--------------|
| God Store | Hoch | `useEventStore` ~1050 LOC — jede Mutation re-rendert alle Consumer |
| Keine Virtualisierung | Hoch | ScrollView + map bei wachsender Event-Liste |
| Untyped Supabase | Mittel | Schema-Drift nicht compile-time erkannt |
| Legacy event_submissions | Mittel | Zwei parallele Submission-Modelle |
| Demo Fallback in Prod | Mittel | Leere DB zeigt Fake-Events |
| Admin ohne Guard | Mittel | Demo-OK, Prod-Risiko wenn Env fehlt |
| Keine Tests | Hoch | Regression bei Sprint-Arbeit |
| 105MB APK | Niedrig | UX beim Download, nicht Funktion |
| Accessibility | Mittel | Screenreader praktisch nicht bedienbar |

---

## 8. Dateien die zuerst angepasst werden sollten (Empfehlung — noch nicht umsetzen)

**Phase A — Dokumentation synchronisieren (risikoarm):**
- `docs/02-ui-design/MOCKUP-SCREENS.md` — Result Count, Submission Tabs korrigieren
- `docs/02-ui-design/MOCKUP-ALIGNMENT.md` — Stand v1.7.0

**Phase B — Niedrig-Risiko UI-Gaps:**
- `app/(tabs)/home.tsx` — Trending, Organizers-Sektion
- `app/event/[id].tsx` — Share-Button
- `app/(tabs)/profile.tsx` — Stats Row vervollständigen

**Phase C — Architektur (vorsichtig, inkrementell):**
- `src/hooks/useEventStore.tsx` — aufteilen (Feed / Admin / Submissions)
- `src/types/database.ts` — event_sources ergänzen
- `src/constants/theme.ts` — warning color, typography tokens

**Phase D — Backend-Härtung:**
- Route Guards in `app/_layout.tsx` oder Screen-level
- Dummy-Fallback nur im Dev/Demo-Modus

---

## 9. UX-Probleme (qualitativ)

- Standort wirkt „echt", ist aber statisch → Vertrauensbruch vs. Mockup
- Map-Tab wirkt unfertig (Placeholder-Text sichtbar)
- EN/DE-Mischung vs. deutschsprachige Mockups
- Kein Feedback nach Aktionen außer SuccessState (keine Toasts)
- Organizer-Flow wirkt „Admin-light" statt eigenständiges Produkt
- Filter auf Search: 3 horizontale Scroll-Reihen — viel Scrollen auf kleinen Screens

---

*Keine Codeänderungen vorgenommen. Nächster Schritt: `10_migration_roadmap.md`.*
