/**
 * Seven manually confirmed reference events — used only in tests and acceptance audit.
 * No production event-ID branches.
 */
export const BULK_REBUILD_ACCEPTANCE_FIXTURES = [
  {
    key: 'LEVI',
    eventId: 'evt-1785339383539-0lxvjlp',
    titleFragment: 'LEVI',
  },
  {
    key: 'BC173',
    eventId: 'evt-1785339410908-9691748',
    titleFragment: 'BC173',
  },
  {
    key: 'R3HAB',
    eventId: 'evt-1785339421539-k3swcrl',
    titleFragment: 'R3HAB',
  },
  {
    key: 'BOOTSHAUS_SOMMERFEST',
    eventId: 'evt-1785339391167-tfaixrr',
    titleFragment: 'Bootshaus Sommerfest',
  },
  {
    key: 'UNDERLAND',
    eventId: 'evt-1785389049895-4mb7dub',
    titleFragment: 'Underland',
  },
  {
    key: 'SOMMERFEST_ELEKTROKUECHE',
    eventId: 'evt-1785389055557-ux20897',
    titleFragment: 'Sommerfest Elektroküche',
  },
  {
    key: 'MDMA',
    eventId: 'evt-1785389052337-0gv1iz1',
    titleFragment: 'MDMA',
  },
] as const;

export type BulkAcceptanceFixtureKey = (typeof BULK_REBUILD_ACCEPTANCE_FIXTURES)[number]['key'];

export function acceptanceFixtureEventIds(): string[] {
  return BULK_REBUILD_ACCEPTANCE_FIXTURES.map((fixture) => fixture.eventId);
}
