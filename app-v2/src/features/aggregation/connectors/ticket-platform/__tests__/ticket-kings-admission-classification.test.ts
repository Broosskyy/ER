import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  aggregateAdmissionAvailability,
  classifyTicketKingsProduct,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-product-classification';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { AdminEventRecord } from '@/data/types/records';

const ADMISSION_FLEX_FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-admission-flex-checkout.html',
);

describe('ticket kings product classification', () => {
  it('classifies admission option blocks as admission_ticket', () => {
    const result = classifyTicketKingsProduct({
      structuralRole: 'admission_option',
      sectionHeading: 'Tickets',
      productName: 'Standard Ticket',
      isQuantityStepper: true,
    });
    expect(result.classification).toBe('admission_ticket');
    expect(result.includedInEventSummary).toBe(true);
  });

  it('classifies flex add-ons as insurance_or_flex and excludes them from summary', () => {
    const result = classifyTicketKingsProduct({
      structuralRole: 'addon_checkbox',
      sectionHeading: 'Zusatzoptionen',
      productName: 'Ticket Flex Option',
      isCheckbox: true,
    });
    expect(result.classification).toBe('insurance_or_flex');
    expect(result.includedInEventSummary).toBe(false);
    expect(result.exclusionReason).toContain('flex');
  });

  it('routes unknown legacy products to review_required', () => {
    const result = classifyTicketKingsProduct({
      structuralRole: 'legacy_card',
      productName: 'Mystery Product',
    });
    expect(result.classification).toBe('unknown_review_required');
    expect(result.includedInEventSummary).toBe(false);
  });
});

