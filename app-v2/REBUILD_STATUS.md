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
- [ ] M5 Bootshaus 30-Event Run
- [ ] M6 Controlled Cutover
- [ ] M7 Legacy Removal

Nur ein Meilenstein darf gleichzeitig als IN PROGRESS markiert sein.

## Aktueller Zustand

M4-Geräteprüfung deckte generische Description- und Projection-Fehler auf. M4.1 bereinigt Bootshaus-Beschreibungen generisch über alle 30 gecachten Events, korrigiert Ticket- und Line-up-Rollenprojektion in der App und aktualisiert die drei bereits persistierten Official Events über denselben Pfad. Keine Event-Sonderlogik. Die übrigen 27 Events sind offline geprüft, aber noch nicht persistiert. Nächster Schritt: visuelle Reprüfung (`pending_recheck`), danach M5 kontrollierte Persistenz der übrigen 27 Events.

## Aktive Umgebung

- aktiver Git-Branch: `rebuild/event-core-clean`
- Legacy-Branch: `archive/event-system-legacy-2026-08-13`
- Supabase-Projekt: `gnkjzinwvmrxcadwebhv` (Event-Core-Baseline, Auth behalten)
- public-Schema: vier Events (M2 + 3 Official), 30 Bootshaus-Evidences offline geprüft
- nächster Schritt: visuelle Reprüfung, dann M5 Persistenz der übrigen 27 Bootshaus-Events
