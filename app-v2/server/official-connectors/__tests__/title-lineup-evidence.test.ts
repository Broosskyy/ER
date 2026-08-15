import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildBootshausMediaEvidenceContext } from '../bootshaus/build-bootshaus-media-evidence';
import {
  buildBootshausOfficialEvidenceWithMedia,
  loadBootshausPreviewEntries,
} from '../bootshaus/build-bootshaus-media-evidence';
import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import { reconcileOfficialAndMediaEvidence } from '../media-evidence/reconcile-evidence';
import {
  extractVerifiedTitleLineupCandidates,
  mergeTitleLineupCandidates,
} from '../shared/title-lineup-evidence';
import { createEmptyConnectorCounters } from '../types';

describe('official title lineup evidence', () => {
  it('extracts VERTILE from presenter-show title without publishing show fragments', () => {
    const textEvidence = parseBootshausDetailPage(
      '<html><body><div class="upcoming-title">VERTILE pres. EVERYTHING CHANGES -LIVE- @ BOOTSHAUS!</div></body></html>',
      'https://bootshaus.tv/events/vertile-pres-everything-changes-live-at-bootshaus/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );
    const context = buildBootshausMediaEvidenceContext(textEvidence);
    const extracted = extractVerifiedTitleLineupCandidates({
      eventTitle: textEvidence.title,
      organizerLabel: textEvidence.organizerLabel,
      validationContext: { mediaContext: context },
    });

    expect(extracted.candidates.map((act) => act.displayName)).toEqual(['VERTILE']);
    expect(extracted.candidates[0]?.evidenceOrigin).toBe('official_title');
    expect(extracted.showTitleFragmentKeys.has('everything')).toBe(true);
    expect(extracted.showTitleFragmentKeys.has('changes')).toBe(true);
  });

  it('preserves verified title artist through reconciliation when text and media are empty', () => {
    const textEvidence = parseBootshausDetailPage(
      readFileSync(
        '.tmp/m3-bootshaus-cache/details/vertile-pres-everything-changes-live-at-bootshaus.html',
        'utf8',
      ),
      'https://bootshaus.tv/events/vertile-pres-everything-changes-live-at-bootshaus/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    const reconciled = reconcileOfficialAndMediaEvidence(
      textEvidence,
      {
        sourceImageUrl: textEvidence.officialImageUrl ?? '',
        imageFingerprint: 'vertile',
        sourceObservedAt: '2026-08-14T12:00:00.000Z',
        extractedAt: '2026-08-14T12:00:00.000Z',
        extractionProvider: 'tesseract-local',
        mediaClassification: 'event_flyer',
        ocrBlocks: [],
        ocrLines: [],
        lineupCandidates: [
          {
            displayName: 'EVERYTHING',
            rawText: 'EVERYTHING',
            confidence: 90,
            evidenceRole: 'artist',
            billingOrder: 0,
          },
          {
            displayName: 'CHANGES',
            rawText: 'CHANGES',
            confidence: 90,
            evidenceRole: 'artist',
            billingOrder: 1,
          },
        ],
        genreCandidates: [],
        rejectedCandidates: [],
        confidence: 90,
      },
      { mediaContext: buildBootshausMediaEvidenceContext(textEvidence) },
    );

    const acts = reconciled.evidence.lineupCandidates.map((act) => act.displayName);
    expect(acts).toEqual(['VERTILE']);
    expect(reconciled.evidence.lineupCandidates[0]?.evidenceOrigin).toBe('official_title');
    expect(acts).not.toContain('EVERYTHING');
    expect(acts).not.toContain('CHANGES');
  });

  it('does not invent artists from show-only organizer presenter titles', () => {
    const extracted = extractVerifiedTitleLineupCandidates({
      eventTitle: 'Bootshaus & Loonyland pres. Halloween 2026',
      organizerLabel: 'LOONYLAND',
    });
    expect(extracted.candidates).toHaveLength(0);
  });

  it('restores vertile in golden cached rebuild', async () => {
    const entries = loadBootshausPreviewEntries().filter((entry) =>
      entry.sourceEventKey.includes('vertile-pres-everything'),
    );
    const { previews } = await buildBootshausOfficialEvidenceWithMedia(entries);
    const preview = previews[0]!;

    expect(preview.lineupCandidates.map((act) => act.displayName)).toEqual(['VERTILE']);
    expect(preview.lineupCandidates[0]?.evidenceOrigin).toBe('official_title');
  });
});

describe('title merge helper', () => {
  it('does not duplicate existing lineup acts', () => {
    const merged = mergeTitleLineupCandidates(
      [
        {
          displayName: 'VERTILE',
          rawText: 'VERTILE',
          billingOrder: 0,
          evidenceRole: 'headliner',
          evidenceOrigin: 'official_text',
        },
      ],
      [
        {
          displayName: 'VERTILE',
          rawText: 'VERTILE',
          billingOrder: 0,
          evidenceRole: 'headliner',
          evidenceOrigin: 'official_title',
        },
      ],
    );

    expect(merged).toHaveLength(1);
  });
});
