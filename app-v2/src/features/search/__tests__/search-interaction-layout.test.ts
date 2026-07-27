import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const searchScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/search.tsx'), 'utf8');
const searchInputSource = readFileSync(
  join(process.cwd(), 'src/features/search/components/SearchInput.tsx'),
  'utf8',
);
const eventListItemSource = readFileSync(
  join(process.cwd(), 'src/components/discovery/EventListItem.tsx'),
  'utf8',
);
const eventCardSource = readFileSync(
  join(process.cwd(), 'src/components/discovery/EventCard.tsx'),
  'utf8',
);
const exploreFeedSource = readFileSync(
  join(process.cwd(), 'src/features/search/components/ExploreFeed.tsx'),
  'utf8',
);
const eventDetailSource = readFileSync(join(process.cwd(), 'app/event/[id].tsx'), 'utf8');

describe('events search interaction', () => {
  it('does not wrap the search field in a keyboard-dismiss pressable', () => {
    expect(searchScreenSource).not.toContain('TouchableWithoutFeedback');
  });

  it('wires editable SearchInput with query state and focus ref', () => {
    expect(searchScreenSource).toContain('searchInputRef');
    expect(searchScreenSource).toContain('onChangeText={setQuery}');
    expect(searchInputSource).toContain('editable');
    expect(searchInputSource).toContain('onChangeText');
    expect(searchInputSource).toContain('forwardRef');
    expect(searchInputSource).toContain('testID = \'events-search-input\'');
  });
});

describe('event list row layout zones', () => {
  it('reserves thumbnail, text, time, and favorite columns in list item', () => {
    expect(eventListItemSource).toContain('styles.timeColumn');
    expect(eventListItemSource).toContain('styles.favoriteColumn');
    expect(eventListItemSource).toContain('styles.details');
    expect(eventListItemSource).toContain('homeTonightThumbnailSize');
  });

  it('uses compact premium cards for active search results', () => {
    expect(searchScreenSource).toContain('variant="compactPremium"');
    expect(searchScreenSource).toContain('EventDiscoveryGrid');
    expect(searchScreenSource).toContain('hasDiscoverySearchQuery');
  });

  it('keeps favorite outside the main pressable content', () => {
    expect(eventListItemSource).toContain('{favoriteAction}');
    expect(eventListItemSource).not.toContain('actionsPlacement="trailing"');
  });
});

describe('featured home card favorite placement', () => {
  it('renders favorite as a sibling overlay action to avoid nested buttons', () => {
    expect(eventCardSource).toContain('featuredHome');
    expect(eventCardSource).toContain('actionsPlacement: \'overlay\'');
    expect(eventCardSource).not.toContain('favoriteOnImage');
  });
});

describe('discovery and detail presentation states', () => {
  it('keeps compact cards for non-trending exploration and includes club discovery', () => {
    expect(exploreFeedSource).toContain('variant="compactPremium"');
    expect(exploreFeedSource).toContain("t('search.explore.topClubs')");
    expect(exploreFeedSource).toContain('VenueSpotlightCard');
  });

  it('provides local report and similar-event detail affordances without a submission API', () => {
    expect(eventDetailSource).toContain("t('eventDetail.report.title')");
    expect(eventDetailSource).toContain("t('eventDetail.sections.similar')");
    expect(eventDetailSource).toContain('SimilarEventsSection');
  });
});
