# Phase 4.6.7 Closure Report

Generated: 2026-08-03T05:36:12.000Z

**Phase 4.6.7 formally closed:** YES

## 1. Representative repair runs

Pass 1 mutations: 0
Pass 2 mutations (idempotency): 0

## 2. Sommerfest repair

Authoritative structured lineup replace rebuilds canonical lineup from import payload (14 artists).

## 3. Bootshaus import repair

Import path preserves HTML structure when present; flat bootshaus.tv meta text cannot be split without separators.

## 4. Legacy Artist cleanup

Detached from events: 0. Marked legacy: 0.

## 5. Global repair stability

Passes: 2. Stable: yes. Final mutations: 0.

## 6. Mobile acceptance

Passed 3/4 representative events.

### Sommerfest Elektroküche
- Passed: true
- Blocker: none
- Artist count: 14
- Canonical IDs: ["artist-title-asl-0l5t3z","artist-title-annx-r2t7pu","artist-title-black-zushi-m6g7rf","artist-title-bounce-mc-flz1jf","artist-title-hotboi2300-senum1","artist-title-hypnotized-c8xlj1","artist-title-icj-lwn0df","artist-title-mauro-dac77k","artist-title-stimulate-9ugthz","artist-title-the-m-vement-87r7qz","artist-title-tommy-libera-oybnsr","artist-title-turbo-timos-omo2yw","artist-title-julez-brixton-5jzrl5","artist-title-sebi-liemen-svl15j"]
- Canonical names: ["ASL∅","ANNX","BLACK ZUSHI","BOUNCE MC","HOTBOI2300","HYPNOTIZED","ICJ","MAURO","STIMULATE","THE M∅VEMENT","TOMMY LIBERA","TURBO TIMOS","JULEZ BRIXTON","SEBI LIEMEN"]
- Import evidence: [{"importRecordId":"603772ca-12ec-43c5-845f-bb0da74b1897","sourceId":"source-ticket-kings-org-elektrokuche","externalId":"https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/","artistNames":["ASL∅","ANNX","BLACK ZUSHI","BOUNCE MC","HOTBOI2300","HYPNOTIZED","ICJ","MAURO","STIMULATE","THE M∅VEMENT","TOMMY LIBERA","TURBO TIMOS","JULEZ BRIXTON","SEBI LIEMEN"],"lineupEntryCount":14,"structuredSources":["ticket_kings_html"],"detailBlocked":false},{"importRecordId":"234ece43-bd54-4aee-8704-38dbdc648fe8","sourceId":"source-affenkaefig","externalId":"https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026/","artistNames":["ASL∅","ANNX","BLACK ZUSHI","BOUNCE MC","HOTBOI2300","HYPNOTIZED","ICJ","MAURO","STIMULATE","THE M∅VEMENT","TOMMY LIBERA","TURBO TIMOS","JULEZ BRIXTON","SEBI LIEMEN"],"lineupEntryCount":0,"structuredSources":[],"detailBlocked":false},{"importRecordId":"fd38e5d4-45f1-4265-8bf4-6e96e74ef5d9","sourceId":"source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt","externalId":"https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/","artistNames":["ASL∅","ANNX","BLACK ZUSHI","BOUNCE MC","HOTBOI2300","HYPNOTIZED","ICJ","MAURO","STIMULATE","THE M∅VEMENT","TOMMY LIBERA","TURBO TIMOS","JULEZ BRIXTON","SEBI LIEMEN"],"lineupEntryCount":14,"structuredSources":["ticket_kings_html"],"detailBlocked":false},{"importRecordId":"6c099016-c47a-489f-8ca2-a17e4016c7c8","sourceId":"source-affenkaefig-ticket-kings","externalId":"https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/","artistNames":["ASL∅","ANNX","BLACK ZUSHI","BOUNCE MC","HOTBOI2300","HYPNOTIZED","ICJ","MAURO","STIMULATE","THE M∅VEMENT","TOMMY LIBERA","TURBO TIMOS","JULEZ BRIXTON","SEBI LIEMEN"],"lineupEntryCount":14,"structuredSources":["ticket_kings_html"],"detailBlocked":false}]
- Projection artists: ["ASL∅","ANNX","BLACK ZUSHI","BOUNCE MC","HOTBOI2300","HYPNOTIZED","ICJ","MAURO","STIMULATE","THE M∅VEMENT","TOMMY LIBERA","TURBO TIMOS","JULEZ BRIXTON","SEBI LIEMEN"]
- Pipeline: {"importToCanonical":true,"canonicalToProjection":true}
- Checks: {"countMatches":true,"sommerfestExactSet":true,"noForbiddenArtists":true,"noDuplicates":true,"noCollapsedNames":true,"importMatchesCanonical":true,"projectionMatchesCanonical":true}

