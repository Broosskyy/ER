# 01 Dokumentationsübersicht

Übersicht aller Dokumentationsbände und deren Zweck.

---

## Bände

| Band | Ordner | Zweck | Status |
|------|--------|-------|--------|
| **0** | [00-master-index](../00-master-index/) | Master Index, Navigation, SSOT | ✅ |
| **1** | [01-product-vision](../01-product-vision/) | Vision, MVP, Personas, Features | ✅ |
| **2** | [02-ui-design](../02-ui-design/) | Mockups, Design System, Alignment | ✅ |
| **3** | [03-development](../03-development/) | Architektur, Sprints, Coding Standards | ✅ |
| **4** | [04-backend](../04-backend/) | Supabase, API, Schema, Security | ✅ |
| **4.5** | [04.5-event-automation](../04.5-event-automation/) | Event Automation Bible | ✅ |
| **4.6** | [04.6-authentication-identity](../04.6-authentication-identity/) | Authentication & Identity Bible | ✅ |
| **5** | [05-product-operations](../05-product-operations/) | Releases, Ops, QA, Moderation | ✅ |

---

## Band 4.5 — Event Automation

Kanoniche Dokumentation für Event-Ingestion, Import Pipeline, KI Agent, Confidence Score, Duplicate Detection, Moderation und Roadmap.

**Einstieg:** [04.5-event-automation/README.md](../04.5-event-automation/README.md)

| Kapitel | Thema |
|---------|-------|
| 01–12 | Overview, Sources, Pipeline, AI, Confidence, Dedup, Lifecycle, Verification, Moderation, Monitoring, Security, Roadmap |
| — | [Automation Architecture](../04.5-event-automation/AUTOMATION_ARCHITECTURE.md) |

---

## Band 4.6 — Authentication & Identity

Vollständiges Auth-System: Rollen, Registrierung, Login, Sessions, Organizer Verification, Security, Account Lifecycle.

**Einstieg:** [04.6-authentication-identity/README.md](../04.6-authentication-identity/README.md)

| Kapitel | Thema |
|---------|-------|
| 01–09 | Overview, Roles, Login, Registration, Organizer Verification, Sessions, Security, Lifecycle, Roadmap |

---

## Querverweise

```
Band 4 (Backend)
  ├── Band 4.5 (Event Automation) — Import, Pipeline, Moderation
  └── Band 4.6 (Authentication) — Auth, Rollen, Verification

Band 5 (Operations)
  ├── 13 Automation Operations
  ├── 14 Identity Operations
  └── 15 Organizer Verification Operations
```

---

## Analyse & Roadmap

| Dokument | Zweck |
|----------|-------|
| [analysis/](../analysis/01_project_audit.md) | Projekt-Audit, Gap Analysis, Architecture Review |
| [analysis/10_migration_roadmap.md](../analysis/10_migration_roadmap.md) | Sprint-Plan inkl. Auth → Verification → Automation |

---

## ZIP-Archive (Quellen)

| Band | Archiv |
|------|--------|
| 4.5 | [Eternal_Rave_Band_4_5_Event_Automation_Bible.zip](../Eternal_Rave_Band_4_5_Event_Automation_Bible.zip) |
| 4.6 | [Eternal_Rave_Band_4_6_Authentication_Identity_Bible.zip](../Eternal_Rave_Band_4_6_Authentication_Identity_Bible.zip) |
