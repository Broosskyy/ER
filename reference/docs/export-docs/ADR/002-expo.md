# ADR-002: Expo

**Status:** Accepted  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Build, OTA-fähige Updates, native APIs und Developer Experience für Eternal Rave.

## Entscheidung

**Expo SDK 56** mit Expo Router, EAS-fähig, managed workflow + prebuild für APK.

## Begründung

- Schnelle Iteration (Expo Go / Dev Client)
- Integrierte APIs: Image, Haptics, Linking, Constants
- `expo-router` für file-based navigation
- `npm run build:apk` via prebuild + Gradle
- Band 3 und README dokumentieren Expo-Stack

## Konsequenzen

- Version an SDK 56 gebunden — Upgrades planbar in eigenem Sprint
- NativeWind 4 für Styling
- Keine eject ohne ADR

## Referenzen

- `app.json`, `package.json` (expo ~56.0.12)
- Releases v1.7.0 APK via GitHub
