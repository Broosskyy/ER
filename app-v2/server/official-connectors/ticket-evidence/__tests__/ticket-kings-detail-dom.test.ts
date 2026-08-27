import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseTicketKingsDetailDom, extractLineupFromTicketKingsDescription } from '../parse-ticket-kings-detail-dom';

const FIXTURE_DIR = join(process.cwd(), '.tmp');

describe('TicketKings detail DOM parser', () => {
  it('parses underland ticket products from n8manager embed fixture', () => {
    const embedBody = readFileSync(join(FIXTURE_DIR, 'm9-2-n8manager-underland.html'), 'utf8');
    const parsed = parseTicketKingsDetailDom(embedBody, 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/');
    expect(parsed.offers.length).toBeGreaterThan(0);
    const admission = parsed.offers[0];
    expect(admission.rawLabel).toMatch(/E-Ticket/i);
    expect(admission.amountMinor).toBe(1800);
    expect(admission.currency).toBe('EUR');
  });

  it('extracts event description from ticketkings page fixture', () => {
    const body = readFileSync(join(FIXTURE_DIR, 'm9-2-ticketkings-underland.html'), 'utf8');
    const parsed = parseTicketKingsDetailDom(body, 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/');
    expect(parsed.descriptionClean).toBeDefined();
    expect(parsed.descriptionClean).toMatch(/UNDERLAND/i);
    expect(parsed.embeddedTicketingUrls.length).toBeGreaterThan(0);
  });

  it('extracts lineup acts from ticketkings description block', () => {
    const lineup = extractLineupFromTicketKingsDescription(
      'LINE-UP PAOLO FERRARA LE KLOWN ANNX HELLMAYER LHYST PØUL STZ TATTI VALKYRIE VANY 📅 Samstag, 10. Oktober 2026',
    );
    expect(lineup.map((act) => act.displayName)).toEqual([
      'PAOLO FERRARA',
      'LE KLOWN',
      'ANNX HELLMAYER',
      'LHYST',
      'PØUL STZ',
      'TATTI VALKYRIE',
      'VANY',
    ]);
  });

  it('extracts lineup even when prose mentions Samstag before the LINE-UP block', () => {
    const lineup = extractLineupFromTicketKingsDescription(
      'Am Samstag, den 10. Oktober 2026, kehrt MDMA zurück. LINE-UP PAOLO FERRARA LE KLOWN ANNX HELLMAYER LHYST PØUL STZ TATTI VALKYRIE VANY 📅 Samstag, 10. Oktober 2026',
    );
    expect(lineup.map((act) => act.displayName)).toContain('PAOLO FERRARA');
    expect(lineup.map((act) => act.displayName)).toContain('LE KLOWN');
  });
});
