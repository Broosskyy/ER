# Daily source imports and ticket.io monitoring — public Eternal Rave

This project historically calls Supabase `gnkjzinwvmrxcadwebhv` **staging**, but the LIVE Vercel website reads it. Scheduled imports ARE public changes.

## Scheduling (all GitHub Actions, UTC)

| Connector | Workflow | Cron | Writes? |
| --- | --- | --- | --- |
| Bootshaus (with matched official ticket.io evidence) | `staging-sync-bootshaus.yml` | `17 3 * * *` | **Yes**, only if the guarded dry-run passes |
| Affenkäfig | `staging-sync-affenkaefig.yml` | `53 4 * * *` | **Yes**, only if the guarded dry-run passes |
| ticket.io Germany shop network | `ticketio-daily-source-audit.yml` | `29 6 * * *` | **No**, discovery/matching and audit artifact only |

On the public project, existing official connectors may `upsert` newly discovered eligible events. The ticket.io discovery is NOT the same as the Bootshaus-linked ticket.io shop; general ticket.io matches must not be imported automatically until all identity/quality gates are certified.

## Prerequisites

GitHub Actions **secret** `SUPABASE_ACCESS_TOKEN` must exist with access to the exact project and CLI. Never put it in Vercel public runtime variables or commit it. Jobs deliberately abort if the secret is missing. The first successful scheduled/manual run must be confirmed from Actions execution logs and `ingestion_runs`; the mere presence of a cron entry DOES NOT prove the job ran.

For Bootshaus/Affenkäfig scheduled workers only, runtime flags `ETERNAL_RAVE_ENABLE_DAILY_SYNC=true` and `ETERNAL_RAVE_PUBLIC_DB_SYNC_ACKNOWLEDGED=true` activate the known-project allowlist; their absence leaves all scheduled writes disabled.

## Safe source update workflow

1. Link only `gnkjzinwvmrxcadwebhv`; verify exact project ref/name and refuse other production refs.
2. Before any catalog mutation, run official source discovery as `dry_run`. Require at least 8 parsed events for Bootshaus or 2 for Affenkäfig, 0 failures or rejects, no parser/network anomalies, at most 8 new events and 25 updates.
3. Confirm the dry-run made **no ticket changes**.
4. Run the standard identity/reconciliation/event/ticket planners in `apply`, using same cap of 40 detail pages and only well-evidenced sources. Items needing review remain unapplied.
5. Record timestamped ingestion runs, health, ticket price/URL/status deltas. Archive audit JSON for 14 days.
6. On failure, fail the GitHub Action; **never hide error output or mutate an unknown target**.

A daily cron is not an assurance that prices never change intra-day. Only the verified event-specific provider checkout may be promoted into a price/ticket status; ticket.io list teaser prices can be out of date or cover distinct tiers. An offer without a verified event-specific target, a giveaway, or an artist/tour landing page is NOT a ticket purchase CTA.

## Safety and outstanding work

- The **global ticket.io Germany discovery** remains read-only; follow up with a dedicated controlled, idempotent automated import adapter after testing duplicate matching and city/venue correctness.
- Existing Bootshaus catalog may contain non-Bootshaus events mislabeled as Bootshaus (e.g., KitKatClub imports). Investigate before enabling broad ticket.io network imports.
- Source scripts may rely on a recent Supabase CLI version, correct secrets and network access. Observe the first actual GitHub Actions runs and confirm `ingestion_runs` changes. A pending schedule is **not** a verified completed import.
- To pause automation immediately: disable the two GitHub Actions workflows in the Actions UI or remove either runtime enabled flag; `STAGING_SCHEDULER_ENABLED` defaults false in other contexts.
