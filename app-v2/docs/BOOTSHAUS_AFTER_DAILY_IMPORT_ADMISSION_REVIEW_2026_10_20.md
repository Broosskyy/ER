# Bootshaus daily source sync — verified admission recovery (20 October 2026)

The completed 20 October Bootshaus GitHub Actions job inserted **8** new events; 7 of these are published future events. All initially lacked ticket rows because the verified ticket-specific provider pipeline returned identity-unverifiable evidence, not because a random provider price should be guessed.

Two independently corroborated official organizer statements may safely be modeled:

* `fb6ed4a7-1eb5-4019-9baf-48c1209915b1` — **EARLY ACCESS pres. DYZEN**, Friday 30 October 2026, 20:00–02:30 at Bootshaus Köln. Official event-specific source: https://bootshaus.tv/events/301026-early-access-pres-dyzen/. Official page says **entry is free, but advance registration with a Free Ticket is mandatory**. Record `sales_status=registration_only`, `price_from_minor=0`, `currency=EUR`, `ticket_url=NULL`; do NOT imply that people can just walk in or that a generic Bootshaus ticket shop is the checkout.
* `4a654394-703c-4285-abcb-d0c50719be9b` — **INURFASE MASSIVE: THROUGH THE LOOKING GLASS**, Friday 18 December 2026 at Bootshaus Köln. The official Bootshaus events index https://bootshaus.tv/events/ explicitly labels **Sold Out**. Record `sales_status=sold_out`, `price_from_minor=NULL`, `currency=EUR`, `ticket_url=NULL`; do NOT invent a price, ticket shop or resale offer.

Both entries need exact UUID/title/venue/city/date/source validation, source-provenance with a review timestamp, no pre-existing ticket row, and an atomic transaction that fails if either record changes. Apply ONLY AFTER the tested consumer UI commit is READY in production. Read back with `anon` role and verify deployed HTTP routes. These are source-informed status rows, NOT evidence of a verified ticket checkout. Any future automated re-pricing still has to pass the event-specific ticket identity pipeline.

Other newly imported Bootshaus events still have **no provider-verifiable price/link**. The one Amsterdam event has `status=review` and must stay unpublished until venue/geo/genre qualification is resolved. Do not fill uncertain prices, lineups or artist tour URLs.

The Rausgegangen existing-only daily run on 20 Oct reported 11 failed processing attempts during apply; it still preserved the no-unsafe-ticket persistence rules and produced a review artifact. Diagnose independently. Never silently ignore genuine ingestion failures merely to mark an Action green.
