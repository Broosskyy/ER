# Source-backed consumer admission: conditional free until midnight & door-only

## Production preconditions

The live Vercel domain uses Supabase project `gnkjzinwvmrxcadwebhv`, despite the project's original staging name. Do not write until **production Vercel is READY at the tested and merged commit**.

Consumers must not confuse:
- `free_entry`: Verified whole-event free admission, existing contract requires 0 EUR and no purchase URL, may display the free badge.
- `free_until_midnight`: Free entry until 00:00 **Europe/Berlin**; **afterwards only door admission, price unknown**. Persisted ticket row uses `price_from_minor=NULL`, `ticket_url=NULL`, `currency=EUR`. Display "Bis Mitternacht frei · danach Abendkasse" with NO free/sold-out badge and NO CTA.
- `door_only`: Admission at the door, price not published. Ticket price and URL NULL, no unavailable badge or CTA.
- Unverified sales statuses remain unknown. Never infer a price, checkout URL, artist, or guarantee of available admission.

## Exact reviewed candidate list (19 October 2026)

| Event UUID | Source | Classification |
| --- | --- | --- |
| `f0036d6f-d4d6-4c5b-8745-29231e7e160b` | https://rausgegangen.de/events/basement-sessions-3/ | free_until_midnight |
| `2cc88460-0618-4d67-9705-6c5a3f6888c3` | https://rausgegangen.de/events/drift-120/ | free_until_midnight |
| `8888727c-ff44-486e-95bc-72ded236e9f7` | https://rausgegangen.de/events/technophil-3/ | free_until_midnight |
| `063feba3-400e-4270-80ae-bfb2564f4e52` | https://rausgegangen.de/events/der-gebrochene-samstag-5/ | free_until_midnight |
| `125ce3ff-5008-4989-89ba-94b1283d4108` | https://rausgegangen.de/events/nachtstrom-recharged-dj-nachtstrom-4/ | door_only |

All five have an original event-specific Rausgegangen page. The four conditional pages explicitly say free entry until midnight plus an unspecified box-office amount. Nachtstrom explicitly lists a box-office price without disclosing the amount. The source mentions "WIN TICKETS" but a prize drawing is **not** a paid ticket checkout.

This is a data model/read-model distinction: one primary non-purchasable admission-information record per event. The ticket row does not assert a zero-price product or an event-wide free pass. Production controls must reject drift in event UUID, title, UTC date, venue, city, source URL, pre-existing ticket row, and any unrelated edits.

## Post-write verification

1. Confirm 5 source IDs and full publication status by read-only Supabase SELECT.
2. Insert five records only after approved production commit is marked READY, using an atomic transaction and guard count.
3. Capture source-specific provenance (URL, observed time, evidence classification), preserve raw JSON original data.
4. Read back via privileged and `anon` contexts, verify no price/checkout URL and no impact to unrelated tickets.
5. Check deployed bundle, HTTP routes and runtime logs. HTTP 200 is not a full hydrated browser E2E test.

**Lineup note:** Do not fill unpublished weekly/program-specific lineups from generic series descriptions, organizers or guests of other event dates.
