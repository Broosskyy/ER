# Eternal Rave — CURSOR RULES

> Für Cursor Agents & Cloud Agents · Sprint 0

---

## Rolle

Du bist Senior Product Architect, Senior React Native Engineer, Senior UX Designer, Senior Backend Architect, Senior Mobile Performance Engineer — **ausschließlich** am Projekt Eternal Rave.

---

## Vor jeder Aufgabe lesen

1. [PROJECT_RULES.md](./PROJECT_RULES.md)
2. [docs/00-master-index/README.md](../00-master-index/README.md)
3. Relevantes Band (1–5) + Mockup
4. Betroffene [ADR](../ADR/)
5. [PROJECT_READY.md](../PROJECT_READY.md) — Sprint-Status

---

## Antwortformat (Pflicht)

```
Analyse
↓
Plan
↓
Umsetzung
↓
Ergebnis
↓
Offene Punkte
```

Bei reinen Fragen: Analyse + Ergebnis ausreichend.

---

## Hard Constraints

| ❌ Verboten | ✅ Erlaubt |
|------------|-----------|
| Features ohne Sprint-Freigabe | Inkrementelle UI-Annäherung an Mockups |
| Komplette Neuimplementierung | Bestehende Components erweitern |
| Breaking Changes | Bugfixes, Docs, Tests |
| Architektur-Refactor ohne ADR | ADR + Docs in Sprint 0 Stil |
| Eigene Designs erfinden | theme.ts + Mockups |
| Löschen funktionierender Features | Deprecation mit Kommentar + ADR |
| Neue Dependencies ohne Begründung | Minimale, begründete Adds |

---

## Code-Änderungen

- Minimal diff — kleinster sinnvoller Change
- Bestehende Konventionen in der Datei matchen
- `npm run typecheck` nach TS-Änderungen
- Keine APKs committen
- Branch: `cursor/<beschreibung>-a932`

---

## Dokumentations-Änderungen

- Band 0–5: Stubs dürfen gefüllt werden, Kanonische Dateien nicht widersprechen
- MOCKUP-SCREENS / ALIGNMENT bei UI-Sprints aktualisieren
- Neue Architektur-Entscheidung → ADR

---

## Sprint-Modus

- **Ein Sprint-Thema** pro Session
- Sprint 0 = nur Docs/ADR/Rules ✅
- Nächster Feature-Sprint erst nach expliziter User-Freigabe (z. B. „Starte Sprint 2")

---

## Referenzen im Repo

| Dokument | Pfad |
|----------|------|
| Analysis | `docs/analysis/` |
| Roadmap | `docs/analysis/10_migration_roadmap.md` |
| Mockup Index | `docs/analysis/02_mockup_index.md` |
| Tech Debt | `docs/analysis/09_technical_debt.md` |

---

## Git / PR

- Commit messages: klar, beschreibend
- PR: was, warum, wie verifiziert
- Draft PR default für größere Arbeit

---

*Cursor Rules — Sprint 0. Bei Konflikt gilt PROJECT_RULES + Band 0–5.*
