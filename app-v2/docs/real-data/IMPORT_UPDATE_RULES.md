# Import Update Rules

## Bekanntes Event

- Update über canonical ID, kein neues Event
- Provenance + manuelle Overrides respektieren
- Identity Resolver für Organizer/Venue/Artist erneut
- Absagen/Verschiebungen erkennen
- Line-up: ergänzen, nicht unkontrolliert löschen

## Fehlende Quelle

`ImportSourcePresenceService` — Schwellwert 3, kein sofortiges Löschen.

## Code

- `import-update-service.ts`
- `import-source-presence-service.ts`
