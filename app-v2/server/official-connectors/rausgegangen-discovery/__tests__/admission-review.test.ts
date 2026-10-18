import { describe, expect, it } from 'vitest';
import { classifyRausgegangenAdmissionForReview } from '../admission-review';

describe('Rausgegangen read-only admission review', () => {
  it('does not infer whole-event free entry from unqualified 0 EUR', () => {
    const review = classifyRausgegangenAdmissionForReview({
      description: 'Entry price at the door is not announced.', ticketPriceMinor: 0,
    });
    expect(review.kind).toBe('door_price_unknown');
    expect(review.sourcePriceMinor).toBe(0);
    expect(review.autoPersistAllowed).toBe(false);
  });
  it('recognizes truly free admission when the event itself says so', () => {
    const review = classifyRausgegangenAdmissionForReview({
      description: 'Eintritt frei. Doors 19:30.', ticketPriceMinor: 0,
    });
    expect(review.kind).toBe('free_entry');
    expect(review.sourcePriceMinor).toBe(0);
    expect(review.autoPersistAllowed).toBe(false);
  });

  it('never equates free before midnight with free all night', () => {
    const review = classifyRausgegangenAdmissionForReview({
      description: "Doors 23:00. Free Entry Til' Midnight. Preis an AK.",
      ticketPriceMinor: 0,
    });
    expect(review.kind).toBe('free_until_cutoff');
    expect(review.autoPersistAllowed).toBe(false);
  });

  it('treats an unknown door price as unknown rather than 0', () => {
    const review = classifyRausgegangenAdmissionForReview({
      description: 'Preis an AK. Einlass ab 23 Uhr.',
    });
    expect(review.kind).toBe('door_price_unknown');
    expect(review.sourcePriceMinor).toBeUndefined();
  });

  it('keeps a tour ticket URL under identity verification even with a price', () => {
    const review = classifyRausgegangenAdmissionForReview({
      description: 'Indie Rave Tour', ticketPriceMinor: 3485,
      ticketUrl: 'https://www.eventim.de/artist/kytes/',
    });
    expect(review.kind).toBe('online_offer_needs_identity_verification');
    expect(review.autoPersistAllowed).toBe(false);
    expect(review.sourceTicketUrl).toContain('/artist/');
  });

  it('does not infer admission from a missing offer or generic description', () => {
    const review = classifyRausgegangenAdmissionForReview({
      description: 'DJ Nachtstrom spielt Industrial.',
    });
    expect(review.kind).toBe('unknown');
    expect(review.sourcePriceMinor).toBeUndefined();
  });

  it('never promotes just an isolated numeric source hint without a purchase link', () => {
    const review = classifyRausgegangenAdmissionForReview({ ticketPriceMinor: 3300 });
    expect(review.kind).toBe('numeric_offer_without_purchase_target');
    expect(review.autoPersistAllowed).toBe(false);
  });
});
