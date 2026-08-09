import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import {
  FIELD_BLOCKED_OFFICIAL_WEBSITE,
  filterPatchByFieldBoundaries,
  shouldBlockWebsiteUrlPatch,
} from '../field-boundaries';
import { buildFieldGroupDeltas } from '../field-delta';
import { evaluateGenericTruthPublish } from '../publish-evaluation';
import type { SourceEvidenceBundle } from '../source-evidence-contract';

const OFFICIAL_PAGE = 'https://venue.example.test/events/synth-night';
const TICKET_PAGE = 'https://shop.ticket.io/abc123/';

function baseEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-boundary-001',
    title: 'Synth Night',
    description: '',
    startDate: '2026-09-15T20:00:00.000Z',
    status: 'published',
    sourceId: 'source-ticket-platform',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function ticketPlatformBundle(overrides: Partial<SourceEvidenceBundle> = {}): SourceEvidenceBundle {
  return {
    sourceId: 'source-ticket-platform',
    sourceRole: 'ticket_platform',
    sourceUrl: TICKET_PAGE,
    observedAt: '2026-08-06T12:00:00.000Z',
    verifiedAt: '2026-08-06T12:00:00.000Z',
    identity: {
      pageTitle: 'Synth Night',
      listRowTitle: 'Synth Night',
      eventDate: '2026-09-15T20:00:00.000Z',
      venueName: 'Example Venue',
    },
    tickets: {
      publicCtaCandidateUrl: TICKET_PAGE,
      priceText: 'ab 32,00 €',
      availability: 'on_sale',
    },
    provenance: {
      extractionStrategy: 'ticket_platform_metadata',
      evidenceType: 'ticket_platform_event_page',
    },
    evidenceOrigin: 'ticket_platform_metadata',
    identityEvidenceOrigin: 'ticket_platform_metadata',
    sourceNativeEvidence: true,
    legacyFallbackUsed: false,
    criticalIdentitySelfDerived: false,
    ...overrides,
  };
}

function officialWebsiteBundle(overrides: Partial<SourceEvidenceBundle> = {}): SourceEvidenceBundle {
  const newOfficial = 'https://venue.example.test/events/synth-night-updated';
  return {
    sourceId: 'source-official-website',
    sourceRole: 'official_website_source',
    sourceUrl: newOfficial,
    observedAt: '2026-08-06T12:00:00.000Z',
    verifiedAt: '2026-08-06T12:00:00.000Z',
    identity: {
      pageTitle: 'Synth Night',
      eventDate: '2026-09-15T20:00:00.000Z',
      venueName: 'Example Venue',
      officialOutboundRelationship: 'same_host',
    },
    provenance: {
      extractionStrategy: 'official_website_public_truth',
      evidenceType: 'official_event_page',
    },
    evidenceOrigin: 'official_website_public_truth',
    identityEvidenceOrigin: 'official_website_public_truth',
    sourceNativeEvidence: true,
    legacyFallbackUsed: false,
    criticalIdentitySelfDerived: false,
    ...overrides,
  };
}

function ticketCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    title: 'Synth Night',
    startDate: '2026-09-15T20:00:00.000Z',
    sourceId: 'source-ticket-platform',
    sourceName: 'Ticket Platform',
    externalId: 'ext-ticket-001',
    rawSourceType: 'ticket_platform',
    ticketUrl: TICKET_PAGE,
    eventUrl: TICKET_PAGE,
    priceText: 'ab 32,00 €',
    sourceMetadata: {
      connectorKey: 'ticket_platform',
      platform: 'ticket.io',
      verifiedAt: '2026-08-06T12:00:00.000Z',
      observedAt: '2026-08-06T12:00:00.000Z',
      pageTitle: 'Synth Night',
      listRowTitle: 'Synth Night',
      eventDate: '2026-09-15T20:00:00.000Z',
      venueName: 'Example Venue',
      publicCtaCandidateUrl: TICKET_PAGE,
      priceText: 'ab 32,00 €',
    },
    ...overrides,
  };
}

