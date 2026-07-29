# Phase 2E Report — Profile UI & Follow Wiring

## Verification

| Check | Result |
|-------|--------|
| Typecheck | ✅ grün |
| Tests | ✅ **857** bestanden (169 Dateien) |
| Lint | ✅ 0 Errors (1058 Warnings) |
| Migration erstellt | ❌ nein |

## Implementiert

### Profile Screens
- `/organizer/[id]`, `/venue/[id]`, `/artist/[id]` — `PublicEntityProfileScreen`
- ProfileHeader, FollowButton, event buckets (Happening Now / Upcoming / Past)
- Loading skeletons, not-found, retry on error

### Event Detail
- FK-basierte Organizer/Venue/Artist-Auflösung via `loadEventDetailEntities`
- Profilnavigation nur bei `profileNavigable: true`
- Organizer Follow auf Event Detail
- Lineup dedupliziert nach `artistId`

### Follow
- `useEntityFollow` Hook
- `FollowService` mit AsyncStorage-Persistenz + Canonical-ID-Auflösung
- Bootstrap hydrates follows
- Domain events `entity_followed` / `entity_unfollowed`

### Services
- `canonical-entity-id-resolver.ts`
- `entity-profile-loader.ts`
- `entity-profile-events-filter.ts`
- `profile-view-models.ts`

### Tests
- `phase-2e-profile-ui-integration.test.ts` (10 cases)

## Abnahmekriterien

| Kriterium | Status |
|-----------|--------|
| Organizer Profile FK-Events | ✅ |
| Venue Profile FK-Events | ✅ (+ Legacy-Name-Fallback) |
| Artist Profile FK-Auftritte | ✅ |
| Event Detail Profile Links | ✅ |
| Keine Links ohne ID | ✅ |
| FollowButton → FollowService | ✅ |
| Follow persistent | ✅ |
| Canonical IDs | ✅ |
| Alias keine Follow-Duplikate | ✅ |
| Upcoming/Happening/Past | ✅ |
| Loading/Error/Empty | ✅ |

## QA Screenshots

`npm run qa:capture` nicht vorhanden. Keine automatischen Screenshots erzeugt.

Manuell empfohlen (Expo Web):

- `organizer-profile-desktop-light.png`
- `organizer-profile-mobile-light.png`
- `venue-profile-mobile-light.png`
- `artist-profile-mobile-light.png`
- `event-detail-profile-links-mobile-light.png`
- `followed-profile-mobile-light.png`

## Bewusst nicht implementiert

- Produktivquelle / Scheduler / Social Import
- Push Notifications
- Globale Entity-Suche
- Server-seitige Follow-Sync / Follower-Zähler
- Genre-Labels auf Artist-Profil aus `genreRepository`

## Verbleibende Blocker

- Organizer/Venue `verificationStatus` in DB/Records fehlt → UI zeigt `unverified`
- Profile-Events in Supabase-Modus benötigen veröffentlichte Events mit FKs in DB
- Contributor `/profile/organizer` bleibt getrennt vom öffentlichen Organizer-Profil

## Nächste empfohlene Phase

**Phase 2F** (oder Produktivquellen-Vorbereitung): erste kontrollierte Produktivquelle mit echten Organizer/Venue/Artist-FKs in Supabase, gefolgt von Scheduler-Integration — erst nach expliziter Freigabe.
