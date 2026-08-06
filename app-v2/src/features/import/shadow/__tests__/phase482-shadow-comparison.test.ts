import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractBootshausGenresFromHtml } from '@/features/import/adapters/extractors/official-page-genres';
import {
  extractOfficialWebsitePublicTruth,
  valuesSemanticallyEqual,
} from '@/features/import/shadow/official-website-public-truth';
import { classifyShadowFieldComparison } from '@/features/import/shadow/shadow-field-comparison';

const FIXTURE = join(
  process.cwd(),
  'src/features/aggregation/connectors/website/__tests__/fixtures/bootshaus-event-detail.html',
);

describe('phase482 shadow comparison', () => {
  it('classifies unified better when legacy diverges from public truth', () => {
    const status = classifyShadowFieldComparison({
      field: 'description',
      publicTruth: 'Official body text about the event.',
      unified: 'Official body text about the event.',
      legacy: 'Doors: 22:00',
      canonical: 'Doors: 22:00',
    });
    expect(status).toBe('UNIFIED_BETTER');
  });

  it('classifies public source has no field when all empty', () => {
    const status = classifyShadowFieldComparison({
      field: 'description',
      publicTruth: undefined,
      unified: undefined,
      legacy: undefined,
    });
    expect(status).toBe('PUBLIC_SOURCE_HAS_NO_FIELD');
  });

  it('extracts bootshaus genres from tag container when present', () => {
    const html = `
      <div class="genres-container">
        <div class="tag-item"><div class="tag-title">Techno</div></div>
        <div class="tag-item"><div class="tag-title">House</div></div>
      </div>
    `;
    expect(extractBootshausGenresFromHtml(html)).toEqual(['Techno', 'House']);
  });

  it('replay public truth extraction is deterministic', () => {
    let html = '';
    try {
      html = readFileSync(FIXTURE, 'utf8');
    } catch {
      html = '<html><meta property="og:title" content="Test Event"/></html>';
    }
    const a = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/test');
    const b = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/test');
    expect(a).toEqual(b);
  });

  it('ignores formatting-only description differences', () => {
    expect(
      valuesSemanticallyEqual('Line one.\n\nLine two.', 'Line one. Line two.'),
    ).toBe(true);
  });
});
