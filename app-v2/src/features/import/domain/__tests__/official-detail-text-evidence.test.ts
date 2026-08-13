import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import {
  mapOfficialRawToVerifiedEvidence,
  runBootshausGoldenImportPath,
} from '@/features/import/domain/bootshaus-golden-import-path';
import {
  buildLineupContentBlocksFromOfficialText,
  extractOfficialDetailTextEvidence,
} from '@/features/import/domain/official-detail-text-evidence';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';

const VERIFIED_AT = '2026-08-13T10:04:22.751Z';
const LOONYLAND_URL =
  'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie';

const LOONYLAND_STRUCTURED_HTML = `
<div class="event-description-content">
  <p>Let's go Loony... We're back on the MAINFLOOR.</p>
  <p>MAINFLOOR:</p>
  <p>LUCA DANTE SPADAFORA</p>
  <p>2 ENGEL &amp; CHARLIE</p>
  <p>OLIVER MAGENTA</p>
  <p>DJ OLDE</p>
  <p>JEY AUX PLATINES</p>
</div>
<button class="event-description-toggle"></button>
`.trim();

function readOptionalFetchedHtml(key: string): string | undefined {
  const path = join(process.cwd(), `.tmp/official-detail-fetch/${key}.html`);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

describe('official detail text evidence', () => {
  it('extracts MAINFLOOR paragraph blocks without collapsing HTML first', () => {
    const evidence = extractOfficialDetailTextEvidence(LOONYLAND_STRUCTURED_HTML);
    expect(evidence.lineupContentBlocks).toEqual([
      "Let's go Loony... We're back on the MAINFLOOR.",
      'MAINFLOOR:',
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
    expect(evidence.description).toContain('MAINFLOOR');
  });

  it('keeps compound billing intact in final golden path lineup', () => {
    const officialRecord = createBootshausProductionSourceRecord();
    const importSource = mapSourceRecordToImportSource(officialRecord);
    const raw = {
      externalId: LOONYLAND_URL,
      importId: LOONYLAND_URL,
      sourceUrl: LOONYLAND_URL,
      title: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
      description: 'Events\nLOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE\n\nLine Up:\n">Line-Up\n\nGenres',
      startDate: '2026-08-21T22:00:00',
      rawSourceType: 'unknown' as const,
      sourceMetadata: {
        officialDetailHtml: LOONYLAND_STRUCTURED_HTML,
      },
    };
    const verified = mapOfficialRawToVerifiedEvidence(raw, importSource, VERIFIED_AT);
    const result = runBootshausGoldenImportPath({
      officialRawEvents: [raw],
      ticketRawEvents: [],
      officialImportSource: importSource,
      verifiedAt: VERIFIED_AT,
    });

    expect(verified?.lineupContentBlocks).toContain('2 ENGEL & CHARLIE');
    expect(result.matrix[0]?.lineup).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
  });

  it('rejects lineup chrome descriptions without inventing blocks', () => {
    expect(
      buildLineupContentBlocksFromOfficialText({
        description: 'Events\nLOONYLAND\n\nLine Up:\n">Line-Up\n\nGenres',
      }),
    ).toEqual([]);
  });

  it('matches fetched loonyland detail html when present locally', () => {
    const fetched = readOptionalFetchedHtml('loonyland');
    if (!fetched) {
      return;
    }
    const evidence = extractOfficialDetailTextEvidence(fetched);
    const acts = evidence.lineupContentBlocks.filter((block) =>
      /^(LUCA DANTE SPADAFORA|2 ENGEL & CHARLIE|OLIVER MAGENTA|DJ OLDE|JEY AUX PLATINES)$/i.test(block),
    );
    expect(acts).toHaveLength(5);
  });
});