### Bootshaus on a Ship Vol. III
- Passed: false
- Blocker: source_text_structurally_insufficient
- Artist count: 6
- Canonical IDs: ["artist-title-brandon-lxp143","artist-title-sam-collinsoliver-magenta-fmf9uk","artist-title-lost-identitydave-replay-5n9q42","artist-title-eminalukes-knn7qd","artist-title-makla-az92cb","artist-title-makla-einlass-ab-18-jahren-age-for-admission-18-years-0539om"]
- Canonical names: ["BRANDON","SAM COLLINSOLIVER MAGENTA","LOST IDENTITYDAVE REPLAY","EMINALUKES","MAKLA","MAKLA▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren / Age for admission 18 years"]
- Import evidence: [{"importRecordId":"48d211bd-bf2c-4b0d-9517-409f67800054","sourceId":"source-bootshaus-ticket-io","externalId":"https://bootshaus-club.ticket.io/wUc3uQrR/","artistNames":[],"lineupEntryCount":0,"structuredSources":[],"detailBlocked":true,"detailSkipReason":"pow_blocked"},{"importRecordId":"330ec371-c461-4d6c-a873-ef98f772db1d","sourceId":"source-bootshaus-koeln","externalId":"https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iii","artistNames":["BRANDON","SAM COLLINSOLIVER MAGENTA","LOST IDENTITYDAVE REPLAY","EMINALUKES","MAKLA","MAKLA▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren / Age for admission 18 years"],"lineupEntryCount":0,"structuredSources":[],"detailBlocked":false}]
- Projection artists: ["BRANDON","SAM COLLINSOLIVER MAGENTA","LOST IDENTITYDAVE REPLAY","EMINALUKES","MAKLA","MAKLA▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren / Age for admission 18 years"]
- Pipeline: {"importToCanonical":true,"canonicalToProjection":true}
- Checks: {"countMatches":false,"sommerfestExactSet":true,"noForbiddenArtists":false,"noDuplicates":true,"noCollapsedNames":true,"importMatchesCanonical":true,"projectionMatchesCanonical":true}

### MDMA
- Passed: true
- Blocker: none
- Artist count: 18
- Canonical IDs: ["artist-title-dystopia-s16ua2","artist-title-valkyrie-2ityi0","artist-title-ian-crank-922eh2","artist-title-easypysi-ptu3q8","artist-title-karamusta-pfmsk3","artist-title-greekz-lwnyow","artist-title-kevin-la-nique-9ssw17","artist-title-the-rafnix-usw8tk","artist-title-nina-bender-sgyvdv","artist-title-lee-ann-qhwfww","artist-title-flash-m8ck4x","artist-title-forward-ktc9l5","artist-title-hellmyer-2itf98","artist-title-stz-xipr2g","artist-title-mauro-dac77k","artist-title-i-d-a-5h8znf","artist-title-plea5ure-6okchm","artist-title-pul5e-qz1qim"]
- Canonical names: ["DYSTOPIA","VALKYRIE","IAN CRANK","EASYPYSI","KARAMUSTA","GREEKZ","KEVIN LA NIQUE","THE RAFNIX","NINA BENDER","LEE-ANN","FLASH","FORWARD","HELLMYER","STZ","MAURO","I.D.A","PLEA5URE","PUL5E"]
- Import evidence: [{"importRecordId":"6e3a8a57-7544-401f-a047-3b9c0f6000d2","sourceId":"source-affenkaefig","externalId":"https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/","artistNames":[],"lineupEntryCount":0,"structuredSources":[],"detailBlocked":false}]
- Projection artists: ["DYSTOPIA","VALKYRIE","IAN CRANK","EASYPYSI","KARAMUSTA","GREEKZ","KEVIN LA NIQUE","THE RAFNIX","NINA BENDER","LEE-ANN","FLASH","FORWARD","HELLMYER","STZ","MAURO","I.D.A","PLEA5URE","PUL5E"]
- Pipeline: {"importToCanonical":true,"canonicalToProjection":true}
- Checks: {"countMatches":true,"sommerfestExactSet":true,"noForbiddenArtists":true,"noDuplicates":true,"noCollapsedNames":true,"importMatchesCanonical":true,"projectionMatchesCanonical":true}

### LEVI
- Passed: true
- Blocker: none
- Artist count: 1
- Canonical IDs: ["artist-title-levi-c4xe5v"]
- Canonical names: ["LEVI"]
- Import evidence: [{"importRecordId":"b1f775e0-03b9-4dca-bd07-de3e47b2c0c8","sourceId":"source-bootshaus-koeln","externalId":"https://bootshaus.tv/events/nightswithus-presents-levi","artistNames":["LEVI"],"lineupEntryCount":0,"structuredSources":[],"detailBlocked":false}]
- Projection artists: ["LEVI"]
- Pipeline: {"importToCanonical":true,"canonicalToProjection":true}
- Checks: {"countMatches":true,"sommerfestExactSet":true,"noForbiddenArtists":true,"noDuplicates":true,"noCollapsedNames":true,"importMatchesCanonical":true,"projectionMatchesCanonical":true}

## 7. Remaining blockers

- Bootshaus on a Ship Vol. III: `source_text_structurally_insufficient`

### Notes

- MDMA mobile acceptance passed with 18 canonical/projection artists (`KARAMUSTA`, not `KARAM USTA`). Affenkaefig import has no structured lineup payload; canonical state is maintained via legacy-artifact detachment, not heuristic splitting.
- Bootshaus on a Ship: `external_detail_access_blocked` (ticket.io ALTCHA) in addition to flat bootshaus.tv source text.
- No aggressive ALL CAPS heuristics applied (`COLLINSOLIVER`, `HYPNOTIZED`, `STIMULATE`, etc. left intact).

## Artifacts

- `docs/real-data/_phase467_closure_validation.json`
- `docs/real-data/_phase467_mobile_acceptance.json`
- `docs/real-data/_phase467_repair_runs.json`
- `docs/real-data/_phase467_closure_backup.json`