# Blueprint Guidelines — Phase BP-0

| Feld | Wert |
|------|------|
| **Zweck** | Regeln für Erstellung, Pflege und Versionierung des Master Blueprints |
| **Status** | Draft |
| **Version** | 1.0 |
| **Verantwortlich** | Product / Strategy (TBD) |
| **Letzte Aktualisierung** | 2026-07-03 |

---

## Inhaltsverzeichnis

1. [Grundsätze](#grundsätze)
2. [Dokumenten-Template](#dokumenten-template)
3. [Status-Workflow](#status-workflow)
4. [Versionierung](#versionierung)
5. [Archivierung](#archivierung)
6. [Abgrenzung zu anderen Ebenen](#abgrenzung-zu-anderen-ebenen)
7. [Review-Prozess](#review-prozess)
8. [Verwandte Dokumente](#verwandte-dokumente)

---

## Grundsätze

1. **Blueprint ≠ Code** — Keine Implementierungsdetails; strategische Ebene.
2. **Blueprint ≠ Band 0–5** — Technische Docs bleiben unter `docs/`.
3. **Nichts löschen** — Verworfenes nach `99_ARCHIVE/` verschieben.
4. **Platzhalter zulässig** — BP-0 legt nur das Fundament an; Inhalte folgen in BP-1+.
5. **Deutsch primary** — Englisch optional für Investor-Material (`11_INVESTORS/`).
6. **Entscheidungen protokollieren** — Strategische Weichenstellungen in `12_APPENDIX/Decisions.md`.

---

## Dokumenten-Template

Jede Blueprint-Datei **muss** enthalten:

| Pflichtfeld | Wert (Initial) |
|-------------|----------------|
| Titel | Dateiname als H1 |
| Zweck | Einzeiler: wofür dieses Dokument existiert |
| Status | `Draft` |
| Version | `1.0` |
| Verantwortlich | TBD (Rolle benennen) |
| Letzte Aktualisierung | ISO-Datum |
| Inhaltsverzeichnis | Anchor-Links |
| Platzhalter | TODO-Checkliste für BP-1+ |
| Verwandte Dokumente | Links zu Blueprint, Band 0–5, Reports, Mockups |

---

## Status-Workflow

```
Draft → Review → Approved → Archived (optional)
```

| Status | Bedeutung |
|--------|-----------|
| **Draft** | Struktur angelegt oder Inhalt in Arbeit |
| **Review** | Zur Freigabe eingereicht |
| **Approved** | Verbindlich für Produkt-/Business-Entscheidungen |
| **Archived** | Ersetzt; Original in `99_ARCHIVE/` |

---

## Versionierung

| Ebene | Schema | Beispiel |
|-------|--------|----------|
| Blueprint gesamt | Major.Minor | 1.0 |
| Einzeldatei | Major.Minor | 1.0 |
| Archiv-Einträge | Datum im Dateinamen | `2026-07-03_alte-pricing.md` |

Bei inhaltlichen Änderungen: Version erhöhen und „Letzte Aktualisierung“ anpassen.

---

## Archivierung

1. Datei nach `Blueprint/99_ARCHIVE/` kopieren.
2. Dateiname: `YYYY-MM-DD_kurztitel.md`
3. Verweis auf Nachfolger-Dokument setzen.
4. Original durch Redirect-Stub ersetzen oder löschen **nur** wenn Archiv-Kopie existiert.

---

## Abgrenzung zu anderen Ebenen

| Ebene | Ort | Enthält | Enthält nicht |
|-------|-----|---------|---------------|
| App | `app/`, `src/` | Code | Strategie |
| Band 0–5 | `docs/` | Tech Specs, Architektur, DoD | Business Model |
| Master Blueprint | `Blueprint/` | Vision, Produkt, Business | React-Native-Code |
| Mockups | `assets/mockups/` | UI-Referenz | Sprint-Ergebnisse |
| Sprint Reports | `docs/reports/` | QA, Runtime, APK | Langfrist-Roadmap |

Bei Widersprüchen: Blueprint (strategisch) und Band (technisch) synchronisieren; Entscheidung in `Decisions.md`.

---

## Review-Prozess

1. Autor setzt Status auf `Review`.
2. Product / Strategy prüft Konsistenz mit Band 0–5 und Master Prompt.
3. Bei Freigabe: Status `Approved`, Version erhöhen.
4. Ableitungen in Band 0–5 oder Sprints nur bei expliziter Freigabe.

---

## Verwandte Dokumente

- [`Blueprint/00_READ_ME_FIRST.md`](../00_READ_ME_FIRST.md)
- [`Blueprint/reports/BLUEPRINT_SETUP_REPORT.md`](./BLUEPRINT_SETUP_REPORT.md)
- [`docs/00-master-index/README.md`](../../docs/00-master-index/README.md) — Band 0
- [`docs/01-product-vision/MASTER-PROMPT-v3.0.md`](../../docs/01-product-vision/MASTER-PROMPT-v3.0.md)
- [`docs/project/definition-of-done.md`](../../docs/project/definition-of-done.md)
- [`docs/rules/PROJECT_RULES.md`](../../docs/rules/PROJECT_RULES.md)
