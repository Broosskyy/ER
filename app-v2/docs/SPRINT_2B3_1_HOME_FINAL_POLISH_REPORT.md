# Sprint 2B.3.1 — Home Golden Screen Final Polish

**Datum:** 2026-07-26  
**Scope:** Nur Home-Polish — keine neuen Features, keine Architekturänderungen.

---

## 1. Logo-System

**✓ erledigt**

- Zentrale Konfiguration: `src/components/branding/eternal-rave-logo.ts`
- Einzige Logo-Komponente: `src/components/branding/EternalRaveLogo.tsx`
- Export über `src/components/index.ts`
- `HomeHeader` nutzt `<EternalRaveLogo />` statt hartcodiertem Wordmark
- Austausch später: `imageSource` in `eternal-rave-logo.ts` per `require()` setzen → App-weite Aktualisierung
- Aktuell: Wordmark-Fallback „ETERNAL RΛVE“ (wie zuvor)

---

## 2. Header (Mockup 09)

**✓ erledigt**

- Filter-Icon (`options-outline`) neben Location in `LocationSelector`
- Icon öffnet bestehenden Events-Tab (`/(tabs)/search`) — keine neue Navigation
- Abstände & vertikale Ausrichtung: Header `minHeight: 52`, Location-Row mit `gap`, CitySelector flex + IconButton rechts
- Such-Lupe unverändert in `HomeHeaderSearchButton`

---

## 3. Deutsche Texte (Home)

**✓ erledigt**

| Vorher | Nachher |
|--------|---------|
| Events near you | Events in deiner Nähe |
| Tonight | Heute Abend |
| This Weekend | Dieses Wochenende |
| Upcoming | Demnächst |
| See all | Mehr anzeigen |
| Top Clubs | Top Clubs |
| EN Empty States | DE Empty States (Home-Collections) |

- i18n: `home.sections.seeAll`, `home.sections.topClubs`, `home.filter.a11y` (de + en)
- Genre-Namen (Techno, House) bewusst unverändert — etablierte Begriffe

**✗ bewusst nicht geändert:** Search/Explore-Tab, Profile, Saved, Admin — außerhalb Sprint-Scope

---

## 4. Micro Polish

**✓ erledigt** (aus Sprint 2B.3 übernommen, keine weiteren Änderungen nötig)

- `homeGoldenSpacing`: Sektionsabstände, Tonight-Row-Gaps, Clubs-Section-Top
- Featured/Clubs/Tonight-Layouts aus 2B.3 unverändert beibehalten

---

## 5. Responsive QA

**✓ erledigt** (statische Prüfung)

- `ResponsiveScreen` + bestehende Breakpoint-Logik unverändert
- Featured-Pair-Width, Club-Spotlight-Width: weiterhin viewport-basiert
- Keine plattformspezifischen Regressionen in Tests (639/639 bestanden)

**✗ bewusst nicht geändert:** Manuelles Device-QA auf physischen Geräten — nicht in dieser Session durchgeführt

---

## 6. Nicht geändert (wie gefordert)

**✓ eingehalten**

- Keine Businesslogik-, Navigation-, Saved-, Profile-Änderungen
- Kein Theme-, Animations-, Component-API-Refactoring (außer neuer Logo-Komponente)
- Keine neue Suchleiste auf Home

---

## Tests & Build

- `npm run typecheck` — bestanden
- `npm test` — 639/639 bestanden
- APK: `C:\ER\releases\Eternal-Rave-v0.2.0-preview-2b3.1.apk`
