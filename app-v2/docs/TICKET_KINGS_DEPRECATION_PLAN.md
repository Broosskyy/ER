# Ticket Kings — Deprecation & Migration Plan

**Decision date:** 2026-07-30  
**Status:** Approved product direction — **plan only** (no code removal, no data migration yet)  
**Strategic focus:** Ticket.io as the prioritized ticket platform; Affenkäfig website remains the primary official source for Affenkäfig events.

---

## 1. Product Rationale

Ticket Kings does not deliver net-new event coverage for Eternal Rave today:

| Observation | Evidence |
|-------------|----------|
| Overlap with Affenkäfig website | Affenkäfig events are fully imported via `source-affenkaefig` (JSON-LD / event detail pages) |
| Ticket Kings adds duplicate candidates | Sprint 33.5 publish E2E: enrichment origins on events already canonical from website |
| Limited platform breadth | `/all-events/` listing is dominated by Köln/Affenkäfig ecosystem promoters — not a national electronic index |
| Operational cost | Extra review queue, duplicate matching, discovery crawler, organizer-scoped sources, dedicated tests |
| Ticket.io is strategically different | Per-organizer white-label shops expose **new** organizers/clubs not yet in the corpus |

**Conclusion:** Ticket Kings is a low-value enrichment layer for data already covered. Deprecating it reduces complexity without losing primary event coverage, provided sources are disabled (not deleted) and historical origins are preserved.

---

## 2. Inventory — Where Ticket Kings Is Used

### 2.1 Connector & Aggregation

| Location | Role | TK-specific? |
|----------|------|--------------|
| `src/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter.ts` | HTML/JSON-LD parser for `ticketkings.de` | **Yes** |
| `src/features/aggregation/connectors/ticket-platform/adapter-registry.ts` | Registers `ticket_king` adapter | Partial (registry is generic) |
| `src/features/aggregation/connectors/ticket-platform/types.ts` | `TICKET_PLATFORM_IDS` includes `ticket_king` | Partial |
| `src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-*.html` | Test fixtures | **Yes** |
| `src/features/aggregation/connectors/ticket-platform/__tests__/ticket-kings-adapter.test.ts` | Adapter tests | **Yes** |

Generic ticket-platform infrastructure (`TicketPlatformConnector`, `normalize-ticket-event`, `electronic-music-scope-filter`, `ticket-platform-fetch`) is **shared** with Ticket.io — **keep**.

### 2.2 Platform Discovery

| Location | Role | TK-specific? |
|----------|------|--------------|
| `src/features/ticket-platform-discovery/discovery/ticket-kings-platform-crawler.ts` | Crawls `/all-events/` + pagination | **Yes** |
| `src/features/ticket-platform-discovery/services/platform-discovery-service.ts` | `runTicketKingsDiscovery()`, organizer candidates | Partial |
| `src/features/ticket-platform-discovery/config/proposed-source-config.ts` | `buildTicketKingsPlatformSourceRecord`, `buildTicketKingsOrganizerSourceRecord` | **Yes** |
| `src/features/ticket-platform-discovery/admin/PlatformDiscoveryPanel.tsx` | "Discover Ticket Kings" button | Partial |
| `supabase/migrations/20260767000000_sprint334_platform_discovery.sql` | DB check `platform in ('ticket_io', 'ticket_king')` | Partial (schema supports both) |

### 2.3 Production Sources & Scheduler

| Source ID | Origin | Scheduler | Notes |
|-----------|--------|-----------|-------|
| `source-affenkaefig-ticket-kings` | Migration `20260764000000_sprint32_ticket_kings_production.sql` | `every_6_hours`, enabled | Primary TK production source |
| `source-ticket-kings-org-elektrokuche` | Sprint 33.4 discovery activation | Likely `every_6_hours` | Organizer-scoped candidate |
| `source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt` | Sprint 33.4 discovery activation | Likely `every_6_hours` | Organizer-scoped candidate |
| `source-ticket-kings-platform` | Proposed config (may exist if activated) | If activated | Platform-wide candidate |

