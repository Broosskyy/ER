# Source-backed admission triage — 18 October 2026

This is a **review queue**, not an approved SQL mutation manifest. The event IDs were cross-checked against published staging event-source bindings on 18 October 2026. External pages may be cached; re-check on the original provider before any write.

| Event ID | Event | Published source | Observed admission | Safe next step |
| --- | --- | --- | --- | --- |
| `d581518f-7b80-476f-8183-b4269e785943` | London Groove, Mainz, 27 Nov 2026 | https://rausgegangen.de/events/london-groove-4/ | Source describes `Eintritt frei` | Verify on current event-specific source. If still free, model actual full-event free admission; **no invented ticket URL**. Lineup remains unverified. |
| `1fa49e6b-6610-41da-8292-4598ab4555e9` | Midnight Ink, Mainz, 10 Dec 2026 | https://rausgegangen.de/events/midnight-ink-techno-tattoos-1/ | Source describes `Eintritt frei` | Verify current event before marking fully free. No purchase URL required. |
| `f0036d6f-d4d6-4c5b-8745-29231e7e160b` | Basement Sessions, Mainz, 5 Dec 2026 | https://rausgegangen.de/events/basement-sessions-3/ | Door price unknown; **free before midnight only** | Record conditional admission as editorial evidence, not event-wide zero-price. Do not infer 0 EUR or a ticket link. Lineup is not fully announced. |
| `2cc88460-0618-4d67-9705-6c5a3f6888c3` | Drift, Mainz, 26 Feb 2027 | https://rausgegangen.de/events/drift-120/ | Door price unknown; **free before midnight only** | Same conditional policy; do not promote an event-wide free admission or fake lineup. |
| `deda385d-a477-474d-9b4d-fa1ac728ee65` | KYTES, Erfurt, 7 Feb 2027 | https://rausgegangen.de/events/kytes-indie-rave-tour-2026-2027-16/ | Range 34.85–42.25 EUR, Eventim CTA points to an artist/tour-level link | Require target identity verified for Kalif Storch **on that date** and a verified current regular-admission price. Do not bind a general artist page as event-specific checkout. |
| `d3f542d9-533d-40c6-9a0a-f62f70dc6a9b` | PaulWetz, Stuttgart, 13 Mar 2027 | https://rausgegangen.de/events/paulwetz-tour-2027-9/ | Source range 33.70–39.80 EUR; prior observations disputed higher prices; Eventim CTA is artist/tour-level | **Price disputed / source may be stale**. No price or link write until correct Stuttgart event checkout is independently verified. |
| `b95a2adb-1751-460b-b8cd-a8147f73c1fa` | Karotte All Night Long, Stuttgart, 14 Nov 2026 | https://ra.co/events/2534093 and https://www.fridaspier.de/event/ | Organizer venue listing and Resident Advisor detail corroborate event and Karotte all-night performance | Existing description is missing. Prepare a concise original summary with provenance, then run the normal event reconciliation planner; do not paste third-party descriptions without review. |

## Implementation

`admission-review.ts` classifies only the **event JSON-LD description and offer**. It deliberately does not scan global page text that may refer to other events. Preview output includes the result as `recovered.admissionReview`, with `autoPersistAllowed: false` unconditionally; the independent ticket persistence planner remains authoritative.

`free_until_cutoff` **takes precedence** over even a numeric zero offer. A naked offer or artist-wide tour URL is **not** an approved ticket/price update. In the consumer UI, an existing verified persisted price of 0 EUR displays as `Eintritt frei` instead of `ab 0 €`.

No database writes, no scheduler enable, no fake prices, no auto-promotion of these review notes. This file is intentionally not consumed by the DB apply executor.
