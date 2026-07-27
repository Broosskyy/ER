# Event Submission Wizard — Flows

## Modi

| Modus | Status | Beschreibung |
|-------|--------|--------------|
| `create` | Funktional | Neues Event, neuer Draft |
| `editDraft` | Funktional | Bestehenden Entwurf fortsetzen |
| `editRequestedChanges` | Vorbereitet | Typisiert, keine UI |
| `editPublished` | Vorbereitet | Typisiert, keine UI |
| `claimImportedEvent` | Vorbereitet | Typisiert, keine UI |

## Wizard-Schritte (12)

1. Veranstalter
2. Grundinformationen
3. Datum und Uhrzeit
4. Veranstaltungsort
5. Genres und Kategorien
6. Line-up
7. Beschreibung und Hinweise
8. Bilder
9. Tickets
10. Social Links
11. Vorschau
12. Einreichen

## Flow A — Neues Event einreichen

```
Profile → Events veranstalten → /create → Event erstellen
→ Wizard (create) → Schritte 1–10 → Vorschau → Einreichen
→ Success → Submission Status
```

## Flow B — Entwurf fortsetzen

```
Wizard → Entwurf speichern → /create → Entwurf wählen
→ Wizard (editDraft) → gleicher Schritt + Daten
```

## Flow C — Zurück-Navigation

Schritt zurück behält zentralen Form-State (In-Memory + Autosave).

## Flow D — Reload

`app.eventWizardDrafts.v1` + `app.contributorEvents.v1` stellen Entwurf wieder her.

## Flow E — Vorschau bearbeiten

Vorschau-Schritt → „Bearbeiten“ → Sprung zum jeweiligen Wizard-Schritt.

## Flow F — Neues Event nach Success

Success → „Neues Event“ → leerer Wizard (create).

## Flow G — Status → Profil

Submission Status → Zurück zum Profil oder `/create`.
