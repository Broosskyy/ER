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
- [x] M5.1 Bootshaus Official Text Evidence (30/30 Gate)
- [x] M5.2 Bootshaus Official Media Evidence (30/30 Gate, local Tesseract)
- [ ] M6 Controlled Cutover
- [ ] M7 Legacy Removal

Nur ein Meilenstein darf gleichzeitig als IN PROGRESS markiert sein.

## Aktueller Zustand

M4.1 wurde visuell funktional bestätigt (`passed_remote_desktop_web`). M5 hat die vollständige Bootshaus-Referenzmenge über denselben EventCandidate- und Persistenzpfad persistiert: 30 Bootshaus Official Events plus 1 unverändertes M2-Testevent in der Datenbank. M5-Geräteprüfung deckte unvollständige optionale Official Evidence auf: `persist_ready` bestätigt Pflichtfelder und technische Persistierbarkeit, aber nicht automatisch Evidence-Vollständigkeit für Line-up und Genres.

M5.1 hat alle 30 gecachten Bootshaus-Detailseiten offline auf explizite Line-up-/Genreblöcke geprüft, textbasierte Evidence generisch vervollständigt und Media-only-Gaps ehrlich markiert (`lineup_media_required` wo nur Flyer/Bilder Acts liefern). Eine atomare Korrektur hat 16 Events mit ergänzter Official-Text-Line-up-Evidenz aktualisiert (`event_lineup` 45 → 114); Genres blieben bei 41 Zeilen. Keine Ticketanreicherung, keine Eventkernfeld-Änderungen, M2 unverändert.

M5.2 hat alle 30 Bootshaus-Official-Images über den Golden Path verarbeitet: Safe Image Fetch (HTTPS-Host-Allowlist, Redirect-/MIME-/Größenprüfung, SHA-256), lokaler `TesseractMediaEvidenceProvider` (`tesseract.js`, keine externe Vision-API), layout-aware OCR, Media/Text-Reconciliation und Content Quality Gate. Eine atomare Korrektur hat 9 Events mit verifizierter Media-Line-up-Evidenz ergänzt (`event_lineup` 114 → 139); Genres blieben bei 41 Zeilen. Unsichere OCR-Konflikte wurden als `lineup_media_ambiguous` dokumentiert, ohne unsichere Acts zu publizieren. M2 unverändert.

Nächster Schritt: verifizierte Ticket-Evidenz (M6).

## Aktive Umgebung

- aktiver Git-Branch: `rebuild/event-core-clean`
- Legacy-Branch: `archive/event-system-legacy-2026-08-13`
- Supabase-Projekt: `gnkjzinwvmrxcadwebhv` (Event-Core-Baseline, Auth behalten)
- public-Schema: 31 Events (30 Bootshaus Official + 1 M2), 31 Sources (30 Official + 1 Manual), 139 `event_lineup`, 41 `event_genres`
- `physicalDeviceVisualCheck`: `pending_official_evidence_recheck` (M5.2)
- nächster Schritt: M6 Ticket-Evidenz
