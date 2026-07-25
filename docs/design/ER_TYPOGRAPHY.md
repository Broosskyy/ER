# ER Typography

**Status:** Kanonisch · Sprint 1 Design DNA  
**Quelle:** Mockup 63, ER Design System v3, app-v2 `typography.ts`, Handbook Ch. 1  
**Zweck:** Typografische Hierarchie, Skala und Anwendungsregeln.

---

## 1. Grundsatz

Typografie trägt **Hierarchie**, nicht Dekoration.

- Klarheit vor Expressivität
- Wenige Gewichte, konsistent eingesetzt
- Content (Event-Titel, Artist-Namen) darf typografisch dominieren
- UI-Chrome (Labels, Meta) ist leise
- System-Font als Basis — Premium durch Rhythmus, nicht durch exotische Fonts

---

## 2. Schriftfamilie

| Priorität | Familie | Status |
|-----------|---------|--------|
| 1 | **System Sans** (SF Pro / Roboto) | ✅ Aktuell (Fallback) |
| 2 | **Inter** oder **Geist** | 🔴 Empfohlen für 2026 — noch nicht implementiert |

**Evolution V2 Empfehlung:** Inter oder Geist Sans — clean, modern, exzellente Lesbarkeit auf Mobile und Web. Keine Display-Fonts, keine Rave-typischen Schriften.

**Regel bis Font-Entscheidung:** `fontFamily.primary: undefined` (System Default).

---

## 3. Größenskala

| Token | Größe | Line Height | Verwendung |
|-------|-------|-------------|------------|
| `caption` | 11px | 1.2 | Badges, Timestamps (selten) |
| `xs` | 12px | 1.2 | Nav Labels, kleinste Meta |
| `sm` | 13px | 1.4 | Captions, Helper Text |
| `base` | 14px | 1.4 | Card Subtitle, Secondary Body |
| `md` | 16px | 1.4 | **Body Standard** |
| `lg` | 18px | 1.4 | Card Title (klein) |
| `xl` | 20px | 1.2 | Section Title, Heading |
| `xxl` | 24px | 1.2 | Screen Title |
| `display` | 30px | 1.2 | Hero Titles (selten) |

**8pt-Alignment:** Alle Größen auf 1–2px genau am Raster — keine `15px` oder `17px`.

---

## 4. Gewichte

| Token | Wert | Verwendung |
|-------|------|------------|
| `regular` | 400 | Body, Beschreibungen |
| `medium` | 500 | Labels, Chips, Nav (inaktiv) |
| `semibold` | 600 | Section Titles, Card Titles, Buttons |
| `bold` | 700 | Screen Titles, Display (sparsam) |

**Evolution V2:** Weniger Bold. Section Titles: semibold statt bold. Nur Screen Titles und Hero: bold.

---

## 5. Text-Rollen (semantische Hierarchie)

### 5.1 Hierarchie-Ebenen

```
Display (30/bold)          ← Hero, selten
  Screen Title (24/bold)   ← Einmal pro Screen
    Section Title (20/semibold)  ← Sektions-Anker
      Card Title (16/semibold)   ← Event Name, Artist
        Body (16/regular)        ← Beschreibungen
          Metadata (14/secondary) ← Datum, Venue, Distance
            Caption (13/secondary) ← Timestamps, Counts
              Label (12/medium)    ← Form Labels, Chips
```

### 5.2 Rollen-Definitionen

| Rolle | Size | Weight | Color | Beispiel |
|-------|------|--------|-------|----------|
| `screenTitle` | xxl (24) | bold | textPrimary | „Events", „Profil" |
| `sectionTitle` | xl (20) | semibold | textPrimary | „Raves in deiner Nähe" |
| `cardTitle` | md (16) | semibold | textPrimary | „Berghain — Klubnacht" |
| `cardSubtitle` | base (14) | regular | textSecondary | „Berghain · Friedrichshain" |
| `body` | md (16) | regular | textPrimary | Event-Beschreibung |
| `metadata` | base (14) | regular | textSecondary | „Sa, 19. Jul · 23:00" |
| `label` | sm (13) | medium | textSecondary | Formular-Label |
| `button` | md (16) | semibold | textOnPrimary | „Tickets sichern" |
| `chip` | base (14) | medium | textSecondary | „Techno" |
| `chipSelected` | base (14) | semibold | textOnPrimary | „Techno" (selected) |
| `navLabel` | xs (12) | medium | textSecondary | „Home" |
| `navLabelActive` | xs (12) | semibold | primary | „Home" (active) |
| `badge` | caption (11) | semibold | textSecondary | „LIVE" |
| `searchInput` | base (14) | regular | textPrimary | Suchfeld |
| `searchPlaceholder` | base (14) | regular | textSecondary | „Events suchen…" |

