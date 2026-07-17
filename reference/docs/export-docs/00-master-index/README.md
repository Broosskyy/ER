# Eternal Rave — Master Index

> **Stand:** Juni 2026 · **App-Version:** 1.7.0  
> **Repository:** https://github.com/Broosskyy/Eternal-Rave

---

## Dokumentationsübersicht

| Band | Name | Einstieg |
|------|------|----------|
| **Band 0** | Master Index | [Du bist hier](./README.md) |
| **Band 1** | Product Vision | [01-product-vision](../01-product-vision/README.md) |
| **Band 2** | UI & Design | [02-ui-design](../02-ui-design/README.md) |
| **Band 3** | Development | [03-development](../03-development/README.md) |
| **Band 4** | Backend | [04-backend](../04-backend/README.md) |
| **Band 4.5** | Event Automation | [04.5-event-automation](../04.5-event-automation/README.md) |
| **Band 4.6** | Authentication & Identity | [04.6-authentication-identity](../04.6-authentication-identity/README.md) |
| **Band 5** | Product Management & Operations | [05-product-operations](../05-product-operations/README.md) |

---

## Sprint 0 — Project Ready

| Dokument | Beschreibung |
|----------|--------------|
| [PROJECT_READY.md](../PROJECT_READY.md) | Projekt bereit für Sprint 1+ |
| [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) | Ordnerstruktur (validiert) |
| [sprint-0-final/](../sprint-0-final/README.md) | Sprint 0 FINAL Reports |
| [sprint-0.5/](../sprint-0.5/README.md) | Sprint 0.5 Quality Gate |
| [ADR/](../ADR/) | Architecture Decision Records |
| [rules/](../rules/) | Projekt-, Coding-, Design-, Cursor-Rules |
| [analysis/](../analysis/) | Projektanalyse (01–10) |

---

## Schnellnavigation

| Bereich | Dokument |
|---------|----------|
| **Product Vision** | [MASTER-PROMPT-v3.0](../01-product-vision/MASTER-PROMPT-v3.0.md) |
| **UI Mockup** | [MOCKUP-SCREENS](../02-ui-design/MOCKUP-SCREENS.md) |
| **Ist vs. Soll** | [MOCKUP-ALIGNMENT](../02-ui-design/MOCKUP-ALIGNMENT.md) |
| **Sprint-Bericht** | [BERICHT-ETERNAL-RAVE-GESAMT](../03-development/BERICHT-ETERNAL-RAVE-GESAMT.md) |
| **Backend Setup** | [04-backend/README](../04-backend/README.md) |
| **Event Automation** | [04.5-event-automation/README](../04.5-event-automation/README.md) |
| **Authentication** | [04.6-authentication-identity/README](../04.6-authentication-identity/README.md) |
| **Releases & APK** | [05-product-operations/README](../05-product-operations/README.md) |
| **Projekt-Analyse** | [analysis/01_project_audit](../analysis/01_project_audit.md) |
| **Sprint 0 FINAL** | [sprint-0-final](../sprint-0-final/README.md) |
| **Sprint 0.5 Quality Gate** | [sprint-0.5](../sprint-0.5/README.md) |
| **PROJECT READY** | [PROJECT_READY.md](../PROJECT_READY.md) |

---

## Dokumentations-Ordner

```
docs/
├── 00-master-index/           ← Du bist hier (Band 0)
├── 01-product-vision/         Band 1 — Vision, MVP, Master Prompt
├── 02-ui-design/              Band 2 — Mockup, Design Alignment
├── 03-development/            Band 3 — Sprints, Architektur
├── 04-backend/                Band 4 — Supabase, API, Schema
├── 04.5-event-automation/     Band 4.5 — Event Automation Bible
├── 04.6-authentication-identity/  Band 4.6 — Auth & Identity Bible
├── 05-product-operations/     Band 5 — Releases, Ops, Roadmap
├── analysis/                  Projekt-Analyse (01–10)
├── sprint-0-final/            Sprint 0 FINAL Reports
├── sprint-0.5/                Sprint 0.5 Quality Gate
├── ADR/                       Architecture Decision Records
├── rules/                     Projekt- & Coding-Rules
├── PROJECT_READY.md
└── PROJECT_STRUCTURE.md

assets/                        (Repo-Root) Icons, Branding, Mockups
database/                      (Repo-Root) Schema, Seeds
```

---

## Kernfrage (MVP)

> **„What electronic music events are happening near me?“**

---

## Tech Stack

React Native · Expo SDK 56 · TypeScript · Expo Router · NativeWind · Supabase

---

## Wichtige Code-Pfade

| Layer | Pfad |
|-------|------|
| Screens | `app/` |
| Components | `src/components/` |
| Services | `src/services/` |
| Hooks | `src/hooks/` |
| DB Migrationen | `supabase/migrations/` |
| Theme / Tokens | `src/constants/theme.ts` |

---

## Weitere Band-0-Kapitel

| # | Datei | Thema |
|---|-------|-------|
| 01 | [Dokumentationsübersicht](./01_Dokumentationsuebersicht.md) | Alle Bände im Detail |
| 02 | [Navigation](./02_Navigation.md) | Zwischen Bänden navigieren |
| 04 | [Versionsverwaltung](./04_Versionsverwaltung.md) | Doc-Versionen |
| 05 | [Änderungsprotokoll](./05_Aenderungsprotokoll.md) | Changelog |
| 10 | [Master Roadmap](./10_Master_Roadmap.md) | Gesamt-Roadmap |
| 12 | [Dokumentationsstatus](./12_Dokumentationsstatus.md) | Fortschritt aller Bände |
