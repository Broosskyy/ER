import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildBootshausMediaEvidenceContext,
  buildBootshausOfficialEvidenceWithMedia,
  loadBootshausPreviewEntries,
} from '../bootshaus/build-bootshaus-media-evidence';
import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import { parseBootshausLineupParagraphs } from '../bootshaus/parse-lineup';
import { parseMediaLayoutFromOcr } from '../media-evidence/parse-media-layout';
import { reconcileOfficialAndMediaEvidence } from '../media-evidence/reconcile-evidence';
import { TESSERACT_RUNTIME_CACHE_DIR } from '../media-evidence/tesseract-media-evidence-provider';
import {
  getIsolatedTitleFragmentKeys,
  isTicketMarketingOrCtaLine,
  sanitizeFinalLineupCandidates,
} from '../shared/lineup-normalization';
import { normalizeOfficialGenreLabel } from '../shared/normalize-genre';
import { createEmptyConnectorCounters } from '../types';

const MEDIA_EVIDENCE_DIR = join('server', 'official-connectors', 'media-evidence');

describe('shared lineup normalization', () => {
  it('rejects ticket marketing and URL lines as lineup acts', () => {
    expect(isTicketMarketingOrCtaLine('✔ 2 HOURS EARLIER ACCESS TO TICKETS')).toBe(true);
    expect(isTicketMarketingOrCtaLine('https://ticket.io/example')).toBe(true);
    expect(isTicketMarketingOrCtaLine('VERTILE')).toBe(false);
  });

  it('rejects isolated title phrase fragments from media-only acts', () => {
    const rejects = getIsolatedTitleFragmentKeys(
      'VERTILE pres. EVERYTHING CHANGES -LIVE- @ BOOTSHAUS!',
      ['EVERYTHING', 'CHANGES'],
    );
    expect(rejects.has('everything')).toBe(true);
    expect(rejects.has('changes')).toBe(true);
  });

  it('sanitizes invalid final lineup entries', () => {
    const sanitized = sanitizeFinalLineupCandidates(
      [
        {
          displayName: 'See you at BOOTSHAUS!',
          rawText: 'See you at BOOTSHAUS!',
          billingOrder: 0,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_text',
        },
        {
          displayName: 'EVERYTHING',
          rawText: 'EVERYTHING',
          billingOrder: 1,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_media',
        },
        {
          displayName: 'CHANGES',
          rawText: 'CHANGES',
          billingOrder: 2,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_media',
        },
      ],
      {
        eventTitle: 'VERTILE pres. EVERYTHING CHANGES -LIVE- @ BOOTSHAUS!',
      },
    );

    expect(sanitized.lineupCandidates).toHaveLength(0);
    expect(sanitized.rejectedCandidates.length).toBeGreaterThan(0);
  });
});

describe('shared genre normalization', () => {
  it('normalizes known genre labels', () => {
    const result = normalizeOfficialGenreLabel('Hardstyle');
    expect(result.status).toBe('normalized');
    expect(result.displayName).toBe('Hardstyle');
  });
});

