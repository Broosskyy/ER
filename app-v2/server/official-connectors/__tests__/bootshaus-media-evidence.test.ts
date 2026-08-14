import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import { parseMediaLayoutFromOcr } from '../media-evidence/parse-media-layout';
import { reconcileOfficialAndMediaEvidence } from '../media-evidence/reconcile-evidence';
import { createEmptyConnectorCounters } from '../types';

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
});
