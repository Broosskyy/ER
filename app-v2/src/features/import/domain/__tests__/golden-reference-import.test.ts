import { describe, expect, it } from 'vitest';

import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { resolveConsumerTicketPresentation } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { buildCanonicalEventFromVerifiedPublicEvidence } from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { GOLDEN_REFERENCE_IMPORT_FIXTURES } from '@/features/import/domain/__tests__/fixtures/golden-reference-import-fixtures';

function normalizeUrl(url: string | undefined): string | undefined {
  return url?.replace(/\/$/, '');
}

function assertCanonicalField(
  actual: ImportPublishFieldPatch,
  expected: ImportPublishFieldPatch,
  field: keyof ImportPublishFieldPatch,
) {
  const actualValue = actual[field];
  const expectedValue = expected[field];
  if (expectedValue === undefined) {
    return;
  }
  if (field === 'ticketUrl' || field === 'websiteUrl') {
    expect(normalizeUrl(actualValue as string | undefined)).toBe(
      normalizeUrl(expectedValue as string | undefined),
    );
    return;
  }
  if (field === 'genreLabels') {
    expect(actualValue).toEqual(expect.arrayContaining(expectedValue as string[]));
    expect((actualValue as string[] | undefined)?.length).toBe(
      (expectedValue as string[]).length,
    );
    return;
  }
  expect(actualValue).toBe(expectedValue);
}

describe('golden reference import path', () => {
  for (const fixture of GOLDEN_REFERENCE_IMPORT_FIXTURES) {
    it(`accepts ${fixture.label} through the golden builder`, () => {
      const result = buildCanonicalEventFromVerifiedPublicEvidence({
        officialEvidence: fixture.officialEvidence,
        ticketEvidence: fixture.ticketEvidence,
        checkoutEvidence: fixture.checkoutEvidence,
        conflictingTicketEvidence: fixture.conflictingTicketEvidence,
      });

      expect(result.disposition).toBe(fixture.expectedDisposition);

      const canonicalFields: Array<keyof ImportPublishFieldPatch> = [
        'title',
        'startDate',
        'endDate',
        'venueName',
        'venueAddress',
        'venuePostalCode',
        'venueCity',
        'websiteUrl',
        'ticketUrl',
        'description',
        'genreLabels',
        'priceText',
        'ageRestriction',
      ];
      for (const field of canonicalFields) {
        assertCanonicalField(result.canonicalPatch, fixture.expectedCanonical, field);
      }

      const lineupNames = result.lineupPatch.entries.map((entry) => entry.displayName);
      expect(lineupNames).toEqual(fixture.expectedLineup);

      const projection = projectCanonicalEventFields({
        title: result.canonicalPatch.title ?? '',
        description: result.canonicalPatch.description ?? '',
        venue: result.canonicalPatch.venueName ?? '',
        city: result.canonicalPatch.venueCity ?? '',
        artists: lineupNames,
        priceText: result.canonicalPatch.priceText,
        source: 'golden-fixture',
        ticketUrl: result.canonicalPatch.ticketUrl,
        ticketPhases: result.canonicalPatch.ticketPhases,
        ticketStatus: result.canonicalPatch.ticketStatus,
        genres: result.canonicalPatch.genreLabels,
      });

      if (fixture.expectedConsumer.venueLabel) {
        expect(projection.venueLabel).toBe(fixture.expectedConsumer.venueLabel);
      }
      if (fixture.expectedConsumer.cityLabel) {
        expect(projection.cityLabel).toBe(fixture.expectedConsumer.cityLabel);
      }
      if (fixture.expectedConsumer.displayPriceText) {
        expect(projection.displayPriceText).toBe(fixture.expectedConsumer.displayPriceText);
      }
      if (fixture.expectedConsumer.ticketUrl) {
        expect(normalizeUrl(projection.ticketUrl)).toBe(
          normalizeUrl(fixture.expectedConsumer.ticketUrl),
        );
      }
      if (fixture.expectedConsumer.knownArtistNames) {
        expect(projection.knownArtistNames).toEqual(fixture.expectedConsumer.knownArtistNames);
      }
      if (fixture.expectedConsumer.genres) {
        expect(projection.genres).toEqual(
          expect.arrayContaining(fixture.expectedConsumer.genres),
        );
      }
      if (fixture.expectedConsumer.ticketProviderLabel) {
        expect(projection.ticketProviderLabel).toBe(fixture.expectedConsumer.ticketProviderLabel);
      }

      const ticketPresentation = resolveConsumerTicketPresentation(
        {
          title: result.canonicalPatch.title,
          priceText: result.canonicalPatch.priceText,
          displayPriceText: projection.displayPriceText,
          ticketUrl: result.canonicalPatch.ticketUrl,
          ticketPhases: result.canonicalPatch.ticketPhases,
          ticketAvailability: result.canonicalPatch.ticketStatus,
        },
        { ctaLabel: fixture.expectedConsumer.ctaLabel },
      );

      if (fixture.expectedConsumer.headerPrice) {
        expect(ticketPresentation.headerPriceLabel).toBe(fixture.expectedConsumer.headerPrice);
      }
      if (fixture.expectedConsumer.ctaLabel) {
        expect(ticketPresentation.cta).toBe(fixture.expectedConsumer.ctaLabel);
      }
      if (fixture.expectedConsumer.phaseNames) {
        expect(ticketPresentation.ticketTypes.map((phase) => phase.name)).toEqual(
          fixture.expectedConsumer.phaseNames,
        );
      }

      if (fixture.conflictingTicketEvidence) {
        expect(result.canonicalPatch.ticketUrl).not.toContain('Atz0dHLX');
        expect(result.canonicalPatch.priceText).not.toMatch(/34,90/);
      }
    });
  }
});
