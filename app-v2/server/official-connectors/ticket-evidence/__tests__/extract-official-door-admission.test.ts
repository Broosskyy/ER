import { describe, expect, it } from 'vitest';

import { extractOfficialDoorAdmissionFromHtml } from '../extract-official-door-admission';

describe('extractOfficialDoorAdmissionFromHtml', () => {
  it('extracts Eintritt door price from Bootshaus KitKat description HTML', () => {
    const html = `
      <p>SA * 24.10.2026 | KitKatClub</p>
      <p>Uhrzeit: 22:00 Uhr</p>
      <p>Eintritt: 35 Euro</p>
    `;
    expect(extractOfficialDoorAdmissionFromHtml(html)).toEqual({
      amountMinor: 3500,
      currency: 'EUR',
      rawPriceText: 'Eintritt: 35 Euro',
    });
  });

  it('returns undefined when no door admission price is present', () => {
    expect(extractOfficialDoorAdmissionFromHtml('<p>Tickets soon</p>')).toBeUndefined();
  });
});
