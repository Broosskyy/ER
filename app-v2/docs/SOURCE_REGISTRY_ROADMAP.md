# Source Registry Roadmap — Ticket Platforms & Admin-Driven Acquisition

**Sprint:** 30  
**Goal:** Move from code-defined sources to admin-registered sources with platform auto-detection

---

## Current State

| Capability | Status |
|------------|--------|
| Source CRUD (admin API) | Implemented |
| `source_config` JSON (website strategies) | Implemented |
| Production sources in SQL seeds | Bootshaus, Affenkäfig |
| TypeScript factory mirrors | Tests + ops scripts |
| `ticket_platform` source type | Vocabulary only |
| `ticket_platform` category | Sprint 30 |
| `ticket_platform` connector | Not implemented |
| URL → platform detection | Not implemented |
| Admin "enter URL" wizard | Not implemented |

---

## Target State

Administrator enters `https://quelle.de` → system detects platform → proposes acquisition config → registers source → schedules imports.

```
Admin URL Input
      ↓
Platform Detector (ticket.io | ticket_king | tribe | json_ld | html)
      ↓
Acquisition Wizard (list + detail probes)
      ↓
Source Registry Entry (draft → testing → active)
      ↓
Generic ticket_platform Connector
      ↓
Existing Import / Match / Review / Publish Pipeline
```

---

## Roadmap Phases

### Phase 1 — Vocabulary & Contracts (Sprint 30) ✅

- [x] `ticket_platform` admin category
- [x] `ticket_platform` registry type
- [x] Platform acquisition contracts (ticket.io, TicketKings)
- [x] Generic architecture document
- [x] Duplicate simulation analysis

### Phase 2 — Connector Foundation (Sprint 31)

- [ ] Register `ticket_platform` in `SOURCE_CONNECTOR_KEYS`
- [ ] Implement `TicketPlatformConnector` with adapter interface:
  - `TicketPlatformAdapter.detect(url)`
  - `TicketPlatformAdapter.listEvents(config)`
  - `TicketPlatformAdapter.fetchDetail(url)`
- [ ] Platform adapters: `ticket_io`, `ticket_king` (config-driven, not hardcoded)
- [ ] Wire into `source-connector-resolution.ts` for `sourceType === 'ticket_platform'`
- [ ] Unit tests with recorded HTML fixtures (no live crawl in CI)

### Phase 3 — Platform Detection (Sprint 32)

- [ ] `PlatformDetectorService`:
  - Hostname rules (`*.ticket.io`, `ticketkings.de`)
  - Framework fingerprints (Tribe Events, Night Manager embed)
  - JSON-LD `@type: Event` probe
  - Response header / meta generator tags
- [ ] Confidence score + human confirmation in admin
- [ ] No auto-activation below threshold

### Phase 4 — Acquisition Wizard (Sprint 33)

- [ ] Admin API: `POST /admin/sources/probe` with URL
- [ ] Returns: detected platform, list URL, sample events, suggested config
- [ ] Preview import (dry-run) before activation
- [ ] UI deferred; API-first

### Phase 5 — Configurable Source Registry (Sprint 34)

- [ ] Remove hardcoded production factories as sole registration path
- [ ] Admin creates sources entirely via API + migrations optional
- [ ] `sources.category` DB column (migrate from `metadata.category`)
- [ ] Source groups: `official_website` + `ticket_shop` linked per organizer

### Phase 6 — Global Platforms (Sprint 35+)

- [ ] Eventbrite API adapter
- [ ] Resident Advisor (API or structured scrape per ToS)
- [ ] Generic Tribe Events / WordPress adapter (covers many promoters)

---

## Configurable Components (Future)

| Component | Today | Target |
|-----------|-------|--------|
| Source definition | SQL seed + TS factory | Admin API |
| Connector key | `source_roles` inference | Explicit + auto-detect |
| List selectors | `source_config.website` | Wizard-generated |
| Detail strategy | `json_ld` / `html_selector` | Auto-probed |
| Trust score | Per-source manual | Platform defaults + calibration |
| Publish mode | Per-source | Tiered by platform + organizer |
| Schedule | Per-source SQL | Admin UI |
| Platform adapter | N/A | Plugin registry |

---

## Connector Factory Design

```typescript
interface TicketPlatformAdapter {
  readonly platformId: string; // ticket_io | ticket_king | eventbrite
  detect(url: string, html: string): DetectionResult | null;
  buildListConfig(detection: DetectionResult): TicketPlatformListConfig;
  buildDetailConfig(detection: DetectionResult): TicketPlatformDetailConfig;
}

interface TicketPlatformAdapterRegistry {
  register(adapter: TicketPlatformAdapter): void;
  detect(url: string): DetectionResult | null;
  get(platformId: string): TicketPlatformAdapter;
}
```

Registration at bootstrap — adapters are code plugins, **source instances** are admin data.

---

## Validation Pipeline (Unchanged)

Ticket platform events flow through existing stages:

1. `RawImportedEvent` → connector output
2. `NormalizedEventCandidate` → normalizer
3. `CanonicalImportEvent` → aggregation
4. `MultiSourceMatchEngine` → duplicate detection
5. `TrustPublishDecisionEngine` → review/auto
6. `ImportPublishOrchestrator` → publish
7. `EntityResolutionWriteback` → venue/organizer aliases

No new pipeline required — only connector + config.

---

## Admin Vision — Automation Matrix

