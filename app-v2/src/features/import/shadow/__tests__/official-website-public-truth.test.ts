import { describe, expect, it } from 'vitest';

import { extractOfficialWebsitePublicTruth } from '@/features/import/shadow/official-website-public-truth';

const BC173_TITLE = "Bootshaus pres. BC173 (let's get loco)";

function metaTag(attrs: string): string {
  return `<!DOCTYPE html><html><head>${attrs}</head><body></body></html>`;
}

describe('extractOfficialWebsitePublicTruth meta parsing', () => {
  it('reads double-quoted content with apostrophe (BC173)', () => {
    const html = metaTag(
      `<meta property="og:title" content="${BC173_TITLE}" />`,
    );
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/bc173/');
    expect(truth.title).toBe(BC173_TITLE);
  });

  it('reads single-quoted content with double quotes inside', () => {
    const html = metaTag(`<meta property="og:title" content='Artist &quot;Special&quot;' />`);
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/');
    expect(truth.title).toBe('Artist "Special"');
  });

  it('decodes &#39; and &apos; inside content', () => {
    const html = metaTag(
      `<meta property="og:title" content="Bootshaus pres. BC173 (let&#39;s get loco)" />`,
    );
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/bc173/');
    expect(truth.title).toBe(BC173_TITLE);
  });

  it('reads content attribute before property', () => {
    const html = metaTag(
      `<meta content="${BC173_TITLE}" property="og:title" />`,
    );
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/bc173/');
    expect(truth.title).toBe(BC173_TITLE);
  });

  it('reads og:title via name attribute', () => {
    const html = metaTag(`<meta name="og:title" content="${BC173_TITLE}" />`);
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/bc173/');
    expect(truth.title).toBe(BC173_TITLE);
  });

  it('does not bleed into the next meta tag', () => {
    const html = metaTag(
      `<meta property="og:title" content="${BC173_TITLE}" />
       <meta property="og:description" content="Next tag must stay separate" />`,
    );
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/bc173/');
    expect(truth.title).toBe(BC173_TITLE);
    expect(truth.title).not.toContain('Next tag');
  });

  it('treats attribute names case-insensitively', () => {
    const html = metaTag(`<meta PROPERTY="OG:TITLE" CONTENT="${BC173_TITLE}" />`);
    const truth = extractOfficialWebsitePublicTruth(html, 'https://bootshaus.tv/events/bc173/');
    expect(truth.title).toBe(BC173_TITLE);
  });
});
