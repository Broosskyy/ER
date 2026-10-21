# JEBROER 360 LIVE SHOW — exact-source headliner recovery

On 21 Oct 2026 the first Bootshaus importer published the 20 Nov 2026 23:00 event with *only* three support acts: Fabiasco, Hans Glock and Teknoclash. The named headline performer JEBROER was omitted. The provider-specific ticket page `https://deepblue-bootshaus.ticket.io/DZ06n7vL/` confirms the event, €21 available regular admission and a sold-out €18 early-bird tier. Source: `https://bootshaus.tv/events/201126-jebroer-360-live-show/`. Independent lineup confirmation: `https://prinz.de/events/jebroer-360-live-show/2026-11-20/`.

## Controlled public-data recovery

Exact source UUID `75d6ef60-f0ca-4c59-adc3-1fa650c47bba` and event UUID `b1af1723-3096-4a8c-b5f3-62eb704d142a` passed date, venue, title, ticket link/price/status and current lineup preconditions. An atomic guarded write added JEBROER as headliner, shifted the existing support actors down with retained UUIDs, and replaced the title-only description with a short independent event-specific summary. A provenance object was added to the existing official event-source raw payload. **No ticket price, provider link or sales status changed.** Readback confirmed four lineup names and €21 available admission, with original link.

The parser also contains a *narrow source-specific recovery* for the named JEBROER 360 show when support-only artist evidence recurs. It will not infer the title as a DJ for generic event titles. A description identical to the event title is not sufficient to overwrite a previously corrected editorial description. Regression tests cover exact known source identity and nonmatching URLs.

## Remaining live QA
New Bootshaus entries including `INURFASE MASSIVE` have source/listing discrepancies about sell-out state; no automatic sales-status promotion is justified without verifying exact checkout eligibility. Seven published new Bootshaus entries remain in live. The Amsterdam Korolova candidate stays in review. No other import sources are enabled by this targeted fix.
