# Eternal Rave — PROJECT RULES

> **Verbindlich** für alle Contributors und Cursor Agents · Sprint 0

---

## Regel 1 — Single Source of Truth

Band 0 bis Band 5 unter `/docs` sind die **Single Source of Truth**.  
Alle Produkt-, Design- und Architekturentscheidungen müssen sich daran orientieren.

Einstieg: [docs/00-master-index/README.md](../00-master-index/README.md)

---

## Regel 2 — Mockups

Die Mockups unter `/assets/mockups` (79 Screens, 8 ZIPs) sind die **offizielle visuelle Referenz**.  
Keine eigenen Designs erfinden. Mockup-Index: [analysis/02_mockup_index.md](../analysis/02_mockup_index.md)

---

## Regel 3 — Bestehender Code

Bestehender Code hat Priorität. Nicht neu schreiben. Nicht neu strukturieren.  
Bestehende Funktionen erhalten. Nur **inkrementell** verbessern.

---

## Regel 4 — Keine Breaking Changes

Keine Breaking Changes an öffentlichen APIs, Routes, DB-Schema ohne Migration + ADR.

---

## Regel 5 — Design System

Design System hat Vorrang. Neue UI nur auf Basis der UI Components Library (`src/components/`) und Tokens (`src/constants/theme.ts`).  
Details: [DESIGN_RULES.md](./DESIGN_RULES.md)

---

## Regel 6 — Motion Library

Animationen orientieren sich an Band 2 Motion Library und Mockups 70–79.  
Keine exzessiven Animationen. Details: [DESIGN_RULES.md](./DESIGN_RULES.md)

---

## Regel 7 — Accessibility

Accessibility ist Pflicht — `accessibilityLabel`, Touch Targets, Reduce Motion wo möglich.

---

## Regel 8 — Performance

Keine unnötigen Re-Renders, Animationen oder Dependencies.  
Listen virtualisieren wenn skaliert wird. Details: [ARCHITECTURE_RULES.md](./ARCHITECTURE_RULES.md)

---

## Regel 9 — Sprint-Disziplin

Sprint für Sprint arbeiten. Niemals mehrere große Bereiche gleichzeitig umbauen.  
Roadmap: [analysis/10_migration_roadmap.md](../analysis/10_migration_roadmap.md)

---

## Regel 10 — Analyse vor Umsetzung

Vor jeder Änderung: **Analysieren → Plan → Risiken → Umsetzung → Ergebnis → Offene Punkte**

---

## Event Lifecycle (unverhandelbar)

Nur `lifecycle_status = published` Events erscheinen im Public Feed.  
Imports nie auto-publish. Admin Review Pflicht.

---

## Referenzen

- [MASTER-PROMPT-v3.0.md](../01-product-vision/MASTER-PROMPT-v3.0.md)
- [PROJECT_READY.md](../PROJECT_READY.md)
- [ADR/](../ADR/)
