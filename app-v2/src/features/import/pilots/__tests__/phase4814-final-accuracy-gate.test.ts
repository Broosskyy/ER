import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractOfficialPageDescription } from '@/features/import/adapters/extractors/official-page-description';
import {
  buildTicketIoPriceSemantics,
  compareTicketIoPriceSemantics,
  isPlaceholderZeroPrice,
} from '@/features/import/domain/ticket-io-price-semantics';
import {
  classifyStaleTicketDestination,
  isStaleJsonLdOfferCandidate,
  staleEvidenceCannotWinMerge,
} from '@/features/import/domain/stale-evidence-policy';
import { validateShadowNoWrite } from '@/features/import/pilots/shadow-safety';
import { parseTicketKingsListHtml } from '@/features/import/pilots/ticket-kings-public-discovery';

const FIXTURE_DIR = join(process.cwd(), 'docs/real-data/_phase4812_live_evidence');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf8');
}

describe('ticket-io-price-semantics', () => {
  it('sold-out does not become zero price', () => {
    const semantics = buildTicketIoPriceSemantics({ rawLabel: 'Ausverkauft', soldOut: true });
    expect(semantics.kind).toBe('sold_out_status');
    expect(semantics.displayPriceLabel).toBe('Ausverkauft');
    expect(semantics.placeholderZeroRejected).toBe(false);
  });

  it('rejects placeholder zero', () => {
    expect(isPlaceholderZeroPrice('ab 0,00 €')).toBe(true);
    expect(buildTicketIoPriceSemantics({ rawLabel: 'ab 0,00 €' }).kind).toBe('placeholder_zero');
  });

  it('separates historical phase price when sold out with amount', () => {
    const semantics = buildTicketIoPriceSemantics({ rawLabel: 'Ausverkauft', soldOut: true, amount: 32 });
    expect(semantics.soldOut).toBe(true);
    expect(semantics.historicalPhaseAmount).toBe(32);
  });

  it('marks production stale when live sold-out vs old price', () => {
    const semantics = buildTicketIoPriceSemantics({ rawLabel: 'Ausverkauft', soldOut: true });
    expect(compareTicketIoPriceSemantics(semantics, 'Tickets ab 32,00 Euro')).toBe('sold_out_unified_correct');
  });

  it('marks production stale on live price drift', () => {
    const semantics = buildTicketIoPriceSemantics({ rawLabel: 'ab 25,90 €', amount: 25.9 });
    expect(compareTicketIoPriceSemantics(semantics, 'Tickets ab 23,90 Euro')).toBe('production_stale');
  });
});

describe('official-page-description', () => {
  it('extracts bootshaus event body instead of short og meta', () => {
    const html = loadFixture('official-website-80.html');
    const result = extractOfficialPageDescription(html);
    expect(result.source).toBe('event_body_bootshaus');
    expect(result.description).toContain('Electro/EDM');
    expect(result.description).not.toBe('Doors: 22:00');
  });

  it('does not fabricate underland description when body is empty', () => {
    const html = loadFixture('official-website-5.html');
    const result = extractOfficialPageDescription(html);
    expect(result.source).toBe('none');
    expect(result.description).toBeUndefined();
  });

  it('rejects footer contamination patterns', () => {
    const html = '<div class="site-footer">Impressum Datenschutz newsletter</div>';
    const result = extractOfficialPageDescription(html);
    expect(result.contaminationRejected).toBe(true);
  });
});

describe('stale-evidence-policy', () => {
  it('detects stale Ticket Kings slug', () => {
    expect(
      isStaleJsonLdOfferCandidate(
        'https://ticketkings.de/event/sommerfest-elektrokueche-08-08-2026/',
        'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/',
      ),
    ).toBe(true);
  });

  it('stale offer cannot win CTA', () => {
    const decision = classifyStaleTicketDestination({
      candidateUrl: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
      verifiedUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
      source: 'json_ld_offer',
    });
    expect(staleEvidenceCannotWinMerge(decision)).toBe(true);
  });
});

describe('ticket-kings-public-discovery', () => {
  it('parses list page event URLs', () => {
    const html = `<a class="ect-event-url" href="https://ticketkings.de/event/mdma-musik-die-mich-antreibt-10-10-26/">MDMA</a>`;
    const events = parseTicketKingsListHtml(html);
    expect(events).toHaveLength(1);
    expect(events[0]?.slug).toContain('mdma');
  });
});

describe('shadow-safety', () => {
  it('enforces zero production writes', () => {
    expect(validateShadowNoWrite({ productionMutationsInThisRun: 0 }).ok).toBe(true);
    expect(validateShadowNoWrite({ productionMutationsInThisRun: 1 }).ok).toBe(false);
  });
});
