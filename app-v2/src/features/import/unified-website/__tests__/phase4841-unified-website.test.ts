import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyDescriptionBoundaries,
  extractDescriptionBoundariesFromHtml,
  extractParagraphBlocksFromHtml,
} from '@/features/import/unified-website/description-boundaries';
import { extractEventDescription } from '@/features/import/unified-website/description-extraction';
import { extractDetailPage } from '@/features/import/unified-website/detail-extraction';
import { extractLineupFromContentBlocks } from '@/features/import/unified-website/lineup-extraction';
import { normalizeOfficialPageTitle } from '@/features/import/unified-website/title-normalization';
import { extractTicketUrl } from '@/features/import/unified-website/ticket-extraction';
import { bootshausProviderAdapter } from '@/features/import/unified-website/provider-adapters';
import { runUnifiedWebsiteImport, buildImportContextFromRef } from '@/features/import/unified-website';

const R3HAB_FIXTURE = join(
  process.cwd(),
  'docs/real-data/_phase4823_live_evidence/live-official-website-98.html',
);
const SOMMERFEST_FIXTURE = join(
  process.cwd(),
  'docs/real-data/_phase4823_live_evidence/live-official-website-80.html',
);

function loadFixture(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

describe('phase4841 title normalization', () => {
  it('removes Bootshaus Club suffix', () => {
    const result = normalizeOfficialPageTitle(
      'Bootshaus Sommerfest | Bootshaus Club',
      bootshausProviderAdapter.titleSuffixPatterns,
    );
    expect(result.normalizedTitle).toBe('Bootshaus Sommerfest');
    expect(result.rawTitle).toContain('| Bootshaus Club');
  });

  it('removes suffix from R3HAB title', () => {
    const result = normalizeOfficialPageTitle(
      'R3HAB pres. by BOOTSHAUS | Bootshaus Club',
      bootshausProviderAdapter.titleSuffixPatterns,
    );
    expect(result.normalizedTitle).toBe('R3HAB pres. by BOOTSHAUS');
  });

  it('preserves provider name when part of legitimate event title', () => {
    const result = normalizeOfficialPageTitle(
      'R3HAB pres. by BOOTSHAUS',
      bootshausProviderAdapter.titleSuffixPatterns,
    );
    expect(result.normalizedTitle).toBe('R3HAB pres. by BOOTSHAUS');
    expect(result.suffixRemoved).toBe(false);
  });
});

describe('phase4841 description boundaries', () => {
  it('strips footer before whitespace collapse using paragraph blocks', () => {
    const html = `
      <div class="event-description-content">
        <p>On September 4th, BOOTSHAUS presents R3HAB on the MAINFLOOR.</p>
        <p>MAINFLOOR:</p><p>R3HAB</p><p>LA FUENTE</p>
        <p>▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔</p>
        <p>Einlass ab 18 Jahren / Age for admission 18 years</p>
        <p>Bootshaus Mobile App:</p>
      </div>
      <button class="event-description-toggle"></button>
    `;
    const result = extractDescriptionBoundariesFromHtml(html);
    expect(result.contentBlocks.join(' ')).toContain('September 4th');
    expect(result.contentBlocks.join(' ')).toContain('R3HAB');
    expect(result.removedBlocks.length).toBeGreaterThan(0);
    expect(result.normalizedDescription).not.toContain('Einlass ab 18');
    expect(result.normalizedDescription).not.toContain('Mobile App');
    expect(result.normalizedDescription).not.toContain('August 7th');
  });

  it('does not treat door time as age restriction footer', () => {
    const result = applyDescriptionBoundaries(['Einlass ab 22:00 Uhr', 'STRICT DRESSCODE']);
    expect(result.contentBlocks).toContain('Einlass ab 22:00 Uhr');
    expect(result.removedBlocks).toHaveLength(0);
  });

  it('strips age restriction footer blocks', () => {
    const result = applyDescriptionBoundaries([
      'Event prose',
      'Einlass ab 18 Jahren / Age for admission 18 years',
    ]);
    expect(result.contentBlocks).toEqual(['Event prose']);
    expect(result.removedBlocks.some((b) => b.reason.includes('age'))).toBe(true);
  });

  it('handles inline divider in paragraph', () => {
    const result = applyDescriptionBoundaries([
      'DAVE REPLAY ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
      'Einlass ab 18 Jahren',
    ]);
    expect(result.contentBlocks).toEqual(['DAVE REPLAY']);
    expect(result.removedBlocks.some((b) => b.reason.includes('divider'))).toBe(true);
  });
});

describe('phase4841 lineup extraction', () => {
  it('parses MAINFLOOR lineup from R3HAB fixture', () => {
    const html = loadFixture(R3HAB_FIXTURE);
    const blocks = extractDescriptionBoundariesFromHtml(html).contentBlocks;
    const lineup = extractLineupFromContentBlocks(blocks);
    expect(lineup.state).toBe('explicit_artists');
    expect(lineup.entries.map((e) => e.displayName)).toEqual([
      'R3HAB',
      'LA FUENTE',
      'OLIVER MAGENTA',
      'RELOVA',
      'DAVE REPLAY',
    ]);
    expect(lineup.entries[0]?.stage).toBe('MAINFLOOR');
  });

  it('returns TBA state for Sommerfest without fake artist', () => {
    const html = loadFixture(SOMMERFEST_FIXTURE);
    const blocks = extractDescriptionBoundariesFromHtml(html).contentBlocks;
    const lineup = extractLineupFromContentBlocks(blocks);
    expect(lineup.state).toBe('tba');
    expect(lineup.entries).toHaveLength(0);
  });

  it('preserves B2B billing in lineup line', () => {
    const lineup = extractLineupFromContentBlocks(['MAINFLOOR:', 'BRANDON b2b SAM COLLINS']);
    expect(lineup.entries.length).toBeGreaterThanOrEqual(2);
    expect(lineup.entries.some((e) => e.isB2b)).toBe(true);
  });
});

describe('phase4841 venue evidence', () => {
  it('does not infer Bootshaus venue for Sommerfest', () => {
    const html = loadFixture(SOMMERFEST_FIXTURE);
    const detail = extractDetailPage(html, 'https://bootshaus.tv/events/bootshaus-sommerfest');
    expect(detail.venue?.venueName).not.toBe('Bootshaus');
    expect(detail.venue).toBeUndefined();
  });

  it('may emit Bootshaus venue for R3HAB when explicitly proven on page', () => {
    const html = loadFixture(R3HAB_FIXTURE);
    const detail = extractDetailPage(html, 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus');
    expect(detail.venue?.venueName).toBe('Bootshaus');
  });
});

describe('phase4841 ticket ownership', () => {
  it('extracts ticket CTA but does not claim price fields', () => {
    const html = loadFixture(R3HAB_FIXTURE);
    const result = runUnifiedWebsiteImport({
      context: buildImportContextFromRef({
        key: 'r3hab',
        eventId: 'evt-test',
        websiteUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
      }),
      html,
      fetchMeta: { status: 200, finalUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus' },
    });
    expect(result.fieldEvidenceCandidates.some((c) => c.fieldName === 'ticket_destination_candidate')).toBe(
      true,
    );
    expect(result.fieldEvidenceCandidates.some((c) => String(c.fieldName).includes('price'))).toBe(false);
    expect(extractTicketUrl(html).url).toMatch(/ticket\.io/);
  });
});

describe('phase4841 R3HAB integration', () => {
  it('produces clean description from live fixture', () => {
    const html = loadFixture(R3HAB_FIXTURE);
    const result = extractEventDescription(html);
    expect(result.description).toContain('September 4th');
    expect(result.description).not.toContain('August 7th');
    expect(result.description).not.toContain('bit.ly');
    expect(result.description).not.toContain('Mobile App');
    expect(result.description).not.toMatch(/▔{4,}/);
  });
});