---

## 6. Farb-Zuordnung

| Kontext | Dark | Light |
|---------|------|-------|
| Primärer Text | `#F5F5F5` | `#111111` |
| Sekundärer Text | `#9CA3AF` | `#6B7280` |
| Text auf Primary | `#FFFFFF` | `#FFFFFF` |
| Links | `primary` / `accent` | `accent` |
| Destructive | `live` | `live` |
| Success | `success` | `success` |

**Regel:** Nie mehr als 2 Text-Farben pro Screen-Abschnitt (primary + secondary).

---

## 7. Screen-spezifische Typografie

### Home

- Location: `metadata` oder `label`
- Section Titles: `sectionTitle` — nicht uppercase
- Event Names in Cards: `cardTitle`
- Distance/Genre: `metadata`

### Event Detail

- Event Name: `screenTitle` oder `display` (wenn Hero)
- Date/Time: `body` oder `metadata`
- Line-up Artists: `cardTitle` pro Artist
- CTA: `button`

### Admin

- Page Title: `screenTitle` — **kein** „ADMIN" Prefix in Typography
- Section Headers: `sectionTitle`
- Table/List Meta: `metadata`
- Form Labels: `label` — immer über dem Input

**Evolution V2:** Admin nutzt **dieselben** Rollen wie Consumer — keine kleinere/kompaktere „Enterprise"-Typo.

---

## 8. Typografie-Verbote

| ❌ Verboten | ✅ Stattdessen |
|------------|---------------|
| ALL CAPS Section Headers | Normal case, semibold |
| `letter-spacing: 2px` überall | Nur bei sehr kleinen Labels (optional) |
| Mehr als 3 Gewichte pro Screen | regular, medium, semibold |
| Unterstrichene Links (außer Body-Text) | Farbe `primary` |
| Zentrierter Body-Text | Links ausgerichtet |
| `fontSize` inline in Screens | `textRoles.*` oder `AppText variant` |
| Italic für UI-Labels | regular weight |

---

## 9. Zeilenlänge & Lesbarkeit

| Kontext | Max Zeichen/Zeile |
|---------|-------------------|
| Body Text | ~65 Zeichen |
| Card Title | 2 Zeilen, dann ellipsis |
| Metadata | 1 Zeile, ellipsis |
| Event Description | 3–5 Zeilen Preview, dann „Mehr" |

**Line Height:**

- Headlines: `tight` (1.2)
- Body: `normal` (1.4)
- Lange Texte: `relaxed` (1.6)

---

## 10. Referenz-Vergleich

| Produkt | Was wir übernehmen |
|---------|-------------------|
| **Apple** | Klare Hierarchie, großzügige Headlines, ruhige Meta |
| **Instagram** | Content-Titel dominant, UI-Text minimal |
| **Notion** | Saubere Labels, konsistente Body-Größe |
| **Linear** | Präzise, keine überladenen Gewichte |
| **Spotify** | Meta leise, Cover/Titel im Fokus |

---

## 11. Komponenten-Anbindung

```typescript
// Richtig — semantische Rolle
<AppText role="sectionTitle">Tonight</AppText>
<AppText role="metadata">Berghain · 2.3 km</AppText>

// Falsch — ad-hoc Styles
<Text style={{ fontSize: 20, fontWeight: '700' }}>Tonight</Text>
```

**AppText** ist die einzige erlaubte Text-Komponente in Screens.

---

## 12. Verwandte Dokumente

- `ER_VISUAL_LANGUAGE.md`
- `ER_COLOR_AND_THEME.md`
- `ER_COMPONENT_LIBRARY.md`
- `ER_CURSOR_UI_GUIDE.md`