Scheduler wiring is **generic** (`import-scheduler-engine`, `SourceBackedImportScheduleRepository`) — no TK-specific scheduler code.

### 2.4 Admin

| Surface | TK reference |
|---------|--------------|
| `/admin/sources` → Platform Discovery panel | "Discover Ticket Kings" action |
| `/admin/sources/[id]` | TK source detail pages |
| `/admin/imports/review` | TK import records in review queue |
| Import approve/publish | Generic; TK used enrichment duplicate path in Sprint 33.5 |

### 2.5 Registry & Onboarding

| Location | Role |
|----------|------|
| `src/features/source-onboarding/registry/platform-registry.ts` | `ticket_king` entry, `productionReady: true` |
| `src/features/source-onboarding/registry/acquisition-strategy-registry.ts` | `ticket_platform` strategy mentions Ticket Kings |
| `src/features/source-onboarding/discovery/source-discovery-engine.ts` | Hostname detection for `ticketkings.de` |
| `src/features/source-onboarding/config/config-generator.ts` | Platform config generation |
| `src/features/sources/production/ticket-kings-source.core.ts` | Production source factory |
| `src/features/sources/production/ticket-kings-source.ts` | Re-exports |
| `src/features/sources/production/ticket-kings-source.fixtures.server.ts` | Test/ops fixtures |

### 2.6 Tests (47 files reference Ticket Kings — full list in §7)

Key test files:

- `sprint32-ticket-kings-migration.test.ts`
- `ticket-kings-integration.test.ts`
- `ticket-kings-duplicate-detection.test.ts`
- `sprint334-platform-discovery.test.ts` (partial)
- `sprint335-ticket-platform-e2e.test.ts` (partial)
- Ops: `_sprint333-ticket-platform-activation.ts`, `_sprint334-*`, `_sprint335-*`, `_probe-ticket-platform-discovery.ts`

### 2.7 Documentation

| Document | Content |
|----------|---------|
| `TICKET_KING_ACQUISITION_CONTRACT.md` | Full platform analysis |
| `TICKET_KINGS_PRODUCTION_REPORT.md` | Sprint 32 activation report |
| `TICKET_PLATFORM_DISCOVERY.md` | TK as primary discovery mode |
| `SPRINT_33_3`–`33_5` reports | Validation with TK metrics |
| `SOURCE_REGISTRY_ROADMAP.md` | TK in platform detector roadmap |
| `GENERIC_TICKET_PLATFORM_ARCHITECTURE.md` | References TicketKings contract |
| `SOURCE_DISCOVERY_STRATEGIES.md` | Lists `ticket_king` as production-ready |

### 2.8 Database (production data — do not delete)

| Table | TK-related data |
|-------|-----------------|
| `sources` | Rows for `source-affenkaefig-ticket-kings` + discovery-activated organizer sources |
| `import_records` | Historical imports from TK sources |
| `import_runs` / `import_jobs` | Scheduler run history |
| `event_source_references` | Origins with `platform: ticket_king` (~5+ per Sprint 33.5 validation) |
| `platform_discovery_runs` | Runs with `platform = ticket_king` |
| `platform_discovery_candidates` | Organizer/platform_list candidates |
| `events` | Canonical events — **including any created solely from TK** (e.g. duplicate MDMA 10.10.26 row) |

**No migration alters historical rows.** Canonical events and origins remain immutable audit trail.

---

## 3. Migration Plan — Three Tiers

### Tier A — Deactivate (safe, immediate, reversible)

**Goal:** Stop new imports and scheduler noise without data loss.

| Action | Target | SQL / ops pattern |
|--------|--------|-------------------|
| Disable source | All `sources` where `source_config.ticketPlatform.platform = 'ticket_king'` OR `id LIKE '%ticket-kings%'` | `enabled = false`, `active = false`, `schedule_enabled = false` |
| Set lifecycle | Same rows | `source_lifecycle_status = 'deprecated'` (if column exists) or `metadata.deprecatedAt` |
| Cancel pending jobs | Import scheduler queue | Let in-flight jobs finish; no new runs |
| Hide discovery UI | Admin panel | Remove or disable "Discover Ticket Kings" button (code change, later sprint) |
| Update platform registry docs | `platform-registry.ts` | `productionReady: false`, `deprecated: true` (code change, later sprint) |

