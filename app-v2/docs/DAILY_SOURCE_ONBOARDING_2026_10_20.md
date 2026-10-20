# Eternal Rave — Daily source onboarding and Rausgegangen

**Public site:** https://eternal-rave.vercel.app. Historical "staging" Supabase project `gnkjzinwvmrxcadwebhv` is **live**. A successful build is not proof of a successful scheduled import.

## Registered daily sources

| Source | Schedule UTC | New events | Existing events, ticket prices, links, lineup |
| --- | --- | --- | --- |
| Bootshaus | 03:17 | Bounded upsert: max 8 new per run | Verified, up to 25 changes |
| Affenkäfig | 04:53 | Bounded upsert: max 8 new per run | Verified, up to 25 changes |
| ticket.io national | 06:29 | Discovery and review only | Read-only country-wide source + public-ticket audit |
| **Rausgegangen** | **07:41** | **New discoveries to review; no auto-insert yet** | **Existing-only, exact source binding, max 12 event/ticket changes** |

The Rausgegangen daily worker uses the standard network/detail connector, provider ticket evidence and the existing event reconciliation/persistence pipeline. It runs a **dry-run before every apply**, verifies exact Supabase project, records all review/rejected/deferred source candidates, and refuses bulk changes or ticket deletions. New event candidates with matching title/date but without the original Rausgegangen event source binding MUST NOT be written into the public catalog. It is deliberately not a generic social-media scraper.

All daily jobs share the `eternal-rave-public-supabase-cli` GitHub Actions concurrency group (one active database worker). Chromium is installed only in the Rausgegangen worker to check provider ticket evidence where needed.

The current standard source crawler covers national priority regions and processes at most 30 detail candidates in a run. **This is not complete daily national coverage**, and candidates need provider-specific validation before promotion. If the first live daily job fails, don't claim it works. Check logs, GitHub Actions artifact and `ingestion_runs`.

## Adding further sources

1. Implement an official source connector: discovery, event-specific detail, canonical source key, source URLs and safe evidence for venue, date, genres, media and ticket tiers.
2. Add connector registration and operational configuration. First run with **manual read-only preview**, no updates.
3. Prove matching against existing Supabase events, reject unknown venue/city, stale prices, generic ticket pages and ambiguous identity. Confirm source usage permissions and honor rate limits.
4. Certify a `DAILY_SOURCE_POLICIES` entry with explicit `writeScope` (`existing_only` by default), parse threshold, detail and per-day write limits.
5. Add the connector ID to `STAGING_SCHEDULED_CONNECTOR_IDS`, create its own GitHub Actions daily workflow with shared concurrency, correct fixed project ref, token secret, artifact and failure signaling.
6. Add typecheck, safety regression tests, first successful read-only run, then first deliberately bounded write run with public RLS check, fresh provider ticket check and verified live deployment.
7. Enable net-new upserts **only after** strong canonical venue/date matching and provider corroboration are proven. Incomplete information remains unknown instead of fabricating values.

No wildcard registration of new connectors: a source being added to the repository does **not** silently enable public-data writes. Disable its GitHub workflow or remove its policy entry as a kill switch.

Follow-up: Promote eligible new Rausgegangen events through a separate acceptance test suite after quality validation. The daily read-only candidate audit is the prerequisite, not authorization to publish.

## Existing-source rotation and daily coverage

The worker first reads public, published/upcoming **exact Rausgegangen event-source bindings** from Supabase, then picks up to 24 canonical HTTPS source URLs on a rotating UTC-day offset. These receive first priority among the 30 details fetched each run. Remaining detail slots are allocated to new region-listing candidates. This provides a repeatable cadence for currently listed events without assuming that the first city-page results always contain them. It does **not** guarantee 100% daily German event coverage; the full listing discovery remains source-dependent.
