# Bootshaus importer — venue country and adjacent lineup artist parsing

Production-linked Supabase project: `gnkjzinwvmrxcadwebhv`.

On 21 Oct 2026, the daily Bootshaus import successfully created 16 new event entries, but a verified source-specific review identified two parser issues:
- **Sub Zero Project – Amsterdam (NL)** at Koepelkerk was erroneously stored as city NULL/country DE because `1012 Amsterdam` is a Dutch four-digit postal prefix, not a German five-digit postal code.
- **Unreal Weekender Night I** merged separate acts into `DJ HYPERDRIVEEMILIJA` because adjacent div tags had no newline separators.

Five active, separately source-verified ticket.io ticket offers were recovered with their currently available entry phases; historical sold-out tiers, parking, lockers, insurance and VIP packages are never the advertised basic entry price. One Hardwick show had an event-specific shop but advance sale was not yet open, so its status is `sale_not_started` with NULL current price and no purchase CTA.

The two problematic public records were manually corrected under exact source UUID, title, date/venue and absence-of-ticket guards. This PR addresses the future importer root cause:
- Detect 4-digit Dutch postcodes as Amsterdam/NL where the source address identifies it; do not default foreign/unknown location to DE.
- Keep consecutive HTML artist nodes separated rather than concatenating act names.
- A new official event without city requires a review, never an immediate public publish.

These checks are intentionally **not** automatic ticket.io discovery of national events. New sources still require independently vetted event identity, city and ticket purchase target.
