import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const eventDetailSource = readFileSync(join(process.cwd(), 'app/event/[id].tsx'), 'utf8');
const exploreFeedSource = readFileSync(
  join(process.cwd(), 'src/features/search/components/ExploreFeed.tsx'),
  'utf8',
);
const searchSource = readFileSync(join(process.cwd(), 'app/(tabs)/search.tsx'), 'utf8');
const eventCardSource = readFileSync(
  join(process.cwd(), 'src/components/discovery/EventCard.tsx'),
  'utf8',
);

describe('events and event detail restoration', () => {
  it('uses phase 2F event detail components on the live route', () => {
    expect(eventDetailSource).toContain('EventHero');
    expect(eventDetailSource).toContain('EventTicketSection');
    expect(eventDetailSource).toContain('VenueDetailCard');
    expect(eventDetailSource).toContain('OrganizerDetailCard');
    expect(eventDetailSource).toContain('EventNoticeBanner');
    expect(eventDetailSource).not.toContain('EventDetailHero');
    expect(eventDetailSource).not.toContain('BottomTicketCTA');
  });

  it('uses compactPremium for explore lists and featured rail variants for trending', () => {
    expect(exploreFeedSource).toContain('compactPremium');
    expect(exploreFeedSource).toContain('featuredRail');
    expect(exploreFeedSource).not.toContain('ExplorePosterGrid');
  });

  it('uses compactPremium for active search results', () => {
    expect(searchSource).toContain('variant="compactPremium"');
    expect(searchSource).toContain('DiscoveryGridMapToggle');
    expect(searchSource).toContain('EventDiscoveryGrid');
  });

  it('renders status badges on compact premium cards', () => {
    expect(eventCardSource).toContain('EventStatusBadge');
    expect(eventCardSource).toContain('TicketStatusBadge');
  });

  it('localises event detail via i18n keys', () => {
    expect(eventDetailSource).toContain("t('eventDetail.");
    expect(eventDetailSource).not.toContain('Date & time');
    expect(eventDetailSource).not.toContain('About');
  });
});
