# Sprint 01 — Home Foundation Report

**Datum:** 17. Juli 2026  
**Status:** Abgeschlossen  
**Referenz-Mockup:** `reference/mockups/screens/09_Home.jpg`

---

## 1. Ziel des Sprints

Ersten echten V1-Screen implementieren: **Home** mit Tab-Navigation, Demo-Events, lokalem Favoriten-State und Event-Detail-Platzhalter — ohne Backend, Auth oder weitere Screens.

---

## 2. Implementierte Dateien

### Router & Screens

| Datei | Zweck |
|-------|-------|
| `app/_layout.tsx` | Root Stack: Tabs + Event Detail |
| `app/(tabs)/_layout.tsx` | Bottom Tab Navigation (5 Tabs) |
| `app/(tabs)/index.tsx` | Home Screen |
| `app/(tabs)/search.tsx` | Events-Platzhalter |
| `app/(tabs)/map.tsx` | Map-Platzhalter |
| `app/(tabs)/saved.tsx` | Saved-Platzhalter |
| `app/(tabs)/profile.tsx` | Profile-Platzhalter |
| `app/event/[id].tsx` | Event-Detail-Platzhalter |

### Feature & Data

| Datei | Zweck |
|-------|-------|
| `src/features/events/data/demo-events.ts` | 5 Demo-Events + Filter-Chips |
| `src/features/home/components/*` | Home-spezifische UI-Komponenten |
| `src/components/buttons/FavoriteButton.tsx` | Wiederverwendbarer Favoriten-Button |
| `assets/demo/*.png` | Lokale Event-Bilder (5 Dateien) |

---

## 3. Implementierte Komponenten

| Komponente | Pfad |
|------------|------|
| HomeHeader | `src/features/home/components/HomeHeader.tsx` |
| LocationSelector | `src/features/home/components/LocationSelector.tsx` |
| NotificationButton | `src/features/home/components/NotificationButton.tsx` |
| SearchBar | `src/features/home/components/SearchBar.tsx` |
| FilterChip | `src/features/home/components/FilterChip.tsx` |
| FilterChipRow | `src/features/home/components/FilterChipRow.tsx` |
| SectionHeader | `src/features/home/components/SectionHeader.tsx` |
| FeaturedEventCard | `src/features/home/components/FeaturedEventCard.tsx` |
| EventCard | `src/features/home/components/EventCard.tsx` |
| FavoriteButton | `src/components/buttons/FavoriteButton.tsx` |

---

## 4. Navigation

- **Bottom Tabs:** Home · Events · Map · Saved · Profile
- **Stack:** Event-Karten navigieren zu `/event/[id]`
- **Zurück:** Event-Detail hat Back-Button via `router.back()`
- **Initial Route:** `/(tabs)` → Home (`index.tsx`)

---

## 5. Responsive-Verhalten

Geprüft auf Web mit Viewport-Breiten 360px, 390px, 430px:

- Screen-Padding 16px bleibt stabil
- Filter-Chips horizontal scrollbar ohne Abschneiden
- Featured Cards fixe Breite 300px mit horizontalem Scroll
- Event-List-Rows nutzen `flex: 1` + `numberOfLines` für Text
- ScrollView mit `paddingBottom` für Tab-Bar + Safe Area
- Keine festen Screen-Höhen

---

## 6. Designsystem-Anpassungen

Bestätigt durch Home-Umsetzung (aktualisiert in `DESIGN_GUIDELINES.md`):

| Token | Wert | Status |
|-------|------|--------|
| `headerContentHeight` | 56 | Bestätigt |
| `chipHeight` | 32 | Bestätigt |
| `featuredHeroAspectRatio` | 16/9 | Bestätigt |
| `bottomNavHeight` | 64 | Bestätigt |
| `searchFieldHeight` | 44 | Bestätigt |

Keine neuen Farben oder Abweichungen von bestehenden Tokens eingeführt.

---

## 7. Bekannte Abweichungen vom Mockup

| Abweichung | Grund |
|------------|-------|
| **Top Clubs** Sektion fehlt | Nicht in Sprint-1-Mindestumfang; Fokus auf Event-Bereiche |
| Logo ist Ionicons-Diamond | Kein separates Hex-Logo-Asset im Repo |
| Suchfeld nicht editierbar | Sprint 1 — keine Suchlogik |
| Filter-/Options-Icon ohne Funktion | Sprint 1 — keine erweiterte Filterung |
| „Mehr anzeigen" ohne Navigation | Sprint 1 — keine Ziel-Screens |
| Kein Preis auf Featured Cards | Demo-Datenfeld nicht vorgesehen |
| Trending/Popular Organizers fehlen | Nicht in Mockup 09 sichtbar (nur in älterer Doku) |

---

## 8. Testergebnisse

| Prüfung | Ergebnis |
|---------|----------|
| `npm run lint` | ✅ 0 Fehler |
| `npx tsc --noEmit` | ✅ 0 Fehler |
| `npx expo-doctor` | ✅ 20/20 |
| `npx expo start --web` | ✅ Home lädt |
| Tab-Navigation | ✅ Funktioniert |
| Event-Detail-Route | ✅ Navigierbar |
| Favoriten-Toggle | ✅ Lokal in Session |

---

## 9. Offene Punkte

- Top Clubs Sektion (Mockup 09, unterer Bereich)
- Echtes Hex-Logo-Asset
- Interaktive Suche und erweiterte Filter
- Favoriten-Persistenz
- Events/Search Screen (Mockup 10)
- Font-Familie final festlegen

---

## 10. Empfohlener nächster Sprint

**Sprint 2 — Events / Search Screen (Mockup 10)**

1. `app/(tabs)/search.tsx` nach Mockup 10 umsetzen
2. Event-List-Layout verfeinern (Ergebniszähler)
3. Filter-Chips mit echter Filterlogik
4. Gemeinsame Event-Komponenten mit Home konsolidieren
5. Optional: Top Clubs Sektion auf Home nachziehen
