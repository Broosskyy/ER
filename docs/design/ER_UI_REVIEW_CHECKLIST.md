# ER UI Review Checklist

**Status:** Kanonisch · Sprint 1 Design DNA  
**Zweck:** Pflichtprüfung vor jedem UI-Merge — Screen, Komponente oder Admin-Änderung.

---

## Anleitung

Jeder Punkt ist **Pass / Fail**. Ein Fail blockiert den Merge, bis behoben oder begründet dokumentiert.

Prüfer: Entwickler, Reviewer oder KI (Cursor) vor Abschluss.

---

## A. Constitution (Nicht verhandelbar)

| # | Prüfpunkt | Pass |
|---|-----------|------|
| A1 | Content First — Flyer/Fotos/Namen dominieren, UI tritt zurück | ☐ |
| A2 | Maximal **eine** primäre Aktion pro Screen | ☐ |
| A3 | Kein Gaming/Cyberpunk/Neon-Look | ☐ |
| A4 | Kein Enterprise-Backoffice-Look (auch Admin) | ☐ |
| A5 | Touch Targets ≥ 44px | ☐ |
| A6 | WCAG AA Kontrast für Text | ☐ |
| A7 | Keine hardcodierten Farben — nur Tokens | ☐ |
| A8 | Kein Box-in-Box ohne dokumentierten Grund | ☐ |

---

## B. Layout & Spacing

| # | Prüfpunkt | Pass |
|---|-----------|------|
| B1 | `screenHorizontal` (16px) auf allen Seiten | ☐ |
| B2 | Spacing aus 8pt-System — keine Arbitrary Values | ☐ |
| B3 | Ausreichend Whitespace zwischen Sektionen | ☐ |
| B4 | Ein Scroll-Container (kein Header+FlatList auf Admin Mobile) | ☐ |
| B5 | Safe Areas berücksichtigt | ☐ |
| B6 | `minHeight: 0` auf flex Scroll-Children (Web) | ☐ |
| B7 | Bottom Nav Overlap berücksichtigt (listBottomInset) | ☐ |
| B8 | Keine unnötigen Borders als Sektions-Trenner | ☐ |

---

## C. Typografie

| # | Prüfpunkt | Pass |
|---|-----------|------|
| C1 | `AppText` mit `textRoles` — kein inline fontSize/fontWeight | ☐ |
| C2 | Hierarchie erkennbar: Screen Title → Section → Card → Meta | ☐ |
| C3 | Maximal 2 Text-Farben pro Abschnitt | ☐ |
| C4 | Keine ALL CAPS Section Headers | ☐ |
| C5 | Card Titles max 2 Zeilen mit Ellipsis | ☐ |
| C6 | Form Labels sichtbar über Inputs | ☐ |

---

## D. Farbe & Theme

| # | Prüfpunkt | Pass |
|---|-----------|------|
| D1 | Alle Farben aus `colors` / `colorRoles` | ☐ |
| D2 | Violett nur als Akzent — max 1 Primary CTA | ☐ |
| D3 | Semantische Farben nur für Status | ☐ |
| D4 | Light Mode nicht als invertierter Dark Mode | ☐ |
| D5 | Kein Gradient auf Standard-Buttons | ☐ |

---

## E. Komponenten

| # | Prüfpunkt | Pass |
|---|-----------|------|
| E1 | Bestehende Komponenten wiederverwendet (nicht neu erfunden) | ☐ |
| E2 | Cards nur wo Inhalt gruppiert wird | ☐ |
| E3 | Buttons: Primary / Secondary / Icon korrekt eingesetzt | ☐ |
| E4 | Destructive Actions sekundär und klar getrennt | ☐ |
| E5 | Empty State vorhanden (wenn Liste leer sein kann) | ☐ |
| E6 | Skeleton Loading (wenn Daten async geladen) | ☐ |
| E7 | Error State inline — nicht nur Console Log | ☐ |
| E8 | Kein Modal über Modal | ☐ |

---

## F. Admin-spezifisch

| # | Prüfpunkt | Pass |
|---|-----------|------|
| F1 | Gleiche Typografie und Spacing wie Consumer | ☐ |
| F2 | Keine Stat-Card-Grids — Inline Metrics bevorzugt | ☐ |
| F3 | ScrollView statt verschachtelter Listen (Mobile Web) | ☐ |
| F4 | Formulare: Label über Input, nicht in Card-Wrapper | ☐ |
| F5 | Actions am Ende des Scroll-Flows | ☐ |
| F6 | Kompakte Rows statt schwerer Cards | ☐ |
| F7 | Kein „ADMIN" Banner oder Enterprise-Chrome | ☐ |

---

## G. Motion & Feedback

| # | Prüfpunkt | Pass |
|---|-----------|------|
| G1 | Loading: Skeleton oder Inline — kein Full-Screen Spinner | ☐ |
| G2 | Übergänge 200–300ms (wenn animiert) | ☐ |
| G3 | Keine dauerhaften Animationen (außer Skeleton) | ☐ |
| G4 | `prefers-reduced-motion` berücksichtigt | ☐ |
| G5 | Pressed States auf interaktiven Elementen | ☐ |

---

## H. Responsive

| # | Prüfpunkt | Pass |
|---|-----------|------|
| H1 | Mobile (360×800) getestet | ☐ |
| H2 | Mobile (390×844) getestet | ☐ |
| H3 | Desktop (1440×900) getestet (Admin) | ☐ |
| H4 | Kein horizontaler Overflow | ☐ |
| H5 | Text bricht korrekt um (URLs, lange Namen) | ☐ |

---

## I. Content & States

| # | Prüfpunkt | Pass |
|---|-----------|------|
| I1 | Loading State definiert | ☐ |
| I2 | Empty State definiert | ☐ |
| I3 | Error State mit Retry definiert | ☐ |
| I4 | Bilder haben Placeholder/Fallback | ☐ |
| I5 | Lange Texte haben Ellipsis oder Expand | ☐ |

---

## J. Die eine Frage

| # | Prüfpunkt | Pass |
|---|-----------|------|
| J1 | Jedes UI-Element hat einen Mehrwert — nichts Überflüssiges | ☐ |

---

## Ergebnis

| Kategorie | Pass | Fail | N/A |
|-----------|------|------|-----|
| A. Constitution | /8 | | |
| B. Layout | /8 | | |
| C. Typografie | /6 | | |
| D. Farbe | /5 | | |
| E. Komponenten | /8 | | |
| F. Admin | /7 | | |
| G. Motion | /5 | | |
| H. Responsive | /5 | | |
| I. Content | /5 | | |
| J. Reduktion | /1 | | |
| **Gesamt** | **/58** | | |

**Merge-Regel:** Alle A-Punkte müssen Pass sein. Gesamt ≥ 95% Pass (max 3 Fail in B–J mit Begründung).

---

## Verwandte Dokumente

- `ER_UI_CONSTITUTION.md`
- `ER_DO_AND_DONT.md`
- `ER_CURSOR_UI_GUIDE.md`
- `ER_DESIGN_EVOLUTION_V2.md`
