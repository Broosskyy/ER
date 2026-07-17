# 02 — Mockup Index (79 Screens)

**Quelle:** `/assets/mockups/Eternal_Rave_Screens_Renamed*.zip` (8 Archive)  
**Regel:** Mockups werden **nicht umbenannt** — logische Zuordnung hier dokumentiert.

---

## ZIP-Übersicht

| ZIP | Mockups | Nummernbereich |
|-----|---------|----------------|
| `Eternal_Rave_Screens_Renamed.zip` | 10 | 01–10 |
| `Eternal_Rave_Screens_Renamed_Part2.zip` | 10 | 11–20 |
| `Eternal_Rave_Screens_Renamed_Part3.zip` | 10 | 21–30 |
| `Eternal_Rave_Screens_Renamed_Part4.zip` | 10 | 31–40 |
| `Eternal_Rave_Screens_Renamed_Part5.zip` | 10 | 41–50 |
| `Eternal_Rave_Screens_Renamed_Part6.zip` | 10 | 51–60 |
| `Eternal_Rave_Screens_Renamed_Part7.zip` | 10 | 61–70 |
| `Eternal_Rave_Screens_Renamed_Part8.zip` | 9 | 71–79 |
| **Gesamt** | **79** | |

---

## Kategorie A — App Flow & Onboarding (01–08)

| # | Dateiname | Logische Zuordnung | Code-Route | Status |
|---|-----------|-------------------|------------|--------|
| 01 | `01_Splash_Screen_Loading.png` | Splash / Boot | `app.json` splash | 🟡 Expo-Default, nicht Mockup-identisch |
| 02 | `02_Splash_Logo.png` | Brand Splash | — | 🔴 Kein dedizierter Screen |
| 03 | `03_Onboarding_01_Welcome.png` | Onboarding 1 | — | 🔴 Fehlt |
| 04 | `04_Onboarding_02_Discover_Events.png` | Onboarding 2 | — | 🔴 Fehlt |
| 05 | `05_Onboarding_03_Community.png` | Onboarding 3 | — | 🔴 Fehlt |
| 06 | `06_Onboarding_04_Tickets.png` | Onboarding 4 | — | 🔴 Fehlt |
| 07 | `07_Login.png` | Login | `/login` | 🟡 Layout ähnlich, DE/UX-Details abweichend |
| 08 | `08_Register.png` | Register | `/register` | 🟡 |

---

## Kategorie B — Consumer Tabs (09–15)

| # | Dateiname | Route | Status |
|---|-----------|-------|--------|
| 09 | `09_Home.png` | `/(tabs)/home` | 🟡 Fehlt: Bell, Trending, Popular Organizers, DE-Filter |
| 10 | `10_Events.png` | `/(tabs)/search` | 🟡 Count vorhanden (EN), Layout OK |
| 11 | `11_Event_Details.png` | `/event/[id]` | 🟡 Fehlt Share, Map-Preview real |
| 12 | `12_Map.png` | `/(tabs)/map` | 🔴 Placeholder only |
| 13 | `13_Search_Filter.png` | `/(tabs)/search` | ✅ Filter-Chips implementiert |
| 14 | `14_Saved.png` | `/(tabs)/favorites` | ✅ |
| 15 | `15_Profile.png` | `/(tabs)/profile` | 🟡 Stats unvollständig (Visited fehlt) |

---

## Kategorie C — Tickets & Settings (16–19) — Nicht implementiert

| # | Dateiname | Geplante Funktion | Status |
|---|-----------|-------------------|--------|
| 16 | `16_My_Tickets.png` | Ticket-Wallet | 🔴 |
| 17 | `17_Ticket_Details.png` | Ticket-QR/Details | 🔴 |
| 18 | `18_Notifications.png` | Notification Center | 🔴 |
| 19 | `19_Settings.png` | Settings (Profile-Stub) | 🟡 Placeholder-Links in Profile |

---

## Kategorie D — Organizer Flow (20–30, 38–40, 49–50)

| # | Dateiname | Route / Feature | Status |
|---|-----------|-----------------|--------|
| 20 | `20_Organizer_Dashboard.png` | `/organizer` | 🟡 Basis vorhanden |
| 21 | `21_Create_Event_Step1.png` | `/organizer/create-event` | 🟡 Multi-Step vereinfacht |
| 22 | `22_Submissions.png` | `/my-submissions` | 🟡 Tabs vorhanden |
| 25 | `25_My_Events.png` | `/organizer` | 🟡 |
| 26–30 | `26–30_Edit_Event_Step*.png` | `/organizer/edit/[id]` | 🟡 5 Mockup-Steps vs. 1 Form |
| 31 | `31_Drafts_List.png` | `/organizer` | 🟡 Inline-Sections |
| 32 | `32_Draft_Details.png` | `/organizer/preview/[id]` | 🟡 |
| 33 | `33_Draft_Filter.png` | — | 🔴 |
| 34–37 | Analytics Screens | — | 🔴 V3+ |
| 38 | `38_Organizer_Profile.png` | — | 🔴 |
| 39 | `39_Team_Management.png` | — | 🔴 |
| 40 | `40_Integrations.png` | — | 🔴 |
| 49 | `49_Organizer_Onboarding.png` | — | 🔴 |
| 50 | `50_Organizer_Verification.png` | — | 🔴 (Schema: verification_status) |

---

## Kategorie E — User Submission & Success (22–24)

| # | Dateiname | Route | Status |
|---|-----------|-------|--------|
| 22 | `22_Submissions.png` | `/my-submissions` | 🟡 |
| 23 | `23_Admin_Review.png` | `/admin/review-events` | ✅ |
| 24 | `24_Submission_Success.png` | — | 🟡 `SuccessState` generisch |

