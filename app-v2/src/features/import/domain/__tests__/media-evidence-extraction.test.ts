import { describe, expect, it } from 'vitest';

import type { MediaVisionOcrResult } from '@/features/aggregation/connectors/framework/detail-extraction/media-vision-ocr-provider';
import { buildCanonicalEventFromVerifiedPublicEvidence } from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import {
  compactLineupArtistIdentityKey,
  dedupeLineupEvidenceEntries,
} from '@/features/import/domain/golden-content-quality-gate';
import { extractEventMediaEvidence } from '@/features/import/domain/media-evidence-extractor';
import {
  mergeOfficialAndMediaGenreEvidence,
  mergeOfficialAndMediaLineupEvidence,
} from '@/features/import/domain/media-lineup-merge';
import type { EventMediaEvidence } from '@/features/import/domain/media-evidence-types';

const VERIFIED_AT = '2026-08-12T15:14:45.485Z';

const LOONYLAND_OCR: MediaVisionOcrResult = {
  providerId: 'fixture_vision_v1',
  providerVersion: '1.0.0',
  status: 'text_extracted',
  source: 'external_ocr',
  confidence: 0.95,
  reason: 'fixture',
  rawText: `MAINFLOOR
LUCA DANTE SPADAFORA
2 ENGEL & CHARLIE
OLIVER MAGENTA
DJ OLDE
JEY AUX PLATINES`,
  structuredLineup: [
    { displayName: 'LUCA DANTE SPADAFORA', evidenceRole: 'headliner' },
    { displayName: '2 ENGEL & CHARLIE', evidenceRole: 'compound_act' },
    { displayName: 'OLIVER MAGENTA', evidenceRole: 'artist' },
    { displayName: 'DJ OLDE', evidenceRole: 'artist' },
    { displayName: 'JEY AUX PLATINES', evidenceRole: 'artist' },
  ],
};

function buildLoonylandMediaEvidence(): EventMediaEvidence {
  return {
    sourceImageUrl: 'https://example.com/loonyland.png',
    imageFingerprint: 'fixture-loonyland-fingerprint',
    observedAt: VERIFIED_AT,
    extractionObservedAt: VERIFIED_AT,
    extractionProvider: 'fixture_vision_v1',
    rawText: LOONYLAND_OCR.rawText,
    lineupCandidates: LOONYLAND_OCR.structuredLineup!.map((entry) => ({
      displayName: entry.displayName,
      rawText: entry.displayName,
      confidence: 0.95,
      evidenceRole: entry.evidenceRole as 'headliner' | 'artist' | 'compound_act',
    })),
    genreCandidates: [],
    rejectedCandidates: [],
    confidence: 0.95,
    status: 'extracted',
  };
}

describe('media evidence extraction', () => {
  it('extracts Loonyland lineup from structured vision OCR fixture', async () => {
    const evidence = await extractEventMediaEvidence({
      sourceImageUrl: 'https://example.com/loonyland.png',
      observedAt: VERIFIED_AT,
      eventTitle: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
      ocrOverride: LOONYLAND_OCR,
    });

    expect(evidence.status).toBe('extracted');
    expect(evidence.lineupCandidates.map((entry) => entry.displayName)).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
  });
});

describe('media/official lineup merge', () => {
  it('deduplicates Luca Dante spelling variants and preserves compound act', () => {
    const merged = mergeOfficialAndMediaLineupEvidence({
      officialEntries: [],
      mediaEvidence: buildLoonylandMediaEvidence(),
    });
    const names = merged.entries.map((entry) => entry.displayName);
    expect(names).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);

    const withDuplicate = mergeOfficialAndMediaLineupEvidence({
      officialEntries: [
        {
          sortOrder: 0,
          displayName: 'LUCA DANTE SPADA FORA',
          rawSourceSpelling: 'LUCA DANTE SPADA FORA',
          normalizedName: 'luca dante spada fora',
          billingRelation: 'HEADLINER',
          isB2b: false,
          isF2f: false,
          isLiveSet: false,
          confidence: 0.9,
          reviewState: 'accepted',
          inclusionReason: 'structured_text',
        },
      ],
      mediaEvidence: buildLoonylandMediaEvidence(),
    });
    const deduped = dedupeLineupEvidenceEntries(withDuplicate.entries);
    expect(
      deduped.filter(
        (entry) => compactLineupArtistIdentityKey(entry.displayName) === 'lucadantespadafora',
      ).length,
    ).toBe(1);
  });

  it('keeps Chris Stussy single when media duplicates title headliner', () => {
    const media: EventMediaEvidence = {
      ...buildLoonylandMediaEvidence(),
      lineupCandidates: [
        {
          displayName: 'CHRIS STUSSY',
          rawText: 'CHRIS STUSSY',
          confidence: 0.9,
          evidenceRole: 'headliner',
        },
      ],
    };
    const merged = mergeOfficialAndMediaLineupEvidence({
      officialEntries: [
        {
          sortOrder: 0,
          displayName: 'CHRIS STUSSY',
          rawSourceSpelling: 'CHRIS STUSSY',
          normalizedName: 'chris stussy',
          billingRelation: 'HEADLINER',
          isB2b: false,
          isF2f: false,
          isLiveSet: false,
          confidence: 0.95,
          reviewState: 'accepted',
          inclusionReason: 'title_presented_artists',
        },
      ],
      mediaEvidence: media,
    });
    expect(merged.entries.filter((entry) => entry.displayName === 'CHRIS STUSSY').length).toBe(1);
  });
});