**Reversible:** Re-enable source + scheduler if decision reversed.

**Affected sources (minimum):**

```
source-affenkaefig-ticket-kings
source-ticket-kings-org-elektrokuche
source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt
source-ticket-kings-platform          (if exists)
```

**Proposed migration file (future):** `20260768000000_deprecate_ticket_kings_sources.sql`

```sql
-- Illustrative only — NOT applied in this sprint
update public.sources
set
  enabled = false,
  active = false,
  schedule_enabled = false,
  notes = coalesce(notes, '') || ' [DEPRECATED 2026-07-30: Ticket Kings strategic deprecation]',
  metadata = coalesce(metadata, '{}'::jsonb) || '{"deprecated":true,"deprecatedAt":"2026-07-30","reason":"overlap_with_affenkaefig_website"}'::jsonb,
  updated_at = now()
where id in (
  'source-affenkaefig-ticket-kings',
  'source-ticket-kings-org-elektrokuche',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt'
)
or (source_config->'ticketPlatform'->>'platform') = 'ticket_king';
```

### Tier B — Deprecate in code (keep compiled, stop promoting)

**Goal:** Code remains for historical imports/origins parsing; no new development path.

| Component | Action |
|-----------|--------|
| `ticket-kings-platform-crawler.ts` | `@deprecated` JSDoc — use Ticket.io discovery instead |
| `runTicketKingsDiscovery()` | `@deprecated` — return early or guard behind feature flag |
| `buildTicketKings*SourceRecord()` | `@deprecated` |
| `platform-registry` `ticket_king` | `productionReady: false`, add `deprecated: true` |
| `PlatformDiscoveryPanel` | Remove TK button or show "Deprecated" disabled state |
| `TICKET_PLATFORM_IDS` | Keep `ticket_king` for parse compatibility |
| `adapter-registry` | Keep adapter — required to re-process old import HTML |
| Tests | Keep adapter tests; mark discovery crawler tests `@deprecated` or skip with reason |

**Do not remove** `ticket_king` from DB check constraints until Tier C.

### Tier C — Delete (optional, ≥6 months after Tier A, explicit approval)

Only after:

- All TK sources disabled ≥6 months
- No open import records in `needs_review` for TK sources
- Product sign-off that origins are archival-only
- Regression suite updated

| Deletable later | Never delete without archive |
|-----------------|------------------------------|
| `ticket-kings-platform-crawler.ts` | `import_records` |
| Discovery TK tests | `event_source_references` |
| `buildTicketKings*` config builders | `events` (canonical) |
| Ops scripts `_sprint333` partial TK paths | `sources` rows (soft-delete only) |
| `TICKET_KING_ACQUISITION_CONTRACT.md` → move to `docs/archive/` | Migration `20260764000000` |

**Schema:** Keep `ticket_king` in `platform_discovery_*` CHECK constraints for historical run integrity, or migrate constraint in a dedicated sprint.

---

## 4. Functions — Keep vs Deprecate

### Keep (generally useful, not TK-specific)

| Function / module | Reason |
|-------------------|--------|
| `TicketPlatformConnector` | Ticket.io production imports |
| `parseTicketIoShopHtml` | Primary platform |
| `discoverTicketIoShops` / corpus mining | Strategic discovery |
| `electronic-music-scope-filter` | All ticket platforms + future |
| `ImportEventPublishService.publishRecord` | Enrichment for any `ticket_platform` |
| `isTicketPlatformEnrichmentApproval` | Ticket.io duplicate enrichment |
| `EventOriginService` | Multi-origin model |
| `platform_discovery_runs` / `candidates` tables | Ticket.io discovery |
| `PlatformDiscoveryPanel` (Ticket.io button) | Active workflow |
| Generic import scheduler | All sources |

### Deprecate (TK-only or TK-primary)

