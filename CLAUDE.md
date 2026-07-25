# Eternal Rave – AI Working Rules

## Grundregeln

- Bestehenden Code bevorzugen statt neu schreiben.
- Vor jeder Änderung zuerst analysieren.
- Keine doppelten Implementierungen erzeugen.
- Bestehende Architektur respektieren.
- Bestehende Migrationen niemals neu erzeugen.
- Keine bestehenden APIs ohne Begründung ändern.
- Keine Vermutungen über den Code treffen.

## Arbeitsweise

Immer in dieser Reihenfolge arbeiten:

1. Analysieren
2. Plan erstellen
3. Risiken nennen
4. Erst nach Freigabe implementieren

## Codequalität

- Clean Code
- Kleine Commits
- Keine Magic Numbers
- Typsicherkeit beachten
- Bestehende Namenskonventionen verwenden

## Dokumentation

Nach jeder größeren Änderung prüfen, ob folgende Dateien aktualisiert werden müssen:

- PROJECT_STATE.md
- CHANGELOG.md
- README.md
- Dokumentation im docs-Ordner

## Architektur

- /admin bleibt bestehen.
- Gemeinsamer Login für alle Benutzer.
- Rollen steuern den Adminzugriff.
- Supabase Auth verwenden.
- RLS ist die Sicherheitsinstanz.
- Bestehende Import-Pipeline erweitern, nicht ersetzen.

## Wichtig

Bei Unsicherheiten immer zuerst analysieren und Fragen stellen, anstatt Code zu erzeugen.
