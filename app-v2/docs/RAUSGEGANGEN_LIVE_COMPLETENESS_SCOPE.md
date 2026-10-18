# Live Rausgegangen completeness scope

The previous 34-event scope is a frozen artifact, not an automatically updated list.

From `app-v2`, after linking the **staging** project with Supabase CLI:

```sh
npm run scope:rausgegangen-live
RAUSGEGANGEN_ENRICHMENT_SCOPE_PATH=../artifacts/event-enrichment-completeness/live-scope.json \
  npx tsx scripts/run-upcoming-rausgegangen-enrichment-preview.ts
```

The first command verifies the exact linked project, blocks production, runs one read-only SELECT and outputs `../artifacts/event-enrichment-completeness/live-scope.json` and `live-scope-audit.json`. It captures only currently consumer-visible published events with a Rausgegangen source, selected primary ticket state, and completeness booleans. No source payloads or user data are exported.

The second command accepts this snapshot for six hours and uses the existing live source/ticket verification pipeline to produce **read-only simulated** updates.

All gaps are *verification candidates*, never assertions that tickets are free/sold out or that no lineup exists. Never overwrite a verified ticket based on weaker evidence. This work does **not** enable a scheduler, create new events or perform database writes. CI keeps the frozen scope as a fallback; dynamic scope acquisition requires verified Supabase CLI staging access.
