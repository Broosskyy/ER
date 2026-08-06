# Future Social Navigation Contract

**Status:** Navigation and interoperability design only. Phase 4.6 does not add
Feed, Posts, Reels, Stories, social publishing, or social ranking.

## Bottom navigation

1. **Events / Home** — default first surface
2. **Social Feed** — future
3. **Create**
4. **Universal Search**
5. **Profile**

Events remain the default entry point and canonical Events remain the primary
discovery result type.

## Future Feed scopes

- `for_you`
- `following_friends`

The Feed may later contain Posts, carousels, Reels and Stories from Users,
Artists, Clubs/Venues, Organizers and Communities. Content may reference a
canonical Event or another canonical entity, but must not duplicate or mutate
the referenced record.

## Universal Search compatibility

The Search result contract reserves these entity types:

- `EVENT`
- `ARTIST`
- `VENUE`
- `ORGANIZER`
- `FESTIVAL`
- `CITY`
- `GENRE`
- `USER`
- `COMMUNITY`
- `POST`
- `REEL`

Each interactive result must provide a canonical type, canonical ID and a
validated stable route. A result without a route is informational and must not
render as a press target. Events retain first-class ranking and entity matches
may show related Events immediately below.

## Cross-feature invariants

1. Follow targets use canonical entity identity; Feed records must not create a
   second Artist/Venue/Organizer identity system.
2. Social content visibility is independent from Event publication lifecycle,
   while links to Events honor public Event eligibility.
3. Cache invalidation after Follow changes must cover profiles and future Feed
   queries.
4. Sponsored Feed content follows the placement contract and is labeled.
5. Blocking, moderation, privacy and account safety must be designed before
   social publishing ships.
6. Existing Home, Search and Profile routes remain stable when the Feed tab is
   introduced.
