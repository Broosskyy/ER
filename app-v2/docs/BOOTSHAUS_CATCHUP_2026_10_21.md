# Bootshaus catch-up run — 21 October 2026

The public Bootshaus calendar (https://bootshaus.tv/events/) lists additional events missing from the published Eternal Rave catalog after the 20 October initial safe batch of eight. Examples include Unreal Weekender Night I (6 Nov), NEELIX (27 Nov), BLACKLIST THE RESISTANCE (11 Dec), and Wonderful Days (14 Nov); other entries require source/venue screening (e.g. Amsterdam).

The standard Bootshaus ingestion worker already has an exact Supabase public-serving target guard, preflight, source URL/identity allowlist, at most **8 new event rows** per run, maximum 25 safe updates, ticket evidence checks and an audit artifact. This workflow-only comment change triggers the existing limited `push` path after merging to `main`, to process the next source batch. It does not change the import policy or authorize a particular event by title alone.

## Acceptance
1. GitHub CI successful; no source-policy change.
2. The first-run Github Action must begin at current merged `main`; do not infer success from a cron configuration.
3. Read back `ingestion_runs`, event/source records and tickets. Verify no duplicate public event insertions, no invalid venue, no ungrounded artist billing, no false zero-price/free entry, and no guessed checkout URLs.
4. The shared public Supabase concurrency group must serialize it with the active Rausgegangen and ticket.io workers. This may defer the test until the previous worker finishes; **do not cancel a valid running worker**.
5. Review/rejected/deferred candidates remain in audit output and are not auto-published. Claims about ticket prices require provider-specific evidence.

The newly corrected JEBROER artist metadata is in live Supabase already; companion PR #101 adds a parser guard and should be merged before treating the source refresh as persistent fix.
