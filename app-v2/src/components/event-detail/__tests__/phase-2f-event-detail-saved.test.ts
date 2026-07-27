import { describe, expect, it } from 'vitest';

import {
  resolveEventNoticeTitle,
  resolveEventNoticeVariant,
} from '@/components/event-detail/event-detail-styles';
import type {
  EventHeroViewModel,
  EventInfoViewModel,
  EventNoticeViewModel,
  EventTicketSectionViewModel,
  LineupSectionViewModel,
} from '@/components/event-detail/view-models';
import { resolveSavedEmptyCopy } from '@/components/saved/saved-styles';
import type { SavedEventViewModel } from '@/components/saved/view-models';

describe('Phase 2F event detail display contracts', () => {
  it('resolves event notice variants and German titles', () => {
    expect(resolveEventNoticeVariant('cancelled')).toBe('error');
    expect(resolveEventNoticeVariant('postponed')).toBe('warning');
    expect(resolveEventNoticeVariant('age_restriction')).toBe('info');
    expect(resolveEventNoticeTitle('venue_changed')).toBe('Venue geändert');
    expect(resolveEventNoticeTitle('sold_out')).toBe('Ausverkauft');
  });

  it('keeps hero, info, lineup, ticket, and notice models presentation-only', () => {
    const hero: EventHeroViewModel = {
      id: 'void',
      title: 'VOID: Techno Saturday',
      dateLabel: '24 MAI',
      venueLabel: 'Sisyphos',
      cityLabel: 'Berlin',
      genreLabels: ['Techno'],
      accessibilityLabel: 'VOID Techno Saturday',
    };
    const info: EventInfoViewModel = {
      items: [{ id: 'date', icon: 'calendar-outline', label: 'Datum', value: 'Samstag, 24. Mai 2025' }],
    };
    const lineup: LineupSectionViewModel = {
      artists: [{ name: 'Sara Landry', headliner: true, accessibilityLabel: 'Sara Landry' }],
      accessibilityLabel: 'Line-up',
    };
    const tickets: EventTicketSectionViewModel = {
      mode: 'native',
      ticketTypes: [],
      ctaLabel: 'Tickets sichern',
      accessibilityLabel: 'Tickets',
    };
    const notice: EventNoticeViewModel = {
      type: 'cancelled',
      title: 'Event abgesagt',
    };

    expect('onPress' in hero).toBe(false);
    expect('repository' in info).toBe(false);
    expect('follow' in lineup).toBe(false);
    expect('checkout' in tickets).toBe(false);
    expect('mutation' in notice).toBe(false);
  });

  it('supports lineup TBA without artist profile data', () => {
    const lineup: LineupSectionViewModel = {
      artists: [],
      tba: true,
      accessibilityLabel: 'Line-up TBA',
    };
    expect(lineup.tba).toBe(true);
    expect(lineup.artists).toHaveLength(0);
  });
});

describe('Phase 2F saved display contracts', () => {
  it('resolves saved empty copy variants in German', () => {
    expect(resolveSavedEmptyCopy('no_saved').title).toContain('gespeicherten');
    expect(resolveSavedEmptyCopy('no_past').title).toContain('vergangenen');
  });

  it('keeps saved event models presentation-only', () => {
    const saved: SavedEventViewModel = {
      id: 'void',
      title: 'VOID: Techno Saturday',
      dateLabel: '24 MAI',
      venueLabel: 'Sisyphos',
      cityLabel: 'Berlin',
      genreLabels: ['Techno'],
      savedAtLabel: 'Gespeichert vor 2 Tagen',
      savedState: 'saved',
      accessibilityLabel: 'Saved VOID event',
    };

    expect('persist' in saved).toBe(false);
    expect('userId' in saved).toBe(false);
  });
});