| Function / module | Replacement |
|-------------------|-------------|
| `crawlTicketKingsPlatform` | None — Affenkäfig website + Ticket.io shops |
| `parseTicketKingsShopHtml` | Keep for legacy parse only; no new sources |
| `runTicketKingsDiscovery` | Ticket.io corpus discovery |
| `buildTicketKingsPlatformSourceRecord` | — |
| `buildTicketKingsOrganizerSourceRecord` | Organizer website onboarding |
| `createAffenkaefigTicketKingsProductionSourceRecord` | `source-affenkaefig` website source |
| Platform registry `ticket_king` | `ticket_io` |
| Hostname detect → `ticket_king` in onboarding wizard | Warn "deprecated platform" |

---

## 5. Data Impact Analysis

### Will data be lost?

**No** — if Tier A only (deactivate):

| Data type | After deactivation |
|-----------|-------------------|
| Canonical events | Unchanged — remain published |
| `events.ticket_url` enriched from TK | Retained on event row |
| `event_source_references` (TK origins) | Retained — historical audit |
| Import records (`imported`, `duplicate`) | Retained |
| Discovery run history | Retained |
| Affenkäfig official website origin | Unaffected — primary source continues |

### Side effects to monitor

| Risk | Mitigation |
|------|------------|
| Events created **only** from TK (no website origin) | Audit query before Tier C; merge or keep as standalone canonical |
| Duplicate canonical events (MDMA 10.10.26 Bootshaus vs TK) | Existing dedup backlog — not caused by deprecation |
| Ticket URL only on TK origin, not on `events.ticket_url` | Consumer app uses `events.ticket_url`; verify website origin carries ticket link |
| Scheduler errors if source half-disabled | Atomic update: `enabled`, `active`, `schedule_enabled` together |

### Audit queries (run before Tier A migration)

```sql
-- TK sources still active
select id, display_name, enabled, schedule_enabled, source_lifecycle_status
from sources
where (source_config->'ticketPlatform'->>'platform') = 'ticket_king'
   or id like '%ticket-kings%';

-- Canonical events with ONLY ticket_king origins (no website origin)
select e.id, e.title, count(esr.id) filter (where esr.platform = 'ticket_king') as tk_origins,
       count(esr.id) filter (where esr.platform != 'ticket_king') as other_origins
from events e
join event_source_references esr on esr.event_id = e.id
group by e.id, e.title
having count(esr.id) filter (where esr.platform != 'ticket_king') = 0;

-- Pending TK review records
select ir.id, ir.source_id, ir.status, ir.title
from import_records ir
join sources s on s.id = ir.source_id
where (s.source_config->'ticketPlatform'->>'platform') = 'ticket_king'
  and ir.status = 'needs_review';
```

---

## 6. Recommended Execution Order

| Step | Sprint | Action |
|------|--------|--------|
| 1 | **33.6 (this)** | Product decision documented; deprecation plan approved |
| 2 | 33.7 | Run audit queries on production; confirm no TK-only canonical events without fallback ticket URL |
| 3 | 33.7 | Apply Tier A SQL migration (disable sources + scheduler) |
| 4 | 33.7 | Admin UI: disable/hide Ticket Kings discovery button |
| 5 | 33.7 | `platform-registry`: `productionReady: false` |
| 6 | 33.8 | `@deprecated` markers on TK-only modules |
| 7 | 33.8 | Refocus Sprint 33.6 coverage work entirely on Ticket.io deep discovery |
| 8 | Q1 2027+ | Tier C code removal (optional, after retention period) |

---

## 7. Full File List (Ticket Kings references)

**Source code (24 files):**

