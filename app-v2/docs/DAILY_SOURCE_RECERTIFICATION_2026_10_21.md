# Daily source recertification — 21 October 2026

## Observed status before release

- **Public Vercel** commit `c349d3437e4b8e405d578056bdac11daeb73daf8`, READY, matched GitHub main.
- **Public-linked Supabase** `gnkjzinwvmrxcadwebhv`: 134 events total, 54 future published, 98 ticket rows, 225 event source bindings.
- Bootshaus scheduled import on 20 October 19:45Z: 26 source details parsed; 16 potential new, eight existing safe updates, one ambiguous and one rejected. A bounded batch applied 16 operations, creating eight events (seven published and one review) and seven ticket rows. This is a DB-observed result, not a claim of a live browser e2e test.
- First Rausgegangen scheduled run on 20 October 18:07–18:59Z: dry-run of 13 exact source matches succeeded; apply did **1** update, **11** write attempts failed with SQLSTATE `23505` on `venues_pkey`. The downloaded job audit shows attempts to reinsert existing venues (Beben, Kalif Storch, etc.).
- The **post-run** GitHub main fix `38c5eb331dbc5719e03b4016eca81a156663b8f6`, merged 19:46Z, now forces a re-import of an existing source-matched event to preserve its canonical event venue ID and prevents a venue-insert plan when an existing event venue is bound. Therefore the observed failures belong to the **older** binary. The corrected binary needs a fresh real workflow run; no claim of an already successful updated run.

## This release

1. Force **one controlled Rausgegangen workflow smoke run** on merge of the workflow file itself, with logged checked-out revision and existing exact source/venue protections.
2. Run the existing **read-only cross-source probe daily** after ticket.io and public-ticket auditing. It checks 20+ public endpoints including Zakk, Stadtgarten, Nachtresidenz, Odonien, Resident Advisor, GoOut, DICE and other source families. The probe records HTTP status, event/detail signals, ticket links and source response shape; failures remain in the artifact and are not automatically published.
3. Replace a frozen August 2026 Odonien API start-date filter with today's UTC date.
4. Preserve serialization across the four daily database workers, the fixed Supabase project-ref verification, event/ticket safety thresholds and ticket.io read-only discovery.

Do NOT claim verified daily importing for newly monitored sources. Each source needs its own identity-safe connector, quality tests, idempotent database planner and a demonstrated successful real run before write enablement. Missing locations, prices, lineups or purchase URLs must remain unknown, not inferred.

## Follow-up validation

Read GitHub Actions run logs + published audit artifacts, check Rausgegangen `ingestion_runs` and source health, live count/duplicates and ticket delta after the new workflow finishes, and confirm public Vercel. One passed HTML HTTP response is not a full interactive e2e test.
