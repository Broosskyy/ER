# Phase 4.8.6 — Unified Website Controlled Field Publishing

Generated: 2026-08-05T23:11:00.000Z

## Goal

First limited Unified Website publish path for exactly one approved source (`source-bootshaus-koeln`) and two pass-1 events. Legacy importer remains active as rollback/fallback.

## Scope

| Dimension | Allowed |
|-----------|---------|
| Source | `source-bootshaus-koeln` only |
| Events | `evt-1785339421539-k3swcrl` (R3HAB), `evt-1785339391167-tfaixrr` (Sommerfest) |
| Fields | title, description, imageUrl, genres, lineup, ticketUrl, websiteUrl, provenance |
| Forbidden | priceText, venue, organizer, source/ownership, coordinates, ticket phases |

## Feature Flags (defaults safe)

| Flag | Default |
|------|---------|
| `unifiedWebsitePublishEnabled` | `false` |
| `unifiedWebsitePublishSourceIds` | `[]` |
| `unifiedWebsitePublishEventIds` | `[]` |
| `unifiedWebsitePublishFields` | `[]` |
| `unifiedWebsitePublishDryRun` | `true` |

Separate from integrated-shadow flags. Legacy extraction unchanged.

## Preview Summary

| Metric | Value |
|--------|-------|
| Candidate mutations | 3 |
| Approved writes | 3 (R3HAB only) |
| Sommerfest writes | 0 |
| Skipped | 12 |
| Rejected | 0 |
| `productionMutationsInThisRun` | 0 |

### R3HAB approved writes

1. **description** — September public content; removes August 7 text, footer boilerplate, Bitly/app/merch contamination
2. **ticketUrl** — `https://bootshaus-club.ticket.io/C7JPnatZ/` (replaces malformed Bitly)
3. **lineup** — R3HAB, LA FUENTE, OLIVER MAGENTA, RELOVA, DAVE REPLAY (MAINFLOOR)

### Sommerfest

Zero mutations. Title, description, flyer, ticket CTA, venue (Essigfabrik), price, and TBA lineup state all skipped as unchanged or formatting-only.

## Downgrade Prevention

- URL scheme/trailing-slash differences skipped (`skipped_formatting_only`)
- Empty Unified values cannot clear populated canonical values
- Forbidden fields blocked at config layer
- `lineupState` evidence-only (no direct write)
- Quality gate evaluated per field before approval

## Ops Commands

```bash
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts verify-scope
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts preview
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts backup
# Apply requires explicit flags + approval:
# EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_ENABLED=true
# EXPO_PUBLIC_UNIFIED_WEBSITE_PUBLISH_DRY_RUN=false
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts apply --event=<id>
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts verify-consumer
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts verify-idempotency --event=<id>
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts verify-rollback
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts readiness
node --import tsx scripts/operations/_phase486-unified-website-controlled-publish.ts report
```

## Readiness

`PHASE_486_PASS1_COMPLETE` — pass 1 applied 2026-08-05.

| Check | Result |
|-------|--------|
| Pass 1 mutations (R3HAB) | 3 (description, ticketUrl, lineup) |
| Pass 1 mutations (Sommerfest) | 0 |
| Pass 2 mutations | 0 (idempotent) |
| R3HAB consumer acceptance | 7/7 pass |
| Sommerfest no-regression | 6/6 pass |
| Forbidden-domain fingerprints | unchanged |
| Rollback ready | yes |
| Legacy remains enabled | yes |

## Artifacts

- `docs/real-data/_phase486_publish_scope.json`
- `docs/real-data/_phase486_preview.json`
- `docs/real-data/_phase486_backup.json`
- `docs/real-data/_phase486_forbidden_fingerprints.json`
- `docs/real-data/_phase486_rollback.json`
- `docs/real-data/_phase486_before_after.json`
- `docs/real-data/_phase486_consumer_verification.json`
- `docs/real-data/_phase486_readiness.json`
- `docs/real-data/_phase486_publish_runs.json` (empty until apply)

## Module Layout

```
src/features/import/publish/unified-website-controlled-publish/
  config.ts              — scope, flags, field allowlists
  downgrade-prevention.ts — preview + downgrade gates
  apply.ts               — backup, fingerprints, consumer checks
  index.ts
  __tests__/phase486-controlled-publish.test.ts
```
