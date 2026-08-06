import { describe, expect, it } from 'vitest';

import {
  classifyLineupDisplayGap,
  classifyTicketBadgeGap,
  classifyVenueLabelGap,
  isTrueProjectionDefect,
  TAXONOMY_RULES_VERSION,
} from '@/features/aggregation/audit/audit-issue-taxonomy';

describe('audit issue taxonomy phase 4.7.7.1', () => {
  it('does not classify empty venue_label as projection when canonical venue is absent', () => {
    const issue = classifyVenueLabelGap({
      title: '122 pres. TRIPOLISM @ Palma de Mallorca (ES)',
      eventVenueCity: 'Palma de Mallorca',
      projectedVenueLabel: '',
    });
    expect(issue?.code).toBe('canonical_venue_evidence_gap');
    expect(issue?.repairability).toBe('requires_review');
    expect(isTrueProjectionDefect(issue!)).toBe(false);
  });

  it('classifies true venue projection gap when canonical venue exists', () => {
    const issue = classifyVenueLabelGap({
      title: 'Bootshaus Night',
      eventVenueName: 'Bootshaus',
      projectedVenueLabel: '',
    });
    expect(issue?.code).toBe('venue_label_projection_gap');
    expect(issue?.repairability).toBe('repairable_now');
    expect(isTrueProjectionDefect(issue!)).toBe(true);
  });

  it('classifies VERTILE garbage lineup as requires_review not projection', () => {
    const issue = classifyLineupDisplayGap({
      persistedArtistNames: ['EVERYTHING CHANGES -LIVE- @ BOOTSHAUS!'],
      displayedArtistNames: [],
      suspiciousArtistNames: ['EVERYTHING CHANGES -LIVE- @ BOOTSHAUS!'],
      legacyArtifactNames: [],
      structuredEntryCount: 1,
    });
    expect(issue?.code).toBe('garbage_lineup_filtered');
    expect(issue?.repairability).toBe('requires_review');
  });

  it('classifies missing badge without availability as blocked evidence gap', () => {
    const issue = classifyTicketBadgeGap({
      hasTicketBadge: false,
      availability: 'unknown',
      priceText: 'Tickets ab 20 Euro',
      ticketUrl: 'https://example.com/ticket',
    });
    expect(issue?.code).toBe('missing_availability_evidence');
    expect(issue?.repairability).toBe('blocked_by_missing_public_evidence');
  });

  it('classifies missing badge with sold_out as projection defect', () => {
    const issue = classifyTicketBadgeGap({
      hasTicketBadge: false,
      availability: 'sold_out',
      ticketStatus: 'sold_out',
    });
    expect(issue?.code).toBe('ticket_badge_projection_gap');
    expect(issue?.repairability).toBe('repairable_now');
  });

  it('exports stable taxonomy version', () => {
    expect(TAXONOMY_RULES_VERSION).toBe('phase4771-v1');
  });
});
