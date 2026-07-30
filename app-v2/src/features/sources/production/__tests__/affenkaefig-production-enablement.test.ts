import { describe, expect, it } from 'vitest';

const DEFERRED_EXTERNAL_ID =
  'https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/';

const FALSE_POSITIVE_EXTERNAL_IDS = [
  'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/',
  'https://affenkaefig.info/event/14-jahreaffenkafig19-09-2026/',
  'https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/',
  'https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-10-10-26/',
  'https://affenkaefig.info/event/affenkaefig-xxx-capitol-xxx-hagen-17-10-2026/',
];

const ALL_EXTERNAL_IDS = [
  ...FALSE_POSITIVE_EXTERNAL_IDS,
  'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026/',
  'https://affenkaefig.info/event/affenkaefig-xxxa8xxx-02-10-2026/',
  DEFERRED_EXTERNAL_ID,
];

describe('Sprint 28.4 Affenkäfig production enablement plan', () => {
  it('defines exactly one deferred shared-event case', () => {
    expect(ALL_EXTERNAL_IDS.filter((id) => id === DEFERRED_EXTERNAL_ID)).toHaveLength(1);
  });

  it('targets seven publishable events excluding deferred shared event', () => {
    const publishTargets = ALL_EXTERNAL_IDS.filter((id) => id !== DEFERRED_EXTERNAL_ID);
    expect(publishTargets).toHaveLength(7);
    expect(publishTargets).not.toContain(DEFERRED_EXTERNAL_ID);
  });

  it('marks five known false-positive duplicate candidates', () => {
    expect(FALSE_POSITIVE_EXTERNAL_IDS).toHaveLength(5);
    expect(FALSE_POSITIVE_EXTERNAL_IDS).not.toContain(DEFERRED_EXTERNAL_ID);
  });
});