| Step | Automatable Today | Needs Future Work |
|------|-------------------|-----------------|
| Detect HTTPS reachability | Yes (HTTP client) | — |
| Detect ticket.io subdomain | Yes (hostname regex) | Shop slug extraction |
| Detect TicketKings / Tribe | Yes (HTML markers) | — |
| Detect JSON-LD events | Yes (existing parser) | — |
| Find event list URL | Partial (probe `/events/`, shop index) | Sitemap analysis |
| Find detail page structure | Partial (link crawl) | ML/heuristics for unknown sites |
| Extract organizer/venue | Yes (JSON-LD, Tribe markup) | — |
| Extract ticket prices | Partial | Embedded iframe APIs |
| Propose source config | No | Acquisition wizard |
| Register source | Yes (SourceService API) | Admin UI |
| Set trust/publish policy | Yes (API) | Platform templates |
| Enable scheduler | Yes (API) | — |
| Link to existing organizer | Partial (entity resolution) | Admin confirmation UI |

### Admin Input Flow (Future)

```
1. Admin: https://bootshaus-club.ticket.io/
2. System: Detected ticket.io shop "bootshaus-club", 17 upcoming events
3. Admin: Confirm organizer "Bootshaus Cologne", trust 70, manual_review
4. System: Creates source draft, dry-run import 3 events
5. Admin: Activate → schedule every 6h
```

---

## Duplicate Simulation — Affenkäfig Events

**Method:** Read-only analysis against production import data (`_affenkaefig_controlled_import_run.json`, `_affenkaefig_production_enablement_run.json`). No writes.

### Blocking Keys (from `duplicate-candidate-generator.ts`)

```
url:{originalLink|eventUrl}
external:{sourceId}:{externalId}
day-city:{YYYY-MM-DD}:{normalizedCity}
day-venue:{YYYY-MM-DD}:{normalizedVenue}
title-city:{normalizedTitle}:{normalizedCity}
```

### Simulation Matrix

| Affenkäfig Event | TicketKings Would Match? | ticket.io Would Match? | Primary Keys | Expected duplicate_score | Review Decision |
|------------------|--------------------------|------------------------|--------------|--------------------------|-----------------|
| Sommerfest Elektroküche 08.08 | **Yes** — same ticketUrl on canonical | No (not on Bootshaus shop) | `url:ticketkings.de/event/sommerfest-...` + `day-venue:2026-08-08:essigfabrik` | ~94 | `review_required` (manual_review mode) → merge as enrichment |
| MDMA F2F & B2B 15.08 | **Yes** | No | `url:` + `day-venue` | ~94 | merge candidate |
| Underland 05.09 | **Yes** | No | `url:` + `day-venue` | ~94 | merge candidate |
| MDMA 10.10.2026 | **Yes** | No | `url:` + `day-venue` | ~94 | merge candidate |
| 14 Jahre Affenkäfig 19.09 | Partial — if TicketKings lists it | No | `day-venue` + `title-city` | 70–94 | review |
| Affenkäfig XXX Capitol Hagen | No TicketKings URL on website | No | `title-city` only | 0–70 | new event or low confidence |
| AFFENKÄFIG RULES @ Bootshaus 23.10 | **Yes** via ticket.io | **Yes** — `bootshaus-club.ticket.io/B3jK8aPC/` | `url:bootshaus-club.ticket.io/...` + `day-venue:2026-10-23:bootshaus` | ~94 | review; cross-source with Bootshaus website |
| Affenkäfig XXX A8 02.10 | Partial | No | `day-venue` + `title-city` | 0–94 | depends on TicketKings listing |

### Observed Production Behavior (Affenkäfig website import)

From enablement run — imports with `duplicate_score: 94` already matched existing canonical events (Bootshaus/shared events). Imports with `duplicate_score: 0` were net-new Affenkäfig-only events.

**Ticket platform import simulation:**

1. **TicketKings source** importing Affenkäfig shop → most events match existing Affenkäfig canonical events via `url:` key (ticketUrl already stored) or `day-venue` + title.
2. **ticket.io Bootshaus shop** → only co-hosted events match; would create review items for cross-source enrichment (ticket tiers, sold-out state).
3. **Review decisions:** `manual_review` + `merge` recommendation when `duplicate_score >= 90` and field differences are ticket/price only.
4. **No duplicate publish:** `DuplicateDecisionService` blocks auto-merge if `kept_separate` decision exists.

### Matching Key Priority for Ticket Platforms

```
1. url:{ticketUrl}           → strongest (already on many canonical events)
2. external:{platform}:{id}  → per-platform re-import
3. day-venue:{date}:{venue}  → cross-source without shared URL
4. title-city                → fallback, higher false-positive risk
```

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| 403 on ticket.io detail pages | Import failures | Rate limits, browser UA, fixture tests |
| Slug drift (Affenkäfig vs TicketKings) | Missed URL match | Rely on `day-venue` + title keys |
| Embedded checkout (Night Manager) | Price extraction hard | Store list-page price range; defer iframe parsing |
| Duplicate over-merge | Wrong event merge | Keep `manual_review` for ticket_platform; high threshold |
| Dual connector architectures | Implementation confusion | Use aggregation path; ER-013 for contract alignment only |
| Offset timezones from platforms | Frontend errors | Normalize to IANA at display (Sprint 29 fix) |
| Legal / ToS | Platform blocks scraping | Prefer iCal/API where available; respect robots.txt |

---

## Regression Checklist (Sprint 30)

| Area | Status |
|------|--------|
| Bootshaus source config | Unchanged |
| Affenkäfig source config | Unchanged |
| Search | Unchanged |
| Discovery | Unchanged |
| Scheduler | Unchanged |
| Review pipeline | Unchanged |
| Publish | Unchanged |
| Home | Unchanged |

Sprint 30 only adds vocabulary + documentation + category tests.

---

## Git Reference

- Commit: `docs(architecture): introduce generic ticket platform foundation`
- Files: docs + `source-categories.ts` + migration comment + tests
