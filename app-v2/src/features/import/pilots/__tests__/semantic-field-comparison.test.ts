import { describe, expect, it } from 'vitest';

import {
  classifyFieldComparison,
  descriptionsSemanticallyAlign,
  importerOwnsField,
  pricesSemanticallyAlign,
  urlsSemanticallyAlign,
} from '@/features/import/pilots/semantic-field-comparison';

describe('semantic-field-comparison', () => {
  it('aligns price labels after normalization', () => {
    expect(pricesSemanticallyAlign('ab 23,90 €', 'Tickets ab 23,90 Euro')).toBe(true);
    expect(pricesSemanticallyAlign('Ausverkauft', 'Ausverkauft')).toBe(true);
  });

  it('aligns descriptions after HTML entity decode', () => {
    expect(
      descriptionsSemanticallyAlign(
        'AFFENK&Auml;FIG RULES! BOOTSHAUS &ndash; FULL HOUSE!',
        'AFFENKÄFIG RULES! BOOTSHAUS – FULL HOUSE!',
      ),
    ).toBe(true);
  });

  it('aligns URLs with trailing slash', () => {
    expect(
      urlsSemanticallyAlign(
        'https://bootshaus-club.ticket.io/C7JPnatZ/',
        'https://bootshaus-club.ticket.io/C7JPnatZ',
      ),
    ).toBe(true);
  });

  it('ticket-io does not own description', () => {
    expect(importerOwnsField('ticket-io', 'description')).toBe(false);
    expect(importerOwnsField('ticket-io', 'price')).toBe(true);
  });

  it('reclassifies LEGACY_BETTER as INTENTIONALLY_UNSUPPORTED for ticket-io title', () => {
    const result = classifyFieldComparison({
      importer: 'ticket-io',
      field: 'title',
      unified: undefined,
      production: 'Some Event Title',
      rawStatus: 'LEGACY_BETTER',
    });
    expect(result.status).toBe('INTENTIONALLY_UNSUPPORTED');
    expect(result.legacyBetterGroup).toBe('intentionally_unsupported');
  });

  it('reclassifies price BOTH_INCORRECT to BOTH_CORRECT when labels align', () => {
    const result = classifyFieldComparison({
      importer: 'ticket-io',
      field: 'price',
      unified: 'ab 19,90 €',
      production: 'Tickets ab 19,90 Euro',
      rawStatus: 'BOTH_INCORRECT',
    });
    expect(result.status).toBe('BOTH_CORRECT');
  });

  it('nacht-manager checkout vs TK page is intentionally unsupported', () => {
    const result = classifyFieldComparison({
      importer: 'nacht-manager',
      field: 'ticketUrl',
      unified: 'https://nacht-manager.de/ticketing/native_event.php?id=30',
      production: 'https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/',
      rawStatus: 'BOTH_INCORRECT',
    });
    expect(result.status).toBe('INTENTIONALLY_UNSUPPORTED');
  });

  it('stale json-ld offer on official website is STALE_EVIDENCE not BOTH_INCORRECT', () => {
    const result = classifyFieldComparison({
      importer: 'official-website',
      field: 'ticketUrl',
      unified: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
      production: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
      rawStatus: 'BOTH_INCORRECT',
    });
    expect(result.status).toBe('STALE_EVIDENCE');
  });
});
