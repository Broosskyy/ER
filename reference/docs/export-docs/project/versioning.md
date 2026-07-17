# Eternal Rave — Versioning Strategy

> Pre-Sprint · Juni 2026  
> **Scope:** Roadmap-aligned semantic versioning for MVP → Launch → Post-Launch

---

## Overview

Eternal Rave uses **semantic versioning** (`MAJOR.MINOR.PATCH`) aligned with sprint milestones.  
Version bumps reflect **product maturity**, not arbitrary release dates.

Current app version: **1.7.0** (development builds; roadmap mapping below applies to future release lines).

---

## Pre-Launch Roadmap (0.x)

| Version | Phase | Focus |
|---------|-------|-------|
| **0.1.x** | Projektaufbau | Repo, docs Band 0–5, mockups, project structure, Sprint 0 |
| **0.2.x** | Foundation | Design tokens, theme alignment, component baseline, Sprint 1 |
| **0.3.x** | Authentication & Identity | Band 4.6 — login, registration, roles, sessions |
| **0.4.x** | Event Foundation | Event CRUD, lifecycle, submissions, admin review |
| **0.5.x** | Discovery & Home | Feed, search, filters, featured events, favorites |
| **0.6.x** | Organizer Platform | Organizer dashboard, verification, event management |
| **0.7.x** | Event Automation | Band 4.5 — import pipeline, confidence, dedup, moderation |
| **0.8.x** | Beta | Closed beta, feedback loops, stability hardening |
| **0.9.x** | Release Candidate | RC builds, store prep, final QA |
| **1.0.0** | Official Launch | Play Store / App Store public release |

---

## Post-Launch

| Version | Meaning |
|---------|---------|
| **1.x** | Feature releases — backward-compatible additions and improvements |
| **2.x** | Major platform evolution — breaking changes, architecture shifts, new platforms |

---

## Version Bump Rules

| Change type | Bump | Example |
|-------------|------|---------|
| Bug fix, doc-only, token tweak | PATCH | 0.2.0 → 0.2.1 |
| Sprint milestone complete | MINOR | 0.2.x → 0.3.0 |
| Breaking API / schema / UX paradigm | MAJOR | 0.9.x → 1.0.0 or 1.x → 2.0.0 |

**Sync:** `package.json`, `app.json`, and release tags must match after each sprint merge.

---

## Git Tags & Releases

- **Sprint reports:** `SPRINT_X_REPORT.zip` on `main` (no version tag required)
- **App builds:** GitHub Release tag matching version (e.g. `v1.7.0`)
- **Pre-1.0:** Tags may use `v0.x.y-beta` until RC phase

---

## References

- [README — Development Workflow](../../README.md#development-workflow)
- [Definition of Done](./definition-of-done.md)
- [PROJECT_READY.md](../PROJECT_READY.md)
- [analysis/10_migration_roadmap.md](../analysis/10_migration_roadmap.md)

---

*Versioning is a contract between sprints, releases and documentation.*