---

## Kategorie F — Admin (41–48)

| # | Dateiname | Route | Status |
|---|-----------|-------|--------|
| 41 | `41_Admin_Dashboard.png` | `/admin` | ✅ |
| 42 | `42_Review_Queue.png` | `/admin/review-events` | ✅ |
| 43 | `43_Event_Review.png` | Preview/Review Cards | ✅ |
| 44 | `44_Source_Manager.png` | `/admin/sources/index` | ✅ |
| 45 | `45_Import_Manager.png` | `/admin/import` | ✅ |
| 46 | `46_Reports.png` | — | 🔴 (DB-Tabelle `reports` existiert) |
| 47 | `47_User_Management.png` | — | 🔴 |
| 48 | `48_Admin_Statistics.png` | `/admin` StatCards | 🟡 Basis only |

---

## Kategorie G — Support (51)

| # | Dateiname | Status |
|---|-----------|--------|
| 51 | `51_Help_And_Support.png` | 🔴 Profile-Link ohne Screen |

---

## Kategorie H — UI Component Library (52–60, 61)

| # | Dateiname | Code-Entsprechung | Status |
|---|-----------|-------------------|--------|
| 52 | `52_UI_Buttons_Library.png` | `PrimaryButton`, `SecondaryButton`, `AnimatedPressable` | 🟡 Teilweise |
| 53 | `53_UI_Inputs_Library.png` | `FormField` | 🟡 |
| 54 | `54_UI_Cards_Library.png` | `EventCard`, `FeaturedEventCard`, `StatCard` | 🟡 |
| 55 | `55_UI_Chips_And_Badges.png` | `FilterChip`, `EventTag`, `StatusBadge` | ✅ |
| 56 | `56_UI_Navigation_Library.png` | `BottomNav`, `ScreenHeader` | ✅ |
| 57 | `57_UI_Empty_States.png` | `EmptyState` | ✅ |
| 58 | `58_UI_Dialogs.png` | — | 🔴 Kein Dialog-System |
| 59 | `59_UI_Bottom_Sheets.png` | `MapBottomSheet` (basic) | 🟡 |
| 60 | `60_UI_Loading_And_Skeletons.png` | `LoadingSkeleton`, `EventDetailSkeleton` | ✅ |
| 61 | `61_UI_Toasts_And_Snackbars.png` | — | 🔴 |

---

## Kategorie I — Design System Specs (62–69)

| # | Dateiname | Code-Referenz | Status |
|---|-----------|----------------|--------|
| 62 | `62_DesignSystem_Color_System.png` | `theme.ts`, `tailwind.config.js` | ✅ Farben |
| 63 | `63_DesignSystem_Typography.png` | Tailwind utility classes | 🔴 Keine Typography-Tokens |
| 64 | `64_DesignSystem_Spacing_Grid.png` | `Spacing` in theme.ts | 🟡 Basis |
| 65 | `65_DesignSystem_Radius_Elevation.png` | `BorderRadius` | 🟡 Radius ja, Elevation nein |
| 66 | `66_DesignSystem_Iconography.png` | `@expo/vector-icons` Ionicons | 🟡 Ad-hoc |
| 67 | `67_DesignSystem_Illustrations.png` | `EventImageFallback` | 🟡 |
| 68 | `68_DesignSystem_Theme_Rules.png` | — | 🔴 Nicht codifiziert |
| 69 | `69_DesignSystem_Responsive_Rules.png` | SafeArea + Tab padding | 🟡 |

---

## Kategorie J — Motion & Interaction (70–79)

| # | Dateiname | Code-Referenz | Status |
|---|-----------|----------------|--------|
| 70 | `70_Motion_Principles.png` | — | 🔴 |
| 71 | `71_Navigation_Animations.png` | `StackTransition` | 🟡 Basis |
| 72 | `72_Component_Animations.png` | `AnimatedCard`, `AnimatedFavoriteButton` | 🟡 |
| 73 | `73_Loading_Animations.png` | Skeleton pulse | 🟡 |
| 74 | `74_Success_Feedback.png` | `SuccessState` | 🟡 |
| 75 | `75_Lists_Cards_Animations.png` | Pressable opacity | 🟡 |
| 76 | `76_Navigation_Transitions.png` | Expo Router defaults | 🟡 |
| 77 | `77_Gestures_Touch_Interactions.png` | GestureHandler root | 🟡 |
| 78 | `78_Motion_Haptic_Feedback.png` | `utils/haptics.ts` | 🟡 Nicht überall |
| 79 | `79_Performance_Accessibility.png` | — | 🔴 |

---

## Zusammenfassung Mockup-Abdeckung

| Status | Anzahl | Anteil |
|--------|--------|--------|
| ✅ Vollständig / nah am Mockup | ~18 | ~23% |
| 🟡 Teilweise implementiert | ~28 | ~35% |
| 🔴 Nicht implementiert | ~33 | ~42% |

**Priorität für MVP (Band 1):** Kategorien B + F (Consumer + Admin Kern) — nicht Kategorie C (Tickets) oder D-Analytics (V3+).

---

## Mockup → Dokumentations-Mapping

| Mockup-Kategorie | Band-Referenz |
|------------------|---------------|
| Consumer UI | Band 2 — MOCKUP-SCREENS, UI Design Bible |
| Organizer/Admin | Band 1 Roles, Band 4 Backend |
| Design System 62–69 | Band 2 — Design System Kapitel (Stubs) |
| Motion 70–79 | Band 2 — Motion Library Kapitel (Stub) |
| Operations/Release | Band 5 |
