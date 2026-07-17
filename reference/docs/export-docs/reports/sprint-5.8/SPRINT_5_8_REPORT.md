# Sprint 5.8 Report — Runtime QA & Entry Flow Fix

**Version:** 1.7.0  
**Branch:** `cursor/sprint-5-8-entry-flow-fix-a932`  
**Date:** 2026-07-02

## Ziel

Echte Probleme aus Android-Testvideos nach Sprint 5.7 beheben — stabiler Entry Flow, saubere Auth-Screens, Gastmodus, Role Guards, Keyboard/Safe-Area, visuelle Konsistenz. Keine neuen Features.

## Ergebnis

| Bereich | Status |
|---------|--------|
| Entry Flow (Splash → Onboarding → Welcome → Auth/Gast) | ✅ Behoben |
| Login/Register ohne Overlay/Hintergrund-Bleed | ✅ Behoben |
| Gastmodus + Account-required Dialog | ✅ Behoben |
| Admin/Organizer nur für Rollen | ✅ Behoben |
| Map Placeholder ohne Dev-Text | ✅ Behoben |
| KeyboardAvoidingView Auth | ✅ Eingebaut |
| Runtime Screenshots (15) | ✅ Vorhanden (siehe RUNTIME_QA.md) |
| Typecheck | ✅ Pass |

## Hauptänderungen

1. **Navigation:** Login/Register von Modal (`fade_from_bottom`) auf Push (`slide_from_right`) — keine Überlagerung mehr über Welcome/Onboarding.
2. **AuthScreenLayout:** Solider Gradient-Hintergrund, `KeyboardAvoidingView`, kein `ImageBackground` mit Transparenz.
3. **Welcome:** `setWelcomeComplete()` erst nach erfolgreichem Login/Register/Gast — nicht mehr vor Auth-Navigation.
4. **Onboarding:** Unsichtbare Tap-Zone auf Mockup-CTA (kein doppelter „Weiter“-Button); optional `?slide=N` für QA.
5. **Role Guards:** Admin/Organizer-Layouts immer mit `AuthGate`; Demo-Modus blockiert Admin/Organizer.
6. **Profile:** Admin-Demo-Link entfernt; Add Event / My Submissions mit `requireAccount`.
7. **Map:** „Real map coming soon“ durch produktionsreifen DE Coming-Soon-State ersetzt.
8. **AccountRequiredDialog:** Icon, zentriertes Layout, „Als Gast fortfahren“.

## Screenshots

`docs/reports/sprint-5.8/runtime_screenshots/` — 15 Dateien (01–15).

## APK

Release-APK: `android/app/build/outputs/apk/release/app-release.apk`

## Nächste Schritte

Siehe `NEXT_STEPS.md` — u.a. Re-Capture auf physischem Gerät wegen Emulator-ANR.