describe('ticket kings admission checkout extraction', () => {
  it('extracts native_event checkout iframe URL', () => {
    const html =
      '<iframe src="https://nacht-manager.de/ticketing/native_event.php?id=41"></iframe>';
    expect(extractNativeEventCheckoutUrl(html)).toBe(
      'https://nacht-manager.de/ticketing/native_event.php?id=41',
    );
  });

  it('uses admission ticket price when flex option is cheaper', () => {
    const html = readFileSync(ADMISSION_FLEX_FIXTURE, 'utf8');
    const evidence = parseTicketKingsCheckoutHtml(html);

    expect(evidence.priceAmount).toBe(15);
    expect(evidence.maximumPrice).toBe(15);
    expect(evidence.priceText).toBe('ab 15,00 €');
    expect(evidence.releases).toHaveLength(1);
    expect(evidence.releases[0]?.ticketType).toBe('Standard Ticket');
    expect(evidence.releases[0]?.phaseName).toBe('Phase 3');
    expect(evidence.releases[0]?.remainingQuantity).toBe(114);
    expect(evidence.excludedProducts.some((product) => product.rawProductName === 'Ticket Flex Option')).toBe(
      true,
    );
    expect(evidence.excludedProducts.find((product) => product.rawProductName === 'Ticket Flex Option')?.priceAmount).toBe(
      2.5,
    );
  });

  it('never promotes add-ons into ticket phases', () => {
    const html = readFileSync(ADMISSION_FLEX_FIXTURE, 'utf8');
    const evidence = parseTicketKingsCheckoutHtml(html);
    const candidate = {
      ticketUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/',
      priceText: evidence.priceText,
      priceAmount: evidence.priceAmount,
      sourceMetadata: {
        pageTitle: 'Sommerfest',
        eventDate: '2026-08-08T20:00:00+02:00',
        verifiedAt: '2026-08-06T10:00:00.000Z',
        ticketOffers: evidence.releases.map((release) => ({
          name: release.name,
          priceAmount: release.priceAmount,
          priceCurrency: release.priceCurrency,
          soldOut: release.soldOut,
        })),
        soldOut: evidence.soldOut,
      },
    };

    const existing = {
      id: 'evt-test',
      title: 'Sommerfest',
      description: '',
      startDate: '2026-08-08T20:00:00+02:00',
      status: 'published',
      createdAt: '',
      updatedAt: '',
      priceText: 'ab 2,50 €',
      ticketStatus: 'on_sale',
      ticketPhases: [
        {
          id: 'phase-standard',
          name: 'Standard',
          kind: 'regular' as const,
          sortOrder: 400,
          priceAmount: 2.5,
          priceCurrency: 'EUR',
        },
      ],
    } satisfies AdminEventRecord;

    const write = writeCanonicalTicketFields({
      existing: { ...existing, ticketPhases: [] },
      candidate,
      fillOnly: false,
      manualLocks: new Set(['ticketUrl', 'websiteUrl']),
    });

    expect(write.patch.priceText).toBe('ab 15,00 €');
    expect(write.patch.ticketPhases?.every((phase) => !/flex/i.test(phase.name))).toBe(true);
    expect(write.patch.ticketPhases?.[0]?.priceAmount).toBe(15);
  });

  it('excludes OPTIONAL section products from minimum price', () => {
    const html = `
      <div class="ticket-card ticket-selection-card">
        <h2 class="title is-5">Tickets</h2>
        <div class="box ticket-type-box ticket-option-choice">
          <div class="ticket-option-choice-inner">
            <div class="control ticket-option-main">
              <div class="ticket-option-title">Standard Ticket</div>
              <div class="ticket-meta ticket-option-meta">
                <span>Phase 1</span>
                <span><strong>20,00 EUR</strong> pro Ticket</span>
                <span>noch 5 verfügbar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="ticket-card ticket-addons-card">
        <h2 class="title is-5">Zusatzoptionen</h2>
        <div class="box ticket-type-box ticket-addon-choice">
          <input type="checkbox" />
          <label class="ticket-addon-title">Ticket Flex Option</label>
          <label class="ticket-addon-price">2,50 EUR</label>
        </div>
      </div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);
    expect(evidence.priceAmount).toBe(20);
    expect(evidence.releases).toHaveLength(1);
    expect(evidence.excludedProducts).toHaveLength(1);
  });

  it('uses admission price when optional add-on is cheaper than admission ticket', () => {
    const html = `
      <div class="ticket-card ticket-selection-card">
        <h2 class="title is-5">Tickets</h2>
        <div class="box ticket-type-box ticket-option-choice">
          <div class="ticket-option-choice-inner">
            <div class="control ticket-option-main">
              <div class="ticket-option-title">Standard Ticket</div>
              <div class="ticket-meta ticket-option-meta">
                <span>Phase 1</span>
                <span><strong>30,00 EUR</strong> pro Ticket</span>
                <span>noch 8 verfügbar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="ticket-card ticket-addons-card">
        <h2 class="title is-5">Zusatzoptionen</h2>
        <div class="box ticket-type-box ticket-addon-choice">
          <input type="checkbox" />
          <label class="ticket-addon-title">Locker Rental</label>
          <label class="ticket-addon-price">4,00 EUR</label>
        </div>
      </div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);

    expect(evidence.priceAmount).toBe(30);
    expect(evidence.releases).toHaveLength(1);
    expect(evidence.excludedProducts).toHaveLength(1);
    expect(evidence.excludedProducts[0]?.rawProductName).toBe('Locker Rental');
  });

  it('lists every optional-section product in excludedProducts', () => {
    const html = `
      <div class="ticket-card ticket-selection-card">
        <h2 class="title is-5">Tickets</h2>
        <div class="box ticket-type-box ticket-option-choice">
          <div class="ticket-option-choice-inner">
            <div class="control ticket-option-main">
              <div class="ticket-option-title">Standard Ticket</div>
              <div class="ticket-meta ticket-option-meta">
                <span>Phase 1</span>
                <span><strong>20,00 EUR</strong> pro Ticket</span>
                <span>noch 5 verfügbar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="ticket-card ticket-addons-card">
        <h2 class="title is-5">Zusatzoptionen</h2>
        <div class="box ticket-type-box ticket-addon-choice">
          <input type="checkbox" />
          <label class="ticket-addon-title">Ticket Flex Option</label>
          <label class="ticket-addon-price">2,50 EUR</label>
        </div>
        <div class="box ticket-type-box ticket-addon-choice">
          <input type="checkbox" />
          <label class="ticket-addon-title">Parking Pass</label>
          <label class="ticket-addon-price">8,00 EUR</label>
        </div>
      </div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);

    expect(evidence.excludedProducts).toHaveLength(2);
    expect(evidence.excludedProducts.map((product) => product.rawProductName)).toEqual([
      'Ticket Flex Option',
      'Parking Pass',
    ]);
  });

  it('ends optional-section scope when the next admission section starts', () => {
    const html = `
      <div class="ticket-card ticket-addons-card">
        <h2 class="title is-5">Zusatzoptionen</h2>
        <div class="box ticket-type-box ticket-addon-choice">
          <input type="checkbox" />
          <label class="ticket-addon-title">Ticket Flex Option</label>
          <label class="ticket-addon-price">2,50 EUR</label>
        </div>
      </div>
      <div class="ticket-card ticket-selection-card">
        <h2 class="title is-5">Tickets</h2>
        <div class="box ticket-type-box ticket-option-choice">
          <div class="ticket-option-choice-inner">
            <div class="control ticket-option-main">
              <div class="ticket-option-title">Standard Ticket</div>
              <div class="ticket-meta ticket-option-meta">
                <span>Phase 1</span>
                <span><strong>25,00 EUR</strong> pro Ticket</span>
                <span>noch 2 verfügbar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);

    expect(evidence.priceAmount).toBe(25);
    expect(evidence.releases).toHaveLength(1);
    expect(evidence.excludedProducts).toHaveLength(1);
    expect(evidence.excludedProducts[0]?.rawProductName).toBe('Ticket Flex Option');
  });

  it('aggregates sold_out only from admission products', () => {
    expect(
      aggregateAdmissionAvailability([
        { classification: 'admission_ticket', soldOut: true, available: false },
        { classification: 'insurance_or_flex', soldOut: false, available: true },
      ]),
    ).toBe('sold_out');
    expect(
      aggregateAdmissionAvailability([
        { classification: 'admission_ticket', soldOut: false, available: true },
        { classification: 'insurance_or_flex', soldOut: true, available: false },
      ]),
    ).toBe('available');
  });

  it('aggregates multiple admission phases to the lowest purchasable price', () => {
    const html = `
      <div class="ticket-card ticket-selection-card">
        <h2 class="title is-5">Tickets</h2>
        <div class="box ticket-type-box ticket-option-choice">
          <div class="ticket-option-choice-inner">
            <div class="control ticket-option-main">
              <div class="ticket-option-title">Standard Ticket</div>
              <div class="ticket-meta ticket-option-meta">
                <span>Phase 1</span>
                <span><strong>18,00 EUR</strong> pro Ticket</span>
                <span>ausverkauft</span>
              </div>
            </div>
          </div>
        </div>
        <div class="box ticket-type-box ticket-option-choice">
          <div class="ticket-option-choice-inner">
            <div class="control ticket-option-main">
              <div class="ticket-option-title">Standard Ticket</div>
              <div class="ticket-meta ticket-option-meta">
                <span>Phase 2</span>
                <span><strong>22,00 EUR</strong> pro Ticket</span>
                <span>noch 3 verfügbar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);
    expect(evidence.releases).toHaveLength(2);
    expect(evidence.priceAmount).toBe(22);
    expect(evidence.maximumPrice).toBe(22);
    expect(evidence.availability).toBe('available');
  });

  it('marks review_required when no admission product is identified', () => {
    const html = `
      <div class="ticket-card ticket-addons-card">
        <h2 class="title is-5">Zusatzoptionen</h2>
        <div class="box ticket-type-box ticket-addon-choice">
          <input type="checkbox" />
          <label class="ticket-addon-title">Ticket Flex Option</label>
          <label class="ticket-addon-price">2,50 EUR</label>
        </div>
      </div>
    `;
    const evidence = parseTicketKingsCheckoutHtml(html);
    expect(evidence.reviewRequired).toBe(true);
    expect(evidence.availability).toBe('review_required');
    expect(evidence.releases).toHaveLength(0);
    expect(evidence.priceText).toBeUndefined();
  });
});
