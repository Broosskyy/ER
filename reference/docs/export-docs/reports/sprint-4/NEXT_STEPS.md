# Sprint 4 — Next Steps (Sprint 5)

## P0 — Discovery & Home Feed (Sprint 5 primary)

- Public event feed using `EventRepository.findMany({ status: 'published' })`
- Home screen wiring (no new designs — use mockups/Band 2)
- Pagination UI for feed and organizer lists

## P1 — Platform hardening

- Migrate remaining `useEventStore` organizer paths to services
- ESLint + React Native testing library setup
- Event domain unit tests (validation, lifecycle, mapper)
- Real event statistics (views, saves) when analytics schema exists

## P1 — Admin platform expansion

- Full admin dashboard (beyond review queue)
- Bulk moderation actions
- Import pipeline UI activation (Band 4.5)

## P2 — Deferred (explicitly out of scope)

| Feature | Target |
|---------|--------|
| Discovery search & filters | Sprint 5+ |
| Maps integration | Later |
| KI / RSS / Crawler automation | Band 4.5+ |
| Google / Apple OAuth | Sprint 6+ |
| Push notifications | Later |
| Payments | Later |
| Chat / Social | Later |
