# ER Consumer Visual Polish Guidelines

**Status:** Ergänzend · Non-Breaking  
**Gültigkeit:** Ab Sprint 2B für Consumer-Screens und kleine UI-Verbesserungen  
**Zweck:** Verfeinerungsregeln — keine Neuerfindung des Designsystems

---

## Was dieses Dokument ist — und was nicht

Dies ist **kein Redesign**.

Es ersetzt **nicht**:

| Bleibt verbindlich | Referenz |
|--------------------|----------|
| Mockups | `ER_MOCKUP_INVENTORY_REPORT.md`, `.mockup-inventory-temp/` |
| Design System | `ER_VISUAL_LANGUAGE.md`, `ER_UI_CONSTITUTION.md` |
| Theme Tokens | `ER_COLOR_AND_THEME.md`, `app-v2/src/design/theme/` |
| Component Library | `ER_COMPONENT_LIBRARY.md`, `app-v2/src/components/` |
| Sprint 2A | UI-only Komponentensystem |
| Sprint 2A.5 | `SPRINT_2A5_VISUAL_DIRECTION.md` |
| Architektur | `CLAUDE.md`, bestehende Screen-/Feature-Struktur |
| Bestehende Abstände | Sofern sie Mockups entsprechen (`ER_LAYOUT_SYSTEM.md`) |

Alle bisherigen Entscheidungen bleiben gültig.

Diese Richtlinien dienen ausschließlich dazu, zukünftige Consumer-Screens und kleinere UI-Verbesserungen **konsistenter und hochwertiger** umzusetzen.

---

## Interpretation

Diese Guidelines dürfen **niemals** als Begründung verwendet werden, bestehende Screens oder Komponenten ohne expliziten Auftrag umzubauen.

Sie kommen ausschließlich zum Einsatz:

- bei **neuen** Consumer-Screens,
- bei **geplanten** Screen-Migrationen,
- bei **ausdrücklich angeforderten** Visual-Polish-Aufgaben.

Bestehende, freigegebene Implementierungen bleiben unverändert, sofern keine neue Anforderung oder ein Mockup-Abgleich dies erfordert.

---

## Ziel

Jede zukünftige UI-Entscheidung soll Eternal Rave hochwertiger wirken lassen, ohne das bestehende Designsystem neu zu erfinden.

**Es geht um Verfeinerung. Nicht um Neuerfindung.**

---

## Entscheidungsregeln

Wenn mehrere visuell korrekte Lösungen existieren, bevorzuge die Variante mit:

- mehr Weißraum
- klarerer Hierarchie
- größerer Bildwirkung
- ruhigerem Layout
- weniger visueller Lautstärke
- besserer Lesbarkeit
- hochwertigerem Gesamteindruck

**Nicht** automatisch mehr Informationen anzeigen.

Bei Gleichstand gilt die Prioritätskette:

1. Mockup
2. Design System / Theme Tokens
3. Vorhandene Component Library
4. Sprint 2A.5 Visual Direction
5. Diese Polish Guidelines

---

## Bilder

Eventbilder bleiben das wichtigste visuelle Element.

Falls eine Komponente angepasst wird:

- Bilder dürfen **größer** werden
- Bilder dürfen **hochwertiger** präsentiert werden
- Bilder sollen **Emotion** erzeugen

Es dürfen jedoch **keine bestehenden Layouts grundlegend verändert** werden.

Konkret (im Rahmen bestehender Tokens und Varianten):

- Featured/Hero: bestehende Aspect Ratios beibehalten (`featuredHeroAspectRatio`, `eventDetailHeroAspectRatio`)
- Keine neuen Bildformate einführen
- Fallback-Poster statt leerer Flächen

---

## Karten

Bestehende Kartenarchitektur bleibt erhalten (`CardFoundation`, `EventCard`, `InteractiveCard`).

Erlaubt sind ausschließlich **kleine** Verbesserungen wie:

- bessere Innenabstände (bestehende `spacingRoles`)
- ausgewogenere Proportionen
- harmonischere Radien (`theme.radiusRoles`)
- dezentere Schatten (nur `elevated` wo vorgesehen)
- ruhigere Informationsanordnung

**Nicht erlaubt:**

- neue Card-Struktur einführen
- Card-in-Card ohne Mockup-Grund
- parallele Card-Komponenten für denselben Use Case

---

## Farben

Alle bestehenden Theme-Tokens bleiben verbindlich.

- Keine neuen Markenfarben einführen
- Keine Hex-Werte in Komponenten oder Screens
- Lila (`accent`) bleibt ausschließlich Akzentfarbe — nie als dominante Fläche

Siehe `ER_COLOR_AND_THEME.md` und `SPRINT_2A5_VISUAL_DIRECTION.md` §2.

---

## Typografie

- Keine neuen Font-Familien
- Keine neuen Größen-Systeme
- Nur bestehende `AppText`-Rollen verwenden

Erlaubt im Rahmen des bestehenden Designsystems:

- bessere Hierarchie (richtige Rolle wählen, nicht neue Größe erfinden)
- sinnvollere Gewichtung (semibold statt bold wo Mockup es zeigt)
- ruhigere Abstände (`sectionTitleGap`, `sectionGap`)

Siehe `ER_TYPOGRAPHY.md`.

---

## Komponenten

- Vorhandene Komponenten werden bevorzugt
- Nicht neu entwickeln, wenn eine passende Komponente bereits existiert
- Keine Duplikate erzeugen (insb. `features/*` vs. `src/components/*`)

Vor jeder neuen Variante prüfen:

1. Reicht eine bestehende Variante/Prop?
2. Löst die Komposition das Problem ohne Code-Änderung?
3. Würde eine Änderung andere Preview-/Produkt-Screens unbeabsichtigt beeinflussen?

---

## Screen-Migrationen

Bei zukünftigen Screen-Migrationen (ab Sprint 2B) gilt:

| # | Regel |
|---|-------|
| 1 | **Mockup ist Quelle der Wahrheit** |
| 2 | Bestehende Komponenten zuerst verwenden |
| 3 | Theme respektieren |
| 4 | Nur minimale visuelle Verfeinerungen durchführen |
| 5 | Keine funktionalen Änderungen |
| 6 | Keine Architekturänderungen |

Referenz-Master: `/design-preview` → Sprint 2A.5 Home Light/Dark + Desktop.

---

## Desktop

Desktop ist **keine 1:1-Skalierung** der Mobile-Version.

Erlaubt:

- mehr Weißraum
- bessere Flächennutzung (Grid, Spalten, begrenzte Content-Breite)

Unverändert:

- Informationsarchitektur (gleiche Sektionen, gleiche Inhalte)
- Tokens, Typografie, Komponenten

Siehe `SPRINT_2A5_VISUAL_DIRECTION.md` §9.

---

## Verboten

Nicht:

- Theme ersetzen
- Komponenten pauschal austauschen
- Architektur verändern
- neue Designsystem-Regeln erfinden
- Mockups ignorieren
- bestehende UI ohne Grund umgestalten
- bestehende Screens/Komponenten ohne expliziten Auftrag polieren oder umbauen
- Breaking Changes an öffentlichen Component APIs
- Businesslogik, Navigation oder Datenfluss anfassen

---

## Grundsatz

> **Immer evolutionär verbessern. Niemals revolutionär verändern.**

Wenn Unsicherheit besteht, hat das bestehende **Mockup**, **Designsystem** und die vorhandene **Component Library** immer Vorrang vor dieser Datei.

---

## Verwandte Dokumente

| Dokument | Rolle |
|----------|-------|
| `SPRINT_2A5_VISUAL_DIRECTION.md` | Verbindliche visuelle Richtung (Consumer Light/Dark/Desktop) |
| `ER_DO_AND_DONT.md` | Schnelle Do/Don't-Referenz |
| `ER_UI_REVIEW_CHECKLIST.md` | Review vor Merge |
| `ER_LAYOUT_SYSTEM.md` | Spacing und Breakpoints |
| `ER_SCREEN_PATTERNS.md` | Wiederkehrende Screen-Muster |
