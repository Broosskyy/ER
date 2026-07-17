# ADR-001: React Native

**Status:** Accepted  
**Datum:** Juni 2026 · Sprint 0  
**Entscheider:** Product & Engineering

## Kontext

Eternal Rave ist eine mobile-first App für Event-Discovery (Android zuerst, iOS später). Band 1 definiert React Native + TypeScript als Plattform.

## Entscheidung

**React Native 0.85** (via Expo) als UI-Framework.

## Begründung

- Cross-platform mit einer Codebase (Android + iOS)
- Große Community, Expo-Ökosystem
- TypeScript-first
- Performance ausreichend für Feed, Maps, Listen
- Team kann web-nahe React-Patterns nutzen

## Alternativen (nicht gewählt)

| Option | Grund gegen |
|--------|-------------|
| Flutter | Neues Dart-Ökosystem, Mockup/UI-Stack bereits RN |
| Native (Kotlin/Swift) | Doppelter Aufwand für MVP |
| PWA only | App Store, Push, native Maps schwieriger |

## Konsequenzen

- Native Module über Expo/React Native Packages
- New Architecture enabled (`newArchEnabled: true` in app.json)
- Kein Wechsel ohne neues ADR + Migration Plan

## Referenzen

- `package.json`: react-native 0.85.3
- Band 1 MASTER-PROMPT Platform Table
