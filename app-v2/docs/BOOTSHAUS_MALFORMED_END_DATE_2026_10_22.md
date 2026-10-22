# Bootshaus end-time conflict (22 Oct 2026)

Organizer reference: https://bootshaus.tv/events/blu-white-2027-karneval-meets-clubbing/

The public Bootshaus page identifies **30 Jan 2027, 18:30**, Bootshaus, Auenweg 173 Köln, and an announced lineup (Kasalla, Cat Ballou, Brings, René Pera, DJ Sayhan, DJ Hansi, Chris Nitro). It mistakenly lists an **end on 31 Dec 2026**, before the start date.

The previous official connector passed the malformed prior-year end into the ingestion candidate, marking the event as invalid. The new parser preserves the independently confirmed start/date/venue and drops ONLY an end that is impossible or fails source date parsing; `unverified_end_time_source_conflict` remains in enrichment gaps. It **never invents** an end time or price. Valid overnight end times are retained unchanged.

After this change merges, confirm the real Bootshaus daily import can ingest the exact event without generating duplicates or price/checkout links from a generic source. Check public Supabase RLS SELECT and live Vercel. No manual database rows created by this code change.
