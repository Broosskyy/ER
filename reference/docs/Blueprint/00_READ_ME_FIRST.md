# Eternal Rave — Master Blueprint

## Metadaten

| Feld | Wert |
|------|------|
| **Zweck** | Langfristige Produkt-, Unternehmens- und Strategie-Dokumentation |
| **Status** | Draft |
| **Version** | 1.0 |
| **Letzte Aktualisierung** | 2026-07-03 |
| **Verantwortlich** | Product / Strategy (TBD) |

---

## Inhaltsverzeichnis

1. [Zweck des Blueprints](#zweck-des-blueprints)
2. [Aufbau](#aufbau)
3. [Dokumentationsregeln](#dokumentationsregeln)
4. [Versionierung](#versionierung)
5. [Workflow](#workflow)
6. [Beziehung zu Band 0–5](#beziehung-zu-band-05)
7. [Beziehung zu Sprint Reports](#beziehung-zu-sprint-reports)
8. [Beziehung zu den Mockups](#beziehung-zu-den-mockups)
9. [Beziehung zum Master Prompt](#beziehung-zum-master-prompt)

---

## Zweck des Blueprints

Der **Master Blueprint** ist die strategische Dokumentationsebene von Eternal Rave. Er beschreibt Vision, Produkt, Business, Community, Marketing, Design, Operations, Roadmap, Finance und Investor-Themen — **parallel** zur laufenden App-Entwicklung.

Der Blueprint ersetzt keine technische Implementierung. Er liefert den strategischen Rahmen, in dem Entwicklung, Design und Business-Entscheidungen getroffen werden.

---

## Aufbau

```
Blueprint/
├── 00_READ_ME_FIRST.md      ← Dieses Dokument
├── 01_VISION/               Vision, Mission, Values, Principles
├── 02_PRODUCT/              Produkt, Features, Roadmap
├── 03_BUSINESS/             Business Model, Pricing, Monetization
├── 04_COMMUNITY/            Community, Reputation, Social
├── 05_MARKETING/            Brand, Growth, Launch, SEO/ASO
├── 06_TECH/                 Architektur, Backend, AI (strategisch)
├── 07_DESIGN/               Branding, Design System, UX/UI
├── 08_OPERATIONS/           Support, Legal, GDPR, Prozesse
├── 09_ROADMAP/              2026–2030 + Long Term
├── 10_FINANCE/              Kosten, Forecast, KPIs, Budget
├── 11_INVESTORS/            Pitch, Funding, Milestones
├── 12_APPENDIX/             Glossar, Decisions, Links
├── 99_ARCHIVE/              Verworfene Ideen (nicht löschen)
└── reports/                 Blueprint-Setup- und Änderungsreports
```

---

## Dokumentationsregeln

1. **Jede Datei** enthält Metadaten (Zweck, Status, Version, Datum, Verantwortlich).
2. **Status-Werte:** `Draft` → `Review` → `Approved` → `Archived`
3. **Nichts löschen** — deprecated Inhalte nach `99_ARCHIVE/` verschieben.
4. **Keine Vermischung** — Blueprint ≠ technische Docs ≠ Sprint Reports ≠ Mockups.
5. **Platzhalter zulässig** — Inhalte werden in dedizierten Blueprint-Sprints ergänzt.
6. **Sprache:** Deutsch (Primary), Englisch optional für Investor-Material.

---

## Versionierung

| Ebene | Schema | Beispiel |
|-------|--------|----------|
| Blueprint gesamt | Major.Minor | 1.0 |
| Einzeldatei | Major.Minor | 1.0 |
| Archiv-Einträge | Datum im Dateinamen | `2026-07-02_alte-pricing.md` |

Bei inhaltlichen Änderungen: Version erhöhen und „Letzte Aktualisierung“ anpassen.

---

## Workflow

```
Idee / Entscheidung
    ↓
Blueprint-Dokument (Draft)
    ↓
Review (Product / Strategy)
    ↓
Approved → ggf. Ableitung in Band 0–5 oder Sprint
    ↓
Verworfen → 99_ARCHIVE/ (nicht löschen)
```

Der Blueprint wird **parallel** zur App-Entwicklung gepflegt — nicht nur am Sprint-Ende.

---

## Beziehung zu Band 0–5

| Ebene | Ort | Inhalt |
|-------|-----|--------|
| **Band 0–5** | `docs/` | Technische Projekt- und Entwicklungsdokumentation |
| **Master Blueprint** | `Blueprint/` | Vision, Produkt, Business, Strategie |

**Der Blueprint ergänzt Band 0–5 — er ersetzt sie nicht.**

- Band 0–5: Wie bauen wir? (Architektur, Specs, DoD, Theme, Components)
- Blueprint: Was bauen wir und warum? (Vision, Business Model, Roadmap)

Bei Widersprüchen: Blueprint (strategisch) → Band (technisch) klären und synchronisieren.

---

## Beziehung zu Sprint Reports

| Ebene | Ort | Inhalt |
|-------|-----|--------|
| **Sprint Reports** | `docs/reports/sprint-x/` | Sprint-Ergebnisse, QA, Screenshots |
| **Master Blueprint** | `Blueprint/` | Langfristige Strategie |

Sprint Reports dokumentieren **Was wurde geliefert?**  
Der Blueprint dokumentiert **Wohin geht das Produkt?**

Blueprint-Änderungen, die Sprint-Arbeit beeinflussen, werden in `12_APPENDIX/Decisions.md` festgehalten.

---

## Beziehung zu den Mockups

| Ebene | Ort | Inhalt |
|-------|-----|--------|
| **Mockups** | `assets/mockups/` | Verbindliche UI-Referenz (Design) |
| **Blueprint Design** | `Blueprint/07_DESIGN/` | Branding, Design System, UX-Prinzipien |

Mockups sind die **visuelle Wahrheit** für UI-Umsetzung.  
Blueprint/07_DESIGN beschreibt die **strategischen Design-Regeln**, aus denen Mockups abgeleitet werden.

---

## Beziehung zum Master Prompt

| Ebene | Ort | Inhalt |
|-------|-----|--------|
| **Master Prompt** | `docs/01-product-vision/MASTER-PROMPT-v3.0.md` | Kanonische CTO-Richtlinien, Design, Architektur, Quality Rules |
| **Master Blueprint** | `Blueprint/` | Langfristige Vision, Produkt, Business, Strategie |

Der **Master Prompt** steuert **wie** entwickelt wird (Coding, Design, Architektur, Qualität).  
Der **Master Blueprint** beschreibt **was** und **warum** (Produkt, Markt, Monetization, Roadmap).

| Master Prompt | Master Blueprint |
|---------------|------------------|
| Implementierungsregeln | Strategische Ziele |
| Design Tokens, Components | Brand, UX-Prinzipien |
| Sprint-Qualitäts-Gates | Release- und Feature-Roadmap |
| Technische Constraints | Business Model, Pricing |

Bei Widersprüchen: Blueprint (strategisch) klären → Master Prompt (technisch) anpassen → in `12_APPENDIX/Decisions.md` dokumentieren.

Weitere Referenzen: [`docs/project/definition-of-done.md`](../docs/project/definition-of-done.md) · [`docs/rules/PROJECT_RULES.md`](../docs/rules/PROJECT_RULES.md)

---

## Nächste Schritte

Siehe `Blueprint/reports/NEXT_STEPS.md` — Inhalte werden in separaten Blueprint-Sprints ergänzt (nicht in diesem Setup-Sprint).