describe('media genre evidence', () => {
  it('normalizes explicit flyer genres and rejects artist-derived labels', () => {
    const result = mergeOfficialAndMediaGenreEvidence({
      officialGenres: [],
      mediaEvidence: {
        ...buildLoonylandMediaEvidence(),
        genreCandidates: [
          { rawLabel: 'TECHNO', normalizedLabel: 'Techno', confidence: 0.9 },
          { rawLabel: 'LUCA DANTE SPADAFORA', confidence: 0.5 },
        ],
      },
      artistNames: ['LUCA DANTE SPADAFORA'],
    });
    expect(result.genreLabels).toEqual(['Techno']);
    expect(result.reviewReasons).toContain('genre_inferred_from_artist');
  });
});

describe('golden builder media integration', () => {
  it('builds Loonyland canonical lineup from official media evidence only', () => {
    const build = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: {
        pageUrl: 'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie',
        pageTitle: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        eventDate: '2026-08-21T22:00:00',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        description: 'Events\nLOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE\n\nLine Up:\n">Line-Up\n\nGenres',
        lineupContentBlocks: ['">Line-Up Genres'],
        imageUrl:
          'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/CQYDNRZ9Q8QSS8D/events/6291070957076770600802974_2481970712023930093702944.png',
        verifiedAt: VERIFIED_AT,
      },
      mediaEvidence: buildLoonylandMediaEvidence(),
    });

    const names = build.lineupPatch.entries.map((entry) => entry.displayName);
    expect(names).toEqual([
      'LUCA DANTE SPADAFORA',
      '2 ENGEL & CHARLIE',
      'OLIVER MAGENTA',
      'DJ OLDE',
      'JEY AUX PLATINES',
    ]);
    expect(
      build.lineupPatch.entries.some((entry) => entry.inclusionReason === 'official_media'),
    ).toBe(true);
  });

  it('does not invent Affenkäfig lineup from empty media evidence', () => {
    const build = buildCanonicalEventFromVerifiedPublicEvidence({
      officialEvidence: {
        pageUrl: 'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln',
        pageTitle: 'AFFENKÄFIG RULES // BOOTSHAUS KÖLN',
        eventDate: '2026-10-02T22:00:00',
        venueName: 'Bootshaus',
        venueCity: 'Köln',
        description:
          'Events\nAFFENKÄFIG RULES // BOOTSHAUS KÖLN\n\nLine Up:\nhauen wir euch bald um die Ohren.',
        lineupContentBlocks: ['hauen wir euch bald um die Ohren.'],
        verifiedAt: VERIFIED_AT,
      },
      mediaEvidence: {
        sourceImageUrl: 'https://example.com/affenkaefig.png',
        imageFingerprint: 'affen-fixture',
        observedAt: VERIFIED_AT,
        extractionObservedAt: VERIFIED_AT,
        extractionProvider: 'fixture_vision_v1',
        rawText: 'AFFENKÄFIG RULES\nLINEUP TBA',
        lineupCandidates: [],
        genreCandidates: [],
        rejectedCandidates: [],
        confidence: 0,
        status: 'genres_media_unreadable',
      },
    });
    expect(build.lineupPatch.entries).toEqual([]);
    expect(build.reviewReasons).toContain('lineup_not_announced');
  });
});
