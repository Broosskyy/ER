# ER Cursor UI Guide

**Status:** Kanonisch · Sprint 1 Design DNA  
**Zweck:** Leitfaden für KI-gestützte UI-Arbeit in Cursor — Regeln, Workflows, Dateiverweise.

---

## 1. Vor jeder UI-Änderung lesen

**Pflichtlektüre (in dieser Reihenfolge):**

1. `ER_UI_CONSTITUTION.md` — Grundgesetze
2. `ER_DESIGN_EVOLUTION_V2.md` — Was sich bewusst ändert
3. Relevantes Screen-Pattern aus `ER_SCREEN_PATTERNS.md`
4. `ER_DO_AND_DONT.md` — Schnelle Verbote

**Bei Unsicherheit:** `ER_UI_REVIEW_CHECKLIST.md` durchgehen.

---

## 2. Entscheidungshierarchie

```
ER UI Constitution
  ↓
ER Design Evolution V2
  ↓
ER Design System v3 (Tokens)
  ↓
79 UI-Mockups (Referenz, nicht blind kopieren)
  ↓
app-v2/src/design/ (Implementierungsstand)
```

Bei Konflikt: höhere Ebene gewinnt.

---

## 3. Dateistruktur (app-v2)

### Design Tokens

| Datei | Inhalt |
|-------|--------|
| `src/design/colors.ts` | Farb-Tokens + colorRoles |
| `src/design/spacing.ts` | Spacing + spacingRoles |
| `src/design/typography.ts` | fontSize, textVariants, textRoles |
| `src/design/radii.ts` | Border Radius |
| `src/design/shadows.ts` | Elevation |
| `src/design/layout.ts` | bottomNavHeight, minTouchTarget, etc. |

### Basis-Komponenten

| Datei | Verwendung |
|-------|------------|
| `src/components/ui/AppText.tsx` | **Alle** Texte |
| `src/components/ui/PrimaryButton.tsx` | Primary CTA |
| `src/components/ui/SecondaryButton.tsx` | Secondary Actions |
| `src/components/ui/SurfaceCard.tsx` | Cards (sparsam!) |
| `src/components/ui/EmptyState.tsx` | Leere Zustände |
| `src/components/layout/AppScreen.tsx` | Screen Wrapper |
| `src/components/layout/SafeAreaContainer.tsx` | Safe Area |

### Admin

| Datei | Verwendung |
|-------|------------|
| `src/features/admin/components/AdminShell.tsx` | Admin Layout |
| `src/features/admin/admin-page-layout.ts` | Shared Admin Styles |

---

## 4. Workflow: Neuer Screen

```
1. Screen-Pattern identifizieren (ER_SCREEN_PATTERNS.md)
2. Layout-Gerüst: AppScreen → ScrollView → Sections
3. Typografie: textRoles für alle Texte
4. Spacing: spacingRoles (screenHorizontal, sectionGap)
5. Farben: colorRoles (nie hardcoded)
6. Komponenten: bestehende wiederverwenden
7. States: Loading (Skeleton), Empty, Error
8. Checklist: ER_UI_REVIEW_CHECKLIST.md
9. Testen: 360×800, 390×844, 1440×900
```

---

## 5. Workflow: Bestehenden Screen verbessern

```
1. ER_DESIGN_EVOLUTION_V2.md — Was soll sich ändern?
2. Mockup finden (reference/docs/export-docs/analysis/02_mockup_index.md)
3. Minimaler Diff — nur was nötig ist
4. Keine Business-Logic ändern (wenn nicht gefordert)
5. Scroll-Probleme: ein ScrollView, minHeight: 0
6. Card-Reduktion: SurfaceCard entfernen wo möglich
7. Checklist durchgehen
```

---

## 6. Code-Regeln

### ✅ Richtig

```typescript
import { colors, colorRoles } from '@/design/colors';
import { spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { AppText } from '@/components/ui/AppText';

// Semantische Tokens
<View style={{ paddingHorizontal: spacingRoles.screenHorizontal }}>
  <AppText style={textRoles.sectionTitle}>Tonight</AppText>
  <AppText style={textRoles.metadata}>Berghain · 2.3 km</AppText>
</View>
```

### ❌ Falsch

```typescript
// Hardcoded Werte
<View style={{ paddingHorizontal: 16, backgroundColor: '#15151B' }}>
  <Text style={{ fontSize: 20, fontWeight: '700', color: '#F5F5F5' }}>
    Tonight
  </Text>
</View>

// Box-in-Box
<SurfaceCard>
  <SurfaceCard>
    <Text>Content</Text>
  </SurfaceCard>
</SurfaceCard>

// Header + FlatList (Admin Mobile)
<View>
  <Header />
  <FlatList data={items} />  {/* Scroll bricht auf Web */}
</View>
```

