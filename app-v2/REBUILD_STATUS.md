# Event-Core Clean Rebuild

## Entscheidung

- Die bestehende App-Shell, UI, Navigation, Authentifizierung, Profile, Favoriten und Organizer-/Admin-Oberflächen bleiben erhalten.
- Der bisherige Event-/Import-/Persistence-/Consumer-Datenpfad wird nicht weiter repariert.
- Er wird nach und nach durch genau einen neuen Event-Core ersetzt.
- Der alte Stand liegt ausschließlich im Archiv-Branch.
- Das bestehende Supabase-Projekt wurde auf die Event-Core-Baseline zurückgesetzt und ist nicht mehr Source Truth für Legacy-Events.

## Einziger geplanter Datenweg

Source Evidence → Canonical Event → Validation → Event Writer → Clean Database → Event Reader → App

## Verbindliche Regeln

- ein kanonischer Eventtyp
- eine Beschreibung
- eine strukturierte Line-up-Form
- ein Billing Act entspricht einer gespeicherten Zeile
- ein Genremodell
- ein Ticketmodell
- ein Writer
- ein Reader
- ein Consumer-Mapper
- keine Legacy-Backfills
- keine Golden-Sonderpersistenz
- keine source-spezifischen Artist-, Event- oder Genrewerte
- fehlende Evidenz bleibt leer
- kein Erfolg ohne sichtbare Prüfung in der echten App

## Meilensteine

- [x] M1 Clean Environment
- [ ] M2 Manual Event Roundtrip — **IN PROGRESS**
- [ ] M3 One Official Import Roundtrip
- [ ] M4 Seven Reference Events
- [ ] M5 Bootshaus 30-Event Run
- [ ] M6 Controlled Cutover
- [ ] M7 Legacy Removal

Nur ein Meilenstein darf gleichzeitig als IN PROGRESS markiert sein.

## Aktueller Zustand

M2 Manual Event Roundtrip — IN PROGRESS

## Aktive Umgebung

- aktiver Git-Branch: `rebuild/event-core-clean`
- Legacy-Branch: `archive/event-system-legacy-2026-08-13`
- Supabase-Projekt: `gnkjzinwvmrxcadwebhv` (Event-Core-Baseline, Auth behalten)
- public-Schema: sechs leere Tabellen `venues`, `events`, `event_lineup`, `event_genres`, `event_tickets`, `event_sources`
- nächster Schritt: manueller Event-Roundtrip in der echten App
