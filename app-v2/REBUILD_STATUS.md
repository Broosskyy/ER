# Event-Core Clean Rebuild

## Entscheidung

- Die bestehende App-Shell, UI, Navigation, Authentifizierung, Profile, Favoriten und Organizer-/Admin-Oberflächen bleiben erhalten.
- Der bisherige Event-/Import-/Persistence-/Consumer-Datenpfad wird nicht weiter repariert.
- Er wird nach und nach durch genau einen neuen Event-Core ersetzt.
- Der alte Stand liegt ausschließlich im Archiv-Branch.
- Das bestehende Supabase-Projekt wurde auf die Event-Core-Baseline zurückgesetzt und ist nicht mehr Source Truth für Legacy-Events.

## Einziger geplanter Datenweg

Source Evidence → EventCandidate → Validation → EventWritePlan → Controlled Persistence → Event Reader → App

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
- [x] M1 Security Hardening
- [x] M1 Legacy Source Purge
- [x] M2 Manual Event Roundtrip
- [x] M3 Bootshaus Official Connector (Noop)
- [x] M4 Gemeinsamer EventCandidate und Referenz-Persistenz
- [x] M4.1 Generische Bootshaus-Bereinigung (30/30 Gate)
- [x] M5 Bootshaus 30-Event Run
- [ ] M6 Controlled Cutover
- [ ] M7 Legacy Removal

Nur ein Meilenstein darf gleichzeitig als IN PROGRESS markiert sein.

## Aktueller Zustand

M4.1 wurde visuell funktional bestätigt (`passed_remote_desktop_web`). M5 hat die vollständige Bootshaus-Referenzmenge über denselben EventCandidate- und Persistenzpfad persistiert: 30 Bootshaus Official Events plus 1 unverändertes M2-Testevent in der Datenbank. Keine Bilddateien gespeichert, keine Ticketseiten geladen, keine Bootshaus-Ticketzeilen angelegt. Nächster Schritt: M6 verifizierte Ticket-Evidenz für dieselben 30 Events. Danach M7 Official Media/Flyer Evidence für fehlende Line-ups und explizite Genres.

## Aktive Umgebung

- aktiver Git-Branch: `rebuild/event-core-clean`
- Legacy-Branch: `archive/event-system-legacy-2026-08-13`
- Supabase-Projekt: `gnkjzinwvmrxcadwebhv` (Event-Core-Baseline, Auth behalten)
- public-Schema: 31 Events (30 Bootshaus Official + 1 M2), 31 Sources (30 Official + 1 Manual)
- nächster Schritt: M6 Ticket-Evidenz für dieselben 30 Bootshaus-Events
