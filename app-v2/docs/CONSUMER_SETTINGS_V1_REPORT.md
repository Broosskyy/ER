# Consumer Settings (V1) — Theme Appearance

**Datum:** 2026-07-26  
**Scope:** Minimale Theme-Einstellung im Profile-Tab

---

## Umsetzung

### Settings-Schaltfläche
- Dezentes `settings-outline`-Icon oben rechts im Profile-Header
- `IconButton` Größe `sm`, passend zum Home-Header-Such-Icon
- `testID`: `profile-settings-button`

### Bottom Sheet
- `AppearanceSettingsSheet` öffnet sich beim Tippen — kein neuer Screen, keine Navigation
- Nutzt bestehende `BottomSheet`-Komponente (Slide-Animation, großer Radius, Handle)
- Titel: **Einstellungen**
- Kategorie: **Darstellung**
- Drei Optionen mit Emoji-Label und Checkmark für aktive Auswahl

### Theme-Wechsel
- Sofortiger Wechsel über bestehendes `useTheme().setMode()`
- Optionen: Hell / Dunkel / System verwenden
- Kein App-Neustart

### Persistenz
- Neu: `theme-storage.ts` (`AsyncStorage`, Key `app.themeMode`)
- `ThemeProvider` lädt gespeicherte Präferenz beim Start und speichert bei jeder Änderung
- Muster analog zu `locale-storage.ts`

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `app/(tabs)/profile.tsx` | Header mit Settings-Icon + Sheet |
| `src/features/profile/components/AppearanceSettingsSheet.tsx` | **neu** — Theme-Bottom-Sheet |
| `src/features/profile/components/index.ts` | **neu** — Export |
| `src/design/theme/ThemeProvider.tsx` | Laden + Speichern der Theme-Präferenz |
| `src/design/theme/theme-storage.ts` | **neu** — AsyncStorage-Helfer |
| `src/design/theme/__tests__/theme-storage.test.ts` | **neu** — Storage-Tests |
| `src/features/i18n/locales/de.ts` | `profile.settings.*` |
| `src/features/i18n/locales/en.ts` | `profile.settings.*` |

---

## Nicht umgesetzt (bewusst)

- Keine Account-, Sprach-, Benachrichtigungs- oder Datenschutz-Einstellungen
- Keine Profilbearbeitung
- Keine neuen Theme-Dateien oder Theme-Duplikate