describe('field boundary — websiteUrl vs ticket CTA', () => {
  it('keeps official websiteUrl when ticket source updates ticketUrl', () => {
    const existing = baseEvent({
      websiteUrl: OFFICIAL_PAGE,
      ticketUrl: undefined,
      ticketStatus: 'external_link',
    });
    const evaluation = evaluateGenericTruthPublish({
      existing,
      candidate: ticketCandidate(),
      bundle: ticketPlatformBundle(),
      allowedFieldGroups: ['tickets', 'cta_checkout'],
    });

    expect(evaluation.dryRunAfter.websiteUrl).toBe(OFFICIAL_PAGE);
    expect(evaluation.dryRunAfter.ticketUrl).toBe(TICKET_PAGE);
    expect(evaluation.diagnostics).toContain(FIELD_BLOCKED_OFFICIAL_WEBSITE);
  });

  it('blocks ticket page accidentally proposed as websiteUrl', () => {
    const blocked = shouldBlockWebsiteUrlPatch({
      proposedUrl: TICKET_PAGE,
      existingUrl: OFFICIAL_PAGE,
      bundle: ticketPlatformBundle(),
    });
    expect(blocked).toBe(true);

    const filtered = filterPatchByFieldBoundaries({
      patch: { websiteUrl: TICKET_PAGE, ticketUrl: TICKET_PAGE, priceText: 'ab 32,00 €' },
      existing: baseEvent({ websiteUrl: OFFICIAL_PAGE }),
      bundle: ticketPlatformBundle(),
      allowedFieldGroups: ['tickets', 'cta_checkout'],
    });
    expect(filtered.patch.websiteUrl).toBeUndefined();
    expect(filtered.blockedFields.websiteUrl).toBe(FIELD_BLOCKED_OFFICIAL_WEBSITE);
    expect(filtered.patch.ticketUrl).toBe(TICKET_PAGE);
  });

  it('allows verified official website source to update websiteUrl', () => {
    const newOfficial = 'https://venue.example.test/events/synth-night-updated';
    const existing = baseEvent({ websiteUrl: OFFICIAL_PAGE });
    const evaluation = evaluateGenericTruthPublish({
      existing,
      candidate: {
        ...ticketCandidate({
          sourceId: 'source-official-website',
          eventUrl: newOfficial,
          originalLink: newOfficial,
          ticketUrl: undefined,
          sourceMetadata: {
            verifiedAt: '2026-08-06T12:00:00.000Z',
            pageTitle: 'Synth Night',
            eventDate: '2026-09-15T20:00:00.000Z',
            officialHtml: '<html></html>',
          },
        }),
      },
      bundle: officialWebsiteBundle(),
      allowedFieldGroups: ['identity_schedule_venue'],
    });

    expect(evaluation.dryRunAfter.websiteUrl).toBe(newOfficial);
  });

  it('tickets field-group may change price phases and status but not websiteUrl', () => {
    const existing = baseEvent({
      websiteUrl: OFFICIAL_PAGE,
      priceText: 'Tickets ab 30 Euro',
      ticketStatus: 'external_link',
    });
    const deltas = buildFieldGroupDeltas({
      before: existing,
      patch: {
        priceText: 'ab 32,00 €',
        ticketStatus: 'on_sale',
        ticketPhases: [{ id: 'phase-1', name: 'Admission', sortOrder: 1, kind: 'other' }],
        websiteUrl: TICKET_PAGE,
      },
      blockedGroups: {},
    });
    const tickets = deltas.find((entry) => entry.group === 'tickets');
    expect(tickets?.wouldChange).toBe(true);
    expect(tickets?.proposed).not.toHaveProperty('websiteUrl');

    const identity = deltas.find((entry) => entry.group === 'identity_schedule_venue');
    expect(identity?.proposed).toHaveProperty('websiteUrl');
  });

  it('cta_checkout field-group may change ticketUrl but not websiteUrl', () => {
    const existing = baseEvent({
      websiteUrl: OFFICIAL_PAGE,
      ticketUrl: undefined,
    });
    const deltas = buildFieldGroupDeltas({
      before: existing,
      patch: { ticketUrl: TICKET_PAGE, websiteUrl: TICKET_PAGE },
      blockedGroups: {},
    });
    const cta = deltas.find((entry) => entry.group === 'cta_checkout');
    expect(cta?.wouldChange).toBe(true);
    expect(cta?.proposed).toEqual({ ticketUrl: TICKET_PAGE });
    expect(cta?.proposed).not.toHaveProperty('websiteUrl');
  });
});