```
app-v2/src/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter.ts
app-v2/src/features/aggregation/connectors/ticket-platform/adapter-registry.ts
app-v2/src/features/aggregation/connectors/ticket-platform/types.ts
app-v2/src/features/aggregation/connectors/ticket-platform/__tests__/ticket-kings-adapter.test.ts
app-v2/src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-affenkaefig-events.html
app-v2/src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-event-detail.html
app-v2/src/features/ticket-platform-discovery/discovery/ticket-kings-platform-crawler.ts
app-v2/src/features/ticket-platform-discovery/services/platform-discovery-service.ts
app-v2/src/features/ticket-platform-discovery/config/proposed-source-config.ts
app-v2/src/features/ticket-platform-discovery/admin/PlatformDiscoveryPanel.tsx
app-v2/src/features/ticket-platform-discovery/__tests__/sprint334-platform-discovery.test.ts
app-v2/src/features/ticket-platform-discovery/__tests__/sprint335-ticket-platform-e2e.test.ts
app-v2/src/features/ticket-platform-discovery/__tests__/bundle-safe-imports.test.ts
app-v2/src/features/sources/production/ticket-kings-source.core.ts
app-v2/src/features/sources/production/ticket-kings-source.ts
app-v2/src/features/sources/production/ticket-kings-source.fixtures.server.ts
app-v2/src/features/sources/production/__tests__/ticket-kings-integration.test.ts
app-v2/src/features/source-onboarding/registry/platform-registry.ts
app-v2/src/features/source-onboarding/registry/acquisition-strategy-registry.ts
app-v2/src/features/source-onboarding/discovery/source-discovery-engine.ts
app-v2/src/features/source-onboarding/config/config-generator.ts
app-v2/src/features/source-onboarding/dry-run/source-onboarding-dry-run.ts
app-v2/src/features/import/matching/__tests__/ticket-kings-duplicate-detection.test.ts
app-v2/src/features/operations/backfill/event-origins-backfill-plan.ts
app-v2/src/data/__tests__/sprint32-ticket-kings-migration.test.ts
app-v2/src/data/__tests__/sprint334-migration.test.ts
```

**Migrations (2 files — never delete):**

```
app-v2/supabase/migrations/20260764000000_sprint32_ticket_kings_production.sql
app-v2/supabase/migrations/20260767000000_sprint334_platform_discovery.sql
```

**Ops scripts (6 files):**

```
app-v2/scripts/operations/_sprint333-ticket-platform-activation.ts
app-v2/scripts/operations/_sprint334-platform-discovery-validation.ts
app-v2/scripts/operations/_sprint334-production-validation.ts
app-v2/scripts/operations/_sprint335-ticket-platform-publish-e2e.ts
app-v2/scripts/operations/_sprint331-origin-metrics.ts
app-v2/scripts/operations/_probe-ticket-platform-discovery.ts
```

**Documentation (15+ files)** — see §2.7; historical sprint reports remain in `docs/` as archive.

---

## 8. Strategic Redirect — Ticket.io

After Ticket Kings deprecation, platform discovery investment goes to:

1. **Corpus expansion** — mine `*.ticket.io` from events, organizers, venues, social links
2. **External index probing** — sitemaps, search engines, club websites linking to ticket.io shops
3. **Shop activation workflow** — admin activates new `{slug}.ticket.io` sources
4. **Electronic scope filter** — unchanged; applies per shop

Ticket.io is the correct strategic bet because each shop represents a **distinct organizer** not necessarily covered by an official website source in Eternal Rave.

---

## 9. Sign-off Checklist (before Tier A execution)

- [ ] Product owner confirms Affenkäfig website covers all required Affenkäfig events
- [ ] Audit query: no published events depend solely on TK for `ticket_url`
- [ ] Audit query: zero `needs_review` TK records (or bulk-reject with reason)
- [ ] Stakeholders informed: TK ticket links on detail pages may come from website origin only going forward
- [ ] Tier A migration reviewed (no DELETE statements)
- [ ] Regression tests still green after UI/registry deprecation markers

---

## Related

- [TICKET_PLATFORM_DISCOVERY.md](./TICKET_PLATFORM_DISCOVERY.md) — updated strategy (Ticket.io focus)
- [TICKET_IO_ACQUISITION_CONTRACT.md](./TICKET_IO_ACQUISITION_CONTRACT.md) — prioritized platform contract
- [TICKET_KING_ACQUISITION_CONTRACT.md](./TICKET_KING_ACQUISITION_CONTRACT.md) — **deprecated** historical reference
