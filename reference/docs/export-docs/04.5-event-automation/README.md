# Band 4.5 — Event Automation Bible

> **Status:** Kanonische Dokumentation · **Implementierung:** Teilweise (Sprint 2.x Foundation)  
> **Verwandt:** [Band 4 Backend](../04-backend/README.md) · [Band 4.6 Auth](../04.6-authentication-identity/README.md)

Die Event Automation ist **Bestandteil der offiziellen Projektarchitektur** von Eternal Rave. Sie beschreibt, wie Events aus vielfältigen Quellen erfasst, normalisiert, bewertet, moderiert und veröffentlicht werden.

---

## Kapitel

| # | Datei | Thema |
|---|-------|-------|
| 01 | [Automation Overview](./01_Automation_Overview.md) | Vision, Mission, MVP, Langfrist |
| 02 | [Event Sources](./02_Event_Sources.md) | Alle Quellentypen + Vertrauenslevel |
| 03 | [Import Pipeline](./03_Import_Pipeline.md) | End-to-End Datenfluss |
| 04 | [AI Agent](./04_AI_Agent.md) | Zukünftiger autonomer Agent |
| 05 | [Event Confidence](./05_Event_Confidence.md) | Confidence Score 0–100% |
| 06 | [Duplicate Detection](./06_Duplicate_Detection.md) | Fuzzy Matching, Bildvergleich |
| 07 | [Event Lifecycle](./07_Event_Lifecycle.md) | Automation Lifecycle |
| 08 | [Organizer Verification](./08_Organizer_Verification.md) | Verifizierung (Automation-Kontext) |
| 09 | [Moderation Workflow](./09_Moderation_Workflow.md) | Queue, Bulk, Audit |
| 10 | [Monitoring](./10_Monitoring.md) | KPIs, Fehler, Qualität |
| 11 | [Security & Legal](./11_Security_Legal.md) | DSGVO, Urheberrecht |
| 12 | [Roadmap](./12_Roadmap.md) | Phase 1–6 |
| — | [Automation Architecture](./AUTOMATION_ARCHITECTURE.md) | Architekturübersicht |

---

## Ist-Stand Code (Referenz, nicht ändern in Doc-Sprint)

| Bereich | Code-Pfad | Status |
|---------|-----------|--------|
| Source Manager | `app/admin/sources/` | ✅ |
| URL/Text Import | `app/admin/import/` | 🟡 Mock Parser |
| Duplicate Detection | `src/utils/duplicateDetection.ts` | ✅ Heuristik |
| Lifecycle | `src/services/events.ts` | ✅ |
| Auto-publish | — | 🔴 Nie (Regel) |

---

## Quell-ZIP

Archiv: [Eternal_Rave_Band_4_5_Event_Automation_Bible.zip](../Eternal_Rave_Band_4_5_Event_Automation_Bible.zip)