describe('media evidence source neutrality', () => {
  it('keeps media-evidence free of bootshaus imports and brand hardcodes', () => {
    const files = readdirSync(MEDIA_EVIDENCE_DIR).filter((name) => name.endsWith('.ts'));
    const forbidden = /\bamok\b|\bmallorca\b|\bkitkat\b/i;

    for (const fileName of files) {
      const source = readFileSync(join(MEDIA_EVIDENCE_DIR, fileName), 'utf8');
      expect(source).not.toMatch(/from\s+['"].*bootshaus/);
      expect(source).not.toMatch(forbidden);
    }
  });

  it('stores tesseract runtime cache outside the repository', () => {
    expect(TESSERACT_RUNTIME_CACHE_DIR).not.toContain('app-v2');
    expect(TESSERACT_RUNTIME_CACHE_DIR).not.toMatch(/wt-import-reference-baseline$/);
  });
});

describe('bootshaus media evidence reconciliation', () => {
  it('appends verified media lineup acts without removing text acts', () => {
    const textEvidence = parseBootshausDetailPage(
      '<html><body><div class="upcoming-title">Sample</div><div class="event-description-content"><p>Line-Up:</p><p>KAZ JAMES</p><p>ALICIA HAHN</p></div></body></html>',
      'https://bootshaus.tv/events/122-pres-kaz-james-at-palma-de-mallorca-es/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    const mediaLines = parseMediaLayoutFromOcr(
      [
        { text: 'KAZ JAMES', confidence: 80, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, words: [] },
        { text: 'ALICIA HAHN', confidence: 80, bbox: { x0: 0, y0: 20, x1: 10, y1: 30 }, words: [] },
        { text: 'URI-B', confidence: 80, bbox: { x0: 0, y0: 40, x1: 10, y1: 50 }, words: [] },
      ],
      [],
      buildBootshausMediaEvidenceContext(textEvidence),
    );

    const reconciled = reconcileOfficialAndMediaEvidence(textEvidence, {
      sourceImageUrl: 'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/example.png',
      imageFingerprint: 'abc',
      sourceObservedAt: '2026-08-14T12:00:00.000Z',
      extractedAt: '2026-08-14T12:00:00.000Z',
      extractionProvider: 'tesseract-local',
      mediaClassification: 'event_flyer',
      ocrBlocks: [],
      ocrLines: [],
      lineupCandidates: mediaLines.lineupCandidates,
      genreCandidates: [],
      rejectedCandidates: [],
      confidence: 80,
    });

    expect(reconciled.evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'KAZ JAMES',
      'ALICIA HAHN',
      'URI-B',
    ]);
    expect(reconciled.evidence.lineupCandidates[2]?.evidenceOrigin).toBe('official_media');
  });

  it('does not publish description paragraphs as lineup for kitkat fallback', () => {
    const html = readFileSync(
      '.tmp/m3-bootshaus-cache/details/mi-30-12-2026-kitkatclub.html',
      'utf8',
    );
    const textEvidence = parseBootshausDetailPage(
      html,
      'https://bootshaus.tv/events/mi-30-12-2026-kitkatclub/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    expect(textEvidence.lineupCandidates).toHaveLength(0);
  });

  it('rejects vertile title fragments and ticket marketing from final lineup', async () => {
    const entries = loadBootshausPreviewEntries();
    const target = entries.find((entry) => entry.sourceEventKey.includes('vertile-pres-everything'));
    expect(target).toBeDefined();

    const { previews } = await buildBootshausOfficialEvidenceWithMedia([target!]);
    const preview = previews[0]!;
    const acts = preview.lineupCandidates.map((act) => act.displayName);

    expect(acts).not.toContain('EVERYTHING');
    expect(acts).not.toContain('CHANGES');
    expect(acts.some((act) => /ticket|fase|backstage|see you at/i.test(act))).toBe(false);
  });

  it('keeps existing text lineup for into the madness when media has no extra acts', () => {
    const textEvidence = parseBootshausDetailPage(
      readFileSync(
        '.tmp/m3-bootshaus-cache/details/into-the-madness-pre-party-weekender-w-ran-d-and-more.html',
        'utf8',
      ),
      'https://bootshaus.tv/events/into-the-madness-pre-party-weekender-w-ran-d-and-more/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    const reconciled = reconcileOfficialAndMediaEvidence(textEvidence, {
      sourceImageUrl: textEvidence.officialImageUrl ?? '',
      imageFingerprint: 'into',
      sourceObservedAt: '2026-08-14T12:00:00.000Z',
      extractedAt: '2026-08-14T12:00:00.000Z',
      extractionProvider: 'tesseract-local',
      mediaClassification: 'event_artwork_without_billing',
      ocrBlocks: [],
      ocrLines: [],
      lineupCandidates: [],
      genreCandidates: [],
      rejectedCandidates: [],
      confidence: 70,
    });

    expect(reconciled.evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'RAN-D',
      'KILI b2b COMPLEX',
      'ZELECTER',
      'RESTRICTLESS',
      'MC Livid',
      'AVERSION',
      'DEVIN WILD',
    ]);
    expect(reconciled.evidence.explicitGenreLabels).toContain('Hardstyle');
  });

  it('rejects tba and floor headers from media layout', () => {
    const parsed = parseMediaLayoutFromOcr(
      [
        { text: 'MAINFLOOR:', confidence: 90, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, words: [] },
        { text: 'TBA', confidence: 90, bbox: { x0: 0, y0: 20, x1: 10, y1: 30 }, words: [] },
        { text: 'R3HAB', confidence: 90, bbox: { x0: 0, y0: 40, x1: 10, y1: 50 }, words: [] },
      ],
      [],
    );

    expect(parsed.lineupCandidates.map((act) => act.displayName)).toEqual(['R3HAB']);
    expect(parsed.rejectedCandidates.some((entry) => entry.reason === 'placeholder_not_billing')).toBe(true);
  });

  it('does not dump prose paragraphs into lineup via parseBootshausLineupParagraphs fallback', () => {
    const parsed = parseBootshausLineupParagraphs([
      'Uhrzeit: 22:00 Uhr',
      'Eintritt: 35 Euro',
      'DJ LineUp: to be announced',
    ]);
    expect(parsed.lineupCandidates).toHaveLength(0);
  });
});
