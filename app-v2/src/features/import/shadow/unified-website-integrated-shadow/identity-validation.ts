import type { IntegratedShadowEventRecord } from './collector';

export type IdentityCollision = {
  type: 'duplicate_url' | 'title_date_collision' | 'cross_event_venue' | 'unexplained_collision';
  detailUrl: string;
  conflictingDetailUrl?: string;
  message: string;
};

export type IdentityValidationResult = {
  valid: boolean;
  eventsChecked: number;
  collisions: IdentityCollision[];
};

function normalizeTitle(title: string | undefined): string {
  return (title ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function validateIntegratedShadowIdentities(
  events: IntegratedShadowEventRecord[],
): IdentityValidationResult {
  const collisions: IdentityCollision[] = [];
  const byUrl = new Map<string, IntegratedShadowEventRecord>();
  const byTitleDate = new Map<string, IntegratedShadowEventRecord>();

  for (const event of events) {
    const urlKey = event.detailUrl.replace(/\/$/, '').toLowerCase();
    if (byUrl.has(urlKey)) {
      collisions.push({
        type: 'duplicate_url',
        detailUrl: event.detailUrl,
        conflictingDetailUrl: byUrl.get(urlKey)?.detailUrl,
        message: `Duplicate detail URL identity: ${event.detailUrl}`,
      });
    }
    byUrl.set(urlKey, event);

    const legacy = event.legacyEvent;
    const titleKey = `${normalizeTitle(legacy?.title)}|${legacy?.rawStartDate ?? ''}|${legacy?.rawVenue ?? ''}`;
    if (titleKey !== '||' && byTitleDate.has(titleKey)) {
      const other = byTitleDate.get(titleKey);
      if (other?.detailUrl !== event.detailUrl) {
        collisions.push({
          type: 'title_date_collision',
          detailUrl: event.detailUrl,
          conflictingDetailUrl: other?.detailUrl,
          message: `Same title/date/venue on different URLs: ${event.detailUrl} vs ${other?.detailUrl}`,
        });
      }
    }
    if (titleKey !== '||') {
      byTitleDate.set(titleKey, event);
    }
  }

  const sommerfestBootshaus = events.find((e) =>
    e.detailUrl.includes('bootshaus-sommerfest'),
  );
  const sommerfestAffenkaefig = events.find((e) =>
    e.detailUrl.includes('sommerfest-elektrokueche'),
  );
  if (
    sommerfestBootshaus &&
    sommerfestAffenkaefig &&
    normalizeTitle(sommerfestBootshaus.legacyTitle).includes('sommerfest') &&
    normalizeTitle(sommerfestAffenkaefig.legacyTitle).includes('sommerfest')
  ) {
    if (sommerfestBootshaus.detailUrl === sommerfestAffenkaefig.detailUrl) {
      collisions.push({
        type: 'unexplained_collision',
        detailUrl: sommerfestBootshaus.detailUrl,
        conflictingDetailUrl: sommerfestAffenkaefig.detailUrl,
        message: 'Bootshaus Sommerfest must not collide with Sommerfest Elektroküche',
      });
    }
  }

  return {
    valid: collisions.length === 0,
    eventsChecked: events.length,
    collisions,
  };
}
