# Admission staging recovery — public site shares staging Supabase

Evidence review: 18 Oct 2026. **Production Vercel uses project `gnkjzinwvmrxcadwebhv`**; any change to this project's data is public-facing. Guard every operation.

| Event UUID | Venue and date | Source | Source evidence | Action |
| --- | --- | --- | --- | --- |
| `d581518f-7b80-476f-8183-b4269e785943` | London Groove, Schick Mainz, 27 Nov | https://rausgegangen.de/events/london-groove-4/ | Eintritt frei | After exact source/event verification, add a no-link 0 EUR `free_entry` ticket |
| `1fa49e6b-6610-41da-8292-4598ab4555e9` | Midnight Ink, Schick Mainz, 10 Dec | https://rausgegangen.de/events/midnight-ink-techno-tattoos-1/ | Eintritt frei | After exact verification, add a no-link 0 EUR `free_entry` ticket |
| `f0036d6f-d4d6-4c5b-8745-29231e7e160b` | Basement Sessions, Beben Mainz, 5 Dec | https://rausgegangen.de/events/basement-sessions-3/ | Free until midnight; door price unknown | NEVER insert an event-wide free ticket |
| `2cc88460-0618-4d67-9705-6c5a3f6888c3` | Drift, Beben Mainz, 26 Feb | https://rausgegangen.de/events/drift-120/ | Free until midnight; door price unknown | NEVER insert an event-wide free ticket |

## Source-of-truth hazard
Earlier ingestion stored `raw_payload.ticketEvidence.priceMinor=0` for **all four** events, even when source admission is conditional. This field is not a verified, full-event ticket price. Conditional-event raw payload must be corrected with explicit `admissionEvidence.kind=free_until_cutoff`, **not** converted into public zero-price tickets.

## Guarded apply checklist
1. CI, Vercel preview and production app serving matching reviewed `main` commit. The app should know status `free_entry` (0 EUR, no ticket URL).
2. Verify UUID, source UUID, URL, title, startsAt, and that ticket rows are absent. Abort transaction on any mismatch.
3. Only 2 wholly-free events get `event_tickets` rows with `provider=rausgegangen`, `price_from_minor=0`, `currency=EUR`, `sales_status=free_entry`, `ticket_url=NULL`, `sort_order=0`.
4. Add exact source-provenance evidence and timestamp for all four; for conditional events, clear misleading raw-ticket zero and keep the unknown door price null.
5. Read back tickets and source provenance using SQL, also simulate the anonymous role's SELECT permissions; live HTTP and browser verification. Never conflate successful HTTP with actual browser interactions.
6. No cron/scheduler changes, unrelated ticket writes, or migrations.

A 0 EUR hint alone never grants DB write permission. The protected recovery is a **manual** process, not a scheduled ingestion rule.
