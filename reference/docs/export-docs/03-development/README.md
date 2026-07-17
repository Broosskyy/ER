# 03 — Development

Entwicklungs-Dokumentation, Sprint-Berichte und Architektur.

## Dokumente

| Datei | Beschreibung |
|-------|--------------|
| [BERICHT-ETERNAL-RAVE-GESAMT.md](./BERICHT-ETERNAL-RAVE-GESAMT.md) | Ausführlicher Gesamtbericht Sprint 1.4–2.5 (DE) |
| [BERICHT-ETERNAL-RAVE-GESAMT.txt](./BERICHT-ETERNAL-RAVE-GESAMT.txt) | Plain-Text Download-Version |

## Architektur

```
app/              Expo Router Screens
src/
  components/     UI
  hooks/          State (useAuth, useEventStore, …)
  services/       Supabase API
  utils/          Parser, Mapper, Duplicate Detection
supabase/         SQL Migrationen & Seeds
```

## Quality Rules

- `npm run typecheck` vor Commit
- Jeder Sprint hinterläsft lauffähige App
- Kein Over-Engineering

## Root README

Setup & Scripts: [../../README.md](../../README.md)
