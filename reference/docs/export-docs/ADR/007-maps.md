# ADR-007: Maps

**Status:** Proposed (nicht implementiert)  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Mockup 12 (Map Screen) und Band 1 Future: **Mapbox**. Ist: `MapPlaceholder` ohne echte Karte.

## Entscheidung (geplant)

**Mapbox** (via `@rnmapbox/maps` oder Expo-kompatible Lösung) für:

- Vollbild-Karte mit dark style
- Event-Pins + Cluster
- User Location Dot
- Bottom Sheet bei Pin-Tap
- Mini-Map auf Event Detail (`LocationPreview`)

## Begründung

- MASTER-PROMPT: „Future: Mapbox"
- Mockup 12 spezifiziert Mapbox-style
- RA/Airbnb-Qualitätsanspruch für „Events near me"

## Abhängigkeiten

- ADR-004 Navigation (Map Tab)
- expo-location (GPS) — Sprint 3 in Roadmap
- Mapbox API Token, Android/iOS native config

## Konsequenzen (wenn umgesetzt)

- APK-Größe steigt
- Neues Permission-Model (Location)
- `MapPlaceholder` → `EventMap` Wrapper — inkrementell, nicht löschen und neu

## Referenzen

- Mockup 12, analysis/10_migration_roadmap Sprint 6
- `src/components/MapPlaceholder.tsx`