---

## 7. Admin-spezifische Regeln

1. **ScrollView** statt FlatList auf Mobile Web
2. **Keine Stat-Cards** — Inline Metrics
3. **Light Mode** als Ziel (wenn Theme verfügbar)
4. **Gleiche textRoles** wie Consumer
5. **Kompakte Rows** für Listen (DataRow Pattern)
6. **Formulare:** Label über Input, am Ende des Scrolls
7. **Sektions-Trennung:** `borderTop` + `paddingTop` — sparsam

Referenz-Implementierung: `SourceEndpointsSection.tsx` (kompaktes Mobile Layout).

---

## 8. Häufige Fehler (aus Erfahrung)

| Fehler | Fix |
|--------|-----|
| Admin scrollt nicht (Mobile Web) | Single ScrollView, `minHeight: 0` auf flex children |
| `/admin/sources` scrollt nicht, Detail schon | Gleiches Pattern wie Detail: ScrollView |
| Modal transparent auf Web | Solid background auf Modal content |
| Zu viele Buttons | Primary + Icon Actions |
| Schweres Admin-Layout | Cards entfernen, Spacing erhöhen |
| Hardcoded colors | colorRoles verwenden |

---

## 9. Mockup-Referenz

| Was | Wo |
|-----|-----|
| Mockup Index (01–79) | `reference/docs/export-docs/analysis/02_mockup_index.md` |
| Screen Specs | `reference/docs/export-docs/02-ui-design/MOCKUP-SCREENS.md` |
| Design Review | `reference/docs/export-docs/analysis/07_design_review.md` |
| ZIP Archive | `c:\ER\Eternal_Rave_Screens_Renamed*.zip` |
| Einzelne Screens | `reference/mockups/screens/` |

**Regel:** Mockups sind Referenz — Evolution V2 hat Vorrang bei bewussten Änderungen.

---

## 10. Scope-Regeln

| Aufgabe | Erlaubt | Verboten |
|---------|---------|----------|
| UI-Verbesserung | Styles, Layout, Komponenten | Business Logic |
| Admin Mobile Fix | Scroll, Spacing, Card-Layout | API, Datenmodell |
| Neuer Screen | Layout + States | Backend ohne Auftrag |
| Design Sprint | Nur `docs/design/` | React Native Dateien |

---

## 11. Verifikation

### Mobile Web Test

```bash
cd app-v2
npm run web
# Browser: http://localhost:8081
# Viewports: 360×800, 390×844
```

### Checklist

Vor Abschluss: `ER_UI_REVIEW_CHECKLIST.md` — alle A-Punkte Pass.

### Screenshots (optional)

```bash
node scripts/verify-endpoints-mobile-ui.mjs
# Output: app-v2/.verify-screenshots/
```

---

## 12. Prompt-Vorlagen

### UI-Verbesserung

```
Verbessere das Mobile UI von [Screen/Komponente].
Scope: nur Styles und Layout in [Dateipfad].
Regeln: docs/design/ER_UI_CONSTITUTION.md, ER_DESIGN_EVOLUTION_V2.md.
Keine Business-Logic-Änderungen.
Testen: 390×844, 1440×900.
```

### Neuer Screen

```
Implementiere [Screen] nach Pattern in ER_SCREEN_PATTERNS.md §[X].
Mockup-Referenz: [Nummer].
Tokens aus src/design/. Bestehende Komponenten wiederverwenden.
States: Skeleton, Empty, Error.
Checklist: ER_UI_REVIEW_CHECKLIST.md.
```

### Admin Fix

```
Fix Scroll/Layout in [Admin Screen].
Pattern: Single ScrollView wie /admin/sources/[id].
Regeln: ER_CURSOR_UI_GUIDE.md §7.
Nur [Dateipfad]. Keine Business Logic.
```

---

## 13. Verwandte Dokumente

| Dokument | Wann lesen |
|----------|------------|
| `ER_UI_CONSTITUTION.md` | Immer |
| `ER_DESIGN_EVOLUTION_V2.md` | Bei Mockup-Abweichungen |
| `ER_SCREEN_PATTERNS.md` | Neuer Screen |
| `ER_COMPONENT_LIBRARY.md` | Neue Komponente |
| `ER_DO_AND_DONT.md` | Schnell-Check |
| `ER_UI_REVIEW_CHECKLIST.md` | Vor Merge |
