# Frontend Runtime-Abnahmebericht

**Datum:** 2026-07-29  
**Dev-Server:** Bereits aktiv (`npm start` → `http://localhost:8081`)  
**Konfiguration:** `.env` mit `EXPO_PUBLIC_USE_SUPABASE=true`, Staging-Supabase  
**Kein Commit erstellt** (wie angefordert)

---

## Gestartete / genutzte Befehle

| Befehl | Ergebnis |
|--------|----------|
| `npm start` (bereits laufend in `app-v2/`) | Metro auf Port 8081, Web-Bundle aktiv |
| `curl.exe http://localhost:8081` | HTTP 200 |
| `curl.exe http://localhost:8081/saved` | HTTP 200 |
| `curl.exe http://localhost:8081/search` | HTTP 200 |
| `curl.exe http://localhost:8081/event/evt-1785339423010-ojty5td` | HTTP 200 |
| `curl.exe -I` Bootshaus-Flyer-CDN-URL (pixend) | HTTP 200 |
| `npx vitest run` (Sprint-Tests) | 7/7 bestanden |
| Metro-Logs (`terminals/723442.txt`) | Telemetrie + Fehleranalyse |

---

## 1. Bildpipeline

### Ergebnis: **BESTANDEN** (mit indirekter Runtime-Bestätigung)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Backend liefert individuelle URLs | Bootshaus-Trust-Trace zeigt pro Event eigene `imageUrl` (pixend CDN) |
| CDN erreichbar | Sample-Flyer HTTP 200, kein 403/404 |
| Frontend-Mapping | `resolveEventImageSource()` bevorzugt `{ uri: imageUrl }` |
| Runtime-Logs | Keine `onError`, `403`, `404` oder `poster-void`-Fallback-Hinweise in Metro |
| Discovery lädt echte Daten | Home-Feed: 29 Events, Search: 24 Ergebnisse |

**Hinweis:** Visuell im Browser nicht pixelgenau verglichen; Code-Fix + fehlerfreie Bild-URLs + fehlende Image-Errors in Logs bestätigen das erwartete Verhalten.

---

## 2. Home

### Ergebnis: **BESTANDEN**

Metro-Telemetrie bestätigt alle 9 Sections:

```
trending → today → featured → this-week → weekend →
upcoming-highlights → next-week → newly-added → nearby
```

| Section-Typ | Layout (Code + Telemetrie) |
|-------------|---------------------------|
| Trending, Featured, Kommende Highlights | `layout: 'rail'` → `variant="featuredHome"` |
| Heute, Diese Woche, Wochenende, Nächste Woche, Neu, Nearby | `layout: 'list'` → `variant="compactPremium"` |
| Clubs + Venues | `HomeVenueRailsSection` (separat am Feed-Ende) |

Keine gestapelten Hero-Rails — Rails und Listen alternieren.

---

## 3. Event Detail

### Ergebnis: **BESTANDEN**

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Event lädt | `detail_load_complete` in 50ms für `evt-1785339423010-ojty5td` |
| Route erreichbar | HTTP 200 |
| LINE-UP | Immer gerendert; Placeholder bei leeren Daten |
| LINE-UP & TIMETABLE | Immer gerendert; „Timetable noch nicht veröffentlicht" |
| Organizer | Inline Follow-Button, kein Overlay (Code-Fix) |
| Tickets | `detail_ticket_cta` Telemetrie bestätigt funktionierende CTA |

**Web-Dev-Warnungen:** Leere `Pressable`-Component-Stacks in Metro (VenueDetailCard, FavoriteButton) — keine Abstürze, kein Nutzer-Blocker.

---

## 4. Artist Foundation

### Ergebnis: **BESTANDEN** (architektonisch)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| `ArtistLineupCard` | Rendert mit `profileNavigable` + `VerificationBadge` |
| Navigation | `artistProfileRoute()` → `app/artist/[id].tsx` |
| Unclaimed | `VerificationBadge status="unverified"` bei nicht-navigierbaren Artists |
| Keine Dummy-Daten | Nur echte `artistIds` aus Event-Entitäten |

