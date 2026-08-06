import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  parseTicketKingsDetailHtml,
  stripTicketKingsRelatedEventsSidebar,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';

const DETAIL_FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-kings-event-detail.html',
);

describe('ticket kings detail parser related-events exclusion', () => {
  it('strips tribe-related-events sidebar before lineup extraction', () => {
    const html = readFileSync(DETAIL_FIXTURE, 'utf8');
    const stripped = stripTicketKingsRelatedEventsSidebar(html);
    expect(stripped).not.toContain('tribe-related-events');
    expect(stripped).not.toContain('Underland Essigfabrik 05.09.2026');
  });

  it('does not parse related event titles as lineup artists', () => {
    const html = readFileSync(DETAIL_FIXTURE, 'utf8');
    const parsed = parseTicketKingsDetailHtml(html);
    const names = parsed.lineupEntries?.map((entry) => entry.displayName) ?? [];
    expect(names).not.toContain('Underland Essigfabrik 05.09.2026');
    expect(names).not.toContain('M.D.M.A xxx PROTON xxx STUTTGART');
    expect(names.some((name) => /DYSTOPIA/i.test(name))).toBe(true);
  });
});
