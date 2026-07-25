# ER UI Constitution

**Status:** Kanonisch · Sprint 1 Design DNA  
**Gültigkeit:** Alle Eternal-Rave-Oberflächen — Consumer, Organizer, Admin, Web  
**Hierarchie:** Dieses Dokument steht über Implementierungsdetails. Bei Konflikten gewinnt die Constitution.

---

## 1. Zweck

Die UI Constitution definiert die unveränderlichen Prinzipien der Eternal-Rave-Designsprache. Sie ist kein Styleguide im engeren Sinn, sondern das verbindliche Fundament für alle Design- und Implementierungsentscheidungen.

**Quellen:** 79 UI-Mockups (ZIP-Archive 01–79), ER Design Handbook Chapter 1, ER Design System v3, ER-221 Enterprise Master Handbook, MASTER-PROMPT v3.0, Design Evolution V2.

---

## 2. Mission

Eternal Rave ist kein Event-Tool. Es ist ein **digitales Ökosystem für elektronische Musik** — Events, Artists, Clubs, Organizer und Community in einer **premium Consumer Experience**.

Die Oberfläche soll sich anfühlen wie:

- leicht
- ruhig
- hochwertig
- emotional — aber nur durch Inhalt, nicht durch UI-Dekoration

**Design Mission (Handbook Ch. 1):** Die Leichtigkeit moderner Consumer Apps bewahren und gleichzeitig die Emotion der Rave-Szene tragen. Komplexität reduzieren, damit Nutzer Menschen, Musik und Erlebnisse im Fokus haben.

---

## 3. Die sieben Grundgesetze

### Gesetz 1 — Content First

Emotion entsteht durch **Events, Artists, Menschen, Community** — nicht durch UI.

- Flyer, Fotos und Namen dominieren visuell.
- Die Oberfläche tritt zurück.
- Dekorative Elemente ohne Informationswert sind verboten.

### Gesetz 2 — Eine primäre Aktion pro Screen

Pro Screen gibt es **maximal eine** primäre Handlung.

- Alles andere ist sekundär, tertiär oder versteckt.
- Keine konkurrierenden violetten CTAs.
- Admin-Formulare: Speichern ist primär; Destruktives ist immer sekundär und klar getrennt.

### Gesetz 3 — Whitespace ist Gestaltung

Abstand ist kein „Rest“, sondern **aktives Mittel**.

- Lieber zu viel Luft als zu wenig.
- Sektionen atmen.
- Gruppen entstehen durch Nähe und Rhythmus — nicht durch Rahmen.

### Gesetz 4 — Konsistenz schlägt Kreativität

Jeder Screen folgt denselben Regeln für:

- Spacing (8pt-System)
- Typografie-Hierarchie
- Interaktionsmuster
- Farbsemantik

Abweichungen nur mit dokumentierter Begründung.

### Gesetz 5 — Premium Consumer, nicht Enterprise

Eternal Rave wirkt wie **Instagram, Apple, Spotify, Airbnb, Notion, Linear** — nicht wie SAP, Material Dashboard oder Gaming UI.

- Kein Cyberpunk. Kein Neon-Glow. Kein Sci-Fi-Panel-Look.
- Admin nutzt dieselbe Sprache wie Consumer — nur mit mehr Informationsdichte, nie mit anderer Ästhetik.

### Gesetz 6 — Light und Dark sind gleichwertig

Light Mode ist **kein invertierter Dark Mode**.

- Light: hell, ruhig, warm, freundlich — primäre Referenz für Discovery, Community, Eventsuche, Profile, Administration.
- Dark: emotional, aber nicht schwer — ruhige Flächen, reduzierter Kontrast, Tiefe statt Härte.

### Gesetz 7 — Mockups sind Referenz, Evolution ist Pflicht

Die 79 Mockups bleiben die wichtigste historische Referenz.

- Nicht blind kopieren.
- Analysieren → verstehen → für 2026 optimieren.
- Siehe `ER_DESIGN_EVOLUTION_V2.md`.

---

## 4. Entscheidungshierarchie

Bei Widersprüchen gilt diese Reihenfolge:

1. **ER UI Constitution** (dieses Dokument)
2. **ER Design Evolution V2** (bewusste Weiterentwicklung)
3. **ER Design System v3** (Tokens, Light/Dark)
4. **79 UI-Mockups** (Screen-Referenz, Komponenten 52–61, System 62–69, Motion 70–79)
5. **MASTER-PROMPT v3.0** (Produkt- und Farb-Baseline)
6. Implementierungsstand im Code (app-v2/src/design/)

---

## 5. Nicht verhandelbar

| Regel | Begründung |
|-------|------------|
| Keine Gaming-/Cyberpunk-Ästhetik | Markenidentität: Premium Lifestyle, nicht Nische-Gaming |
| Kein Auto-Publish bei Imports | Trust & Qualität (Produkt-Constitution) |
| Touch Targets ≥ 44pt | Accessibility & Mobile-First |
| Kontrast mindestens WCAG AA | Lesbarkeit in Club-Umgebungen und Sonnenlicht |
| Keine hardcodierten Farben in Screens | Token-System |
| Keine Box-in-Box ohne Grund | Visual Clutter (Evolution V2) |
| Content-Bilder nie durch UI verdrängt | Content First |
| Admin ≠ Enterprise-Backoffice-Look | Markenkohärenz |

---

## 6. Nutzergefühle (Handbook Ch. 1)

| Nutzer soll sich fühlen… | Design-Entscheidung |
|--------------------------|---------------------|
| **Begeistert** | Große Event-Bilder, Artist-Content |
| **Kontrolliert** | Einfache Navigation, vorhersagbare Interaktionen |
| **Verbunden** | Community-Features leicht erreichbar |
| **Emotional** | Inhalt erzeugt Emotion — nicht visuelles Rauschen |
| **Sicher** | Schnelle, konsistente Oberfläche |

---

## 7. Scope der Constitution

Gilt für:

- Consumer App (Tabs: Home, Events, Map, Saved, Profile)
- Event Detail, Search, Filter
- Organizer Flows (Dashboard, Create/Edit Event)
- Admin Portal (Web)
- Scanner App (zukünftig)
- Alle Dialoge, Sheets, Empty States, Loading States

---

## 8. Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| `ER_DESIGN_EVOLUTION_V2.md` | Was an Mockups bewusst verbessert wird |
| `ER_VISUAL_LANGUAGE.md` | Markenpersönlichkeit und visuelle DNA |
| `ER_DO_AND_DONT.md` | Konkrete Verbote und Empfehlungen |
| `ER_UI_REVIEW_CHECKLIST.md` | Prüfliste vor Merge |
| `ER_CURSOR_UI_GUIDE.md` | Leitfaden für KI-gestützte UI-Arbeit |

---

*Eternal Rave 2026 — Die Oberfläche verschwindet. Der Rave bleibt.*
