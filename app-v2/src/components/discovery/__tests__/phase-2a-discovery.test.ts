import { describe, expect, it } from 'vitest';

import { resolveChipStyle } from '@/components/discovery/chip-styles';
import { resolveEventCardMetrics } from '@/components/discovery/event-card-styles';
import { resolveEventStatus, resolveTicketStatus } from '@/components/discovery/event-status-styles';
import {
  cancelledEvent,
  compactListEvents,
  hardTechnoEvent,
  longTitleEvent,
  postponedEvent,
  previewOrganizer,
  previewSearchResult,
  soldOutFestivalEvent,
} from '@/components/discovery/preview-fixtures';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';

describe('Event and ticket status resolution', () => {
  it('maps every required event status to a display label', () => {
    const statuses = [
      'upcoming',
      'today',
      'sold_out',
      'cancelled',
      'postponed',
      'draft',
      'pending_review',
      'verified',
      'unverified',
    ] as const;

    for (const status of statuses) {
      expect(resolveEventStatus(status).label).not.toHaveLength(0);
      expect(resolveEventStatus(status).icon).not.toHaveLength(0);
    }
  });

  it('uses destructive semantic styling for sold-out and cancelled events', () => {
    expect(resolveEventStatus('sold_out').badgeStatus).toBe('error');
    expect(resolveEventStatus('cancelled').badgeStatus).toBe('error');
  });

  it('maps ticket availability states without ticket business logic', () => {
    expect(resolveTicketStatus('available').label).toBe('Tickets verfügbar');
    expect(resolveTicketStatus('free').badgeStatus).toBe('success');
    expect(resolveTicketStatus('limited').badgeStatus).toBe('warning');
    expect(resolveTicketStatus('sold_out').badgeStatus).toBe('error');
  });
});

describe('Event card variants', () => {
  it('uses a featured image ratio only for featured cards', () => {
    expect(resolveEventCardMetrics('standard').imageVariant).toBe('list');
    expect(resolveEventCardMetrics('compact').imageVariant).toBe('compact');
    expect(resolveEventCardMetrics('featured').imageVariant).toBe('featured');
  });

  it('keeps all supported preview states display-only', () => {
    expect(soldOutFestivalEvent.status).toBe('sold_out');
    expect(cancelledEvent.status).toBe('cancelled');
    expect(postponedEvent.status).toBe('postponed');
    expect(postponedEvent.image).toBeUndefined();
  });

  it('retains a long title and venue in the view model', () => {
    expect(longTitleEvent.title.length).toBeGreaterThan(hardTechnoEvent.title.length);
    expect(longTitleEvent.venueLabel.length).toBeGreaterThan(hardTechnoEvent.venueLabel.length);
  });
});

describe('Chip theme states', () => {
  it('uses selected roles for light theme chips', () => {
    const style = resolveChipStyle(lightTheme, { selected: true, disabled: false });
    expect(style.backgroundColor).toBe(lightTheme.colorRoles.chipSelectedBackground);
    expect(style.labelColor).toBe(lightTheme.colorRoles.chipSelectedText);
  });

  it('uses disabled opacity for dark theme chips', () => {
    const style = resolveChipStyle(darkTheme, { selected: false, disabled: true });
    expect(style.opacity).toBe(0.5);
    expect(style.borderColor).toBe(darkTheme.colorRoles.chipBorder);
  });
});

describe('Discovery view models', () => {
  it('uses event-only search results until a non-event result layout is specified', () => {
    expect(previewSearchResult.kind).toBe('event');
    expect(previewSearchResult.title).toBe(hardTechnoEvent.title);
  });

  it('keeps organizer verification as UI display data', () => {
    expect(previewOrganizer.verified).toBe(true);
    expect(previewOrganizer.accessibilityLabel).toContain(previewOrganizer.name);
  });

  it('provides compact list items without routing callbacks', () => {
    expect(compactListEvents).toHaveLength(2);
    expect('onPress' in compactListEvents[0]!).toBe(false);
  });
});
