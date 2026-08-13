import { describe, expect, it } from 'vitest';

import { mapRawWebsiteEventToImportedEvent } from '@/features/aggregation/connectors/website/mapper';
import type { RawWebsiteEvent } from '@/features/aggregation/connectors/website/types';

describe('bootshaus source pack connector wiring', () => {
  it('passes official detail html from connector events into import metadata', () => {
    const event: RawWebsiteEvent = {
      sourceUrl: 'https://bootshaus.tv/events/example',
      externalId: 'https://bootshaus.tv/events/example',
      title: 'Example Event',
      rawStartDate: '2026-08-21T22:00:00',
      rawDescription: 'Editorial intro',
      extractionStrategy: 'html_selector',
      extractionConfidence: 0.9,
      fieldEvidence: [],
      warnings: [],
      officialDetailHtml: '<div class="event-description-content"><p>MAINFLOOR:</p><p>ARTIST A</p></div>',
    };

    const imported = mapRawWebsiteEventToImportedEvent(event, 'club_website');
    expect(imported?.sourceMetadata?.officialDetailHtml).toContain('event-description-content');
  });
});
