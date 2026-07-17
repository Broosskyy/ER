# 04 — Rules Final (Sprint 0 FINAL)

> **Validierung:** Alle Projektregeln · **Stand:** Juni 2026

---

## Rules-Index

| Datei | Pfad | Status |
|-------|------|--------|
| PROJECT_RULES | [docs/rules/PROJECT_RULES.md](../rules/PROJECT_RULES.md) | ✅ 10 Regeln |
| CODING_RULES | [docs/rules/CODING_RULES.md](../rules/CODING_RULES.md) | ✅ |
| DESIGN_RULES | [docs/rules/DESIGN_RULES.md](../rules/DESIGN_RULES.md) | ✅ |
| ARCHITECTURE_RULES | [docs/rules/ARCHITECTURE_RULES.md](../rules/ARCHITECTURE_RULES.md) | ✅ |
| CURSOR_RULES | [docs/rules/CURSOR_RULES.md](../rules/CURSOR_RULES.md) | ✅ |

Einstieg: [docs/rules/README.md](../rules/README.md)

---

## PROJECT_RULES — Zusammenfassung

| # | Regel | Sprint 0 FINAL |
|---|-------|----------------|
| 1 | SSOT: Band 0–5 (+ 4.5, 4.6) | 🟡 Regeltext noch 0–5; Doku erweitert |
| 2 | Mockups = visuelle Referenz (79 Screens) | ✅ |
| 3 | Bestehender Code hat Priorität | ✅ |
| 4 | Keine Breaking Changes | ✅ |
| 5 | Design System Vorrang (theme.ts, components/) | ✅ |
| 6 | Motion Library (Band 2, Mockups 70–79) | ✅ |
| 7 | Accessibility beachten | 🟡 Code minimal |
| 8 | Inkrementelle Verbesserung | ✅ |
| 9 | Analyse → Plan → Umsetzung | ✅ |
| 10 | Dokumentation vor Implementierung | ✅ |

---

## CODING_RULES — Zusammenfassung

| Bereich | Regel |
|---------|-------|
| TypeScript | `strict: true`, explizite Types |
| Services | `ServiceResult<T>`, kein throw für erwartete Fehler |
| Naming | camelCase Funktionen, PascalCase Components |
| Imports | Direkt, kein erzwungenes Barrel außer components/ |
| Git | Feature Branches `cursor/<name>-a932`, descriptive commits |
| Tests | Geplant (Sprint 14), noch nicht vorhanden |
| Kein Refactoring | Ohne expliziten Auftrag |

Referenz: [docs/03-development/09_Coding_Standards.md](../03-development/09_Coding_Standards.md)

---

## DESIGN_RULES — Zusammenfassung

| Bereich | SSOT | Code-Status |
|---------|------|-------------|
| Farben | theme.ts + Band 2 | ✅ `#0B0B0F`, `#7C3AED`, … |
| Typography | Band 2 Kap. 03 | 🟡 System fonts |
| Spacing | Band 2 + theme | 🟡 Teilweise |
| Components | src/components/ (36) | ✅ |
| Mockups | assets/mockups/ (8 ZIPs) | ✅ |
| Motion | Band 2 Kap. 07 | 🟡 Minimal Reanimated |
| Dark Mode Only | theme | ✅ |

**Regel:** Keine neuen Designs erfinden — Mockups + Band 2 folgen.

---

## ARCHITECTURE_RULES — Zusammenfassung

| Prinzip | Detail |
|---------|--------|
| Layered Monolith | app → hooks → services → supabase |
| ADR-Pflicht | Neue Tech → ADR erstellen |
| Lifecycle | Nur `published` im Public Feed |
| Kein Auto-Publish | Band 4.5 Regel |
| RLS | Server-side Authorization |
| Demo-Modus | isSupabaseConfigured() branching |
| Performance | Pagination + Virtualization vor Scale |
| State | Context (Ist) — Zustand/Query (Soll, ADR offen) |

---

## CURSOR_RULES — Zusammenfassung

| Bereich | Regel |
|---------|-------|
| Antwortformat | Analyse → Plan → Umsetzung → Ergebnis → Offene Punkte |
| Scope | Nur angefragte Änderungen |
| Kein Over-Engineering | Minimale Diffs |
| SSOT | Band 0–5 + 4.5 + 4.6 + Mockups |
| Keine Breaking Changes | Default |
| Tests | Nur wenn sinnvoll / explizit |
| Branch Naming | `cursor/<descriptive>-a932` |

---

## Review Checklists

### Pre-Sprint Checklist
- [ ] Band 0–5 + 4.5 + 4.6 geprüft
- [ ] Relevante ADRs gelesen
- [ ] PROJECT / CODING / DESIGN RULES
- [ ] Mockup-Index für betroffene Screens
- [ ] Kein Breaking Change geplant

### Pre-PR Checklist
- [ ] Nur Scope-Dateien geändert
- [ ] TypeScript kompiliert
- [ ] Keine Secrets committed
- [ ] Docs aktualisiert wenn Verhalten/Docs betroffen
- [ ] TECH DEBT Register prüfen (analysis/09)

### UI Change Checklist
- [ ] Mockup referenziert
- [ ] theme.ts Tokens verwendet
- [ ] Bestehende Components wiederverwendet
- [ ] Dark mode konsistent
- [ ] Accessibility Labels (wo möglich)

---

## Git Rules

| Regel | Detail |
|-------|--------|
| Base Branch | `main` |
| Feature Branch | `cursor/<name>-a932` |
| Commits | Descriptive, complete sentences |
| PR | Draft default, docs + code getrennt wenn möglich |
| Kein Force Push | main |
| APK Releases | GitHub Releases (Band 5) |

---

## Regel-Konsistenz

| Prüfung | Ergebnis |
|---------|----------|
| Rules vs Band 3 Coding Standards | ✅ Aligniert |
| Rules vs ADR-006 (Context) | ✅ |
| Rules vs Band 4.5 (No Auto-Publish) | ✅ |
| Rules vs Band 4.6 (Admin intern) | ✅ |
| PROJECT_RULES Band-Referenz | 🟡 4.5/4.6 ergänzen (Sprint 1) |

---

## Sprint 1 Rules-Tasks

1. PROJECT_RULES Regel 1 → Band 4.5 + 4.6 explizit
2. Optional: `.cursor/rules` oder Root `.cursorrules` aus CURSOR_RULES
3. Review Checklists in Band 5 QA integrieren (optional)

---

*Rules Final — verbindlich ab Sprint 1.*
