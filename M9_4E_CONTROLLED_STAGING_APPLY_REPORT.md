# M9.4E — Controlled Staging Apply Report

Date: 2026-10-08  
Target: Eternal Rave staging `gnkjzinwvmrxcadwebhv`  
Preview source: M9.4E 100-event scale validation  
Preview run: `37689103227`  
Preview head: `e064d081b62a8a17b042a2273e88b9ee603d808e`

## Result

Status: **M9_4E_CONTROLLED_STAGING_APPLY_VERIFIED**

The final frozen 38-event cohort was applied to Eternal Rave staging after explicit user authorization.

The first GitHub Actions apply attempt did not reach Supabase because the repository has no `SUPABASE_ACCESS_TOKEN` secret configured. That attempt therefore performed **zero database writes**.

The authorized fallback was executed through the already-authenticated Supabase connection as one atomic PostgreSQL transaction with hard baseline, identity, duplicate, venue and post-write guards.

## Database delta

| Table | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `events` | 84 | 122 | +38 |
| `venues` | 51 | 76 | +25 |
| `event_sources` | 133 | 171 | +38 |
| `event_genres` | 138 | 204 | +66 |
| `event_lineup` | 201 | 201 | 0 |
| `event_tickets` | 47 | 47 | 0 |
| `ingestion_runs` | 209 | 209 | 0 |

## Venue reconciliation

The cohort referenced 29 distinct venue name/city pairs.

Four exact existing venues were reused:

- Kalif Storch — Erfurt
- Odonien — Köln
- Fusion Club — Münster
- Fridas Pier — Stuttgart

Twenty-five missing venue identities were created once each.

Ambiguous exact venue matches were a hard transaction failure condition.

## Event/source readback

Post-commit verification:

- 38 / 38 source bindings present
- 38 unique source URLs
- 38 unique canonical event IDs
- 38 / 38 events published
- 38 / 38 HTTPS event images
- 38 / 38 official URLs equal the verified Rausgegangen source URL
- 38 / 38 venue mappings present
- 0 hard duplicate title + ±6h pairs
- 0 bad connector/sourceEventKey records

## Genre integrity

- 66 event genre rows written
- 0 genre-count mismatches against the frozen source evidence
- only canonical evidence-backed genre keys from the M9.4E eligibility result were promoted

The M9.4E genre-provenance fixes remain authoritative: generic city/category/source tags are not publication genres.

## Description and lineup policy

No descriptions were promoted by the direct fallback because the one-off payload intentionally contained only fields already frozen for safe canonical publication.

No lineup rows were promoted.

Two source-side title hints (`NEBULA` and `SMAG`) remain in source raw evidence only because they were not strong enough to safely assert as artist billing.

This is intentionally conservative and avoids inventing or misclassifying lineup data.

## Ticket policy

No `event_tickets` consumer rows were written.

The 38 source payloads retain ticket evidence, including:

- 25 source candidates with ticket URLs
- observed price evidence when available
- source availability state

Every source payload explicitly records `consumerTicketPersisted: false`.

Ticket targets must go through the normal verified ticket persistence path before becoming consumer ticket rows.

## Atomic safety boundary

The successful transaction enforced all of the following before commit:

- exact pre-apply database baseline
- exactly 38 frozen input identities
- all source URLs are Rausgegangen event URLs
- all 38 have title, future start time, venue, city, HTTPS image and at least one canonical genre
- no existing source URL binding
- no existing sourceEventKey binding
- no exact normalized title + ±6h event match
- no hard duplicate inside the frozen cohort
- no ambiguous exact venue identity
- exact expected post-write row counts
- exact 38-source / 38-event readback
- no ticket consumer writes
- no lineup writes
- no scheduler changes
- no production configuration or production access

Any failed guard would have rolled back the whole transaction.

## Repository execution cleanup

A guarded GitHub Actions apply path was prepared first, but GitHub had no `SUPABASE_ACCESS_TOKEN` secret and correctly stopped before database access.

The one-off write workflow and executor were removed from the final branch after the successful Supabase-connected apply. The immutable 38-identity manifest remains as the cohort audit record.

## STOP boundary

Still disabled / not authorized:

- Rausgegangen scheduler
- Bootshaus cron
- Affenkäfig cron
- production writes
- bulk import of the remaining Rausgegangen pool

Recommended next step: consumer/UI QA of the newly inserted staging events, followed by a separate verified ticket-enrichment pass.