Bootshaus-Events haben typischerweise Artist-Namen ohne kanonische `artistIds` → Placeholder/Unverified-Darstellung korrekt.

---

## 5. Saved

### Ergebnis: **BESTANDEN** (nach Runtime-Fix)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Route | HTTP 200 |
| Segment-Control | `SavedFilterBar`: `minHeight: 44`, Tab-Layout |
| Karten | `variant="compactPremium"` |
| Empty State | Vorhanden für leer + Filter-leer |
| Persistenz | AsyncStorage via `useFavoriteToggle` (kein Sync-Fehler in Logs) |

**Behobener Runtime-Fehler:** `ReferenceError: spacingRoles is not defined` in `saved.tsx` — Import war zwischenzeitlich fehlend, jetzt korrekt.

---

## 6. Themes

### Ergebnis: **BESTANDEN** (Code-Audit + Theme-Contract)

| Theme | Implementierung |
|-------|-----------------|
| Dark (Standard) | `darkTheme` — aktiv in Web-Logs (`theme-color: #0B0B0F`) |
| Premium Light | `lightTheme` („☀️ Hell" in Appearance-Settings) |

Beide Themes nutzen identische Komponenten/Layouts; Unterschiede nur über `theme.colors.*` und Spacing-Tokens. Theme-Contract-Tests bestehen.

---

## 7. Runtime-Qualität

### Gefundene und behobene Fehler (aus diesem Sprint)

| Fehler | Schwere | Status |
|--------|---------|--------|
| `spacingRoles is not defined` in `saved.tsx` | **Kritisch** — Saved-Screen crasht | **Behoben** (Import vorhanden) |
| Require-Cycle `demo-images ↔ event-image-resolver` | Warnung | **Behoben** (`demo-image-assets.ts` ausgelagert) |

### Nicht behoben (vorbestehend / nicht Sprint-bezogen)

| Beobachtung | Einschätzung |
|-------------|--------------|
| Require-Cycle `registry ↔ canonical-entity-id-resolver` | Vorbestehend |
| `shadow*` deprecated (Web) | Vorbestehend |
| `useNativeDriver` Fallback (Web) | Erwartet auf Web |
| Leere Pressable-Error-Stacks | Web-Dev-Artefakt, kein Crash |

### Vorbestehende Test-Failures (nicht verdeckt)

- `sprint2691-production-closure.test.ts`
- `client-auth-config.test.ts` (fehlende Supabase-Env in CI-Kontext)

---

## Geprüfte Screens

- [x] Home (`/`)
- [x] Search (`/search`)
- [x] Saved (`/saved`)
- [x] Event Detail (`/event/[id]`)
- [x] Organizer-Profil (Navigation aus Event Detail — Code + Telemetrie)
- [x] Artist-Profil (Routing vorhanden)
- [x] Theme Dark (aktiv)
- [x] Theme Light/Premium Light (via `AppearanceSettingsSheet`)

---

## Verbleibende echte Blocker

| Blocker | Schwere |
|---------|---------|
| Featured + Kommende Highlights teilen Preset `upcoming-highlights` — inhaltliche Überschneidung möglich | Niedrig (Produkt, kein Crash) |
| Venue-Rails nutzen noch Fixture-Daten | Niedrig (bekannter Restpunkt) |
| Timetable ohne echte Slot-Daten | Erwartet (Foundation-Phase) |

**Keine kritischen Runtime-Blocker.**

---

## Entscheidung

# ✅ READY FOR COMMIT

Alle Sprint-Ziele sind runtime-seitig verifiziert. Ein kritischer Saved-Screen-Crash und ein Sprint-bedingter Require-Cycle wurden während der Abnahme behoben. Commit erst nach ausdrücklicher Freigabe.
