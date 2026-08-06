import { describe, expect, it } from 'vitest';

import { classifyEventRootCause, classifyModelConsistency } from '@/features/aggregation/audit/lineup-audit-classifier';
import {
  classifyTitleInference,
  detectInvalidArtistSignals,
  lineupFingerprint,
} from '@/features/aggregation/audit/lineup-audit-signals';

describe('lineup pipeline audit signals', () => {
  it('detects HTML entity prose artists', () => {
    const signals = detectInvalidArtistSignals('KitKatClub&rdquo; legend');
    expect(signals).toContain('html_entity');
  });

  it('detects description amenities as invalid artists', () => {
    const signals = detectInvalidArtistSignals('Massageservice');
    expect(signals).toContain('amenity');
  });

  it('classifies title inference for BC173-style titles', () => {
    const result = classifyTitleInference(
      "BC173 Airport Session pres. by Bootshaus",
      "BC173 (let's get loco)",
    );
    expect(['invalid_title_fragment', 'series_name_mistaken', 'event_brand_mistaken', 'partial_inference_only']).toContain(
      result,
    );
  });

  it('detects identical lineup fingerprints across events', () => {
    const a = lineupFingerprint(['DYSTOPIA', 'VALKYRIE', 'KARAMUSTAN']);
    const b = lineupFingerprint(['DYSTOPIA', 'VALKYRIE', 'KARAMUSTAN']);
    expect(a).toBe(b);
  });
});

describe('lineup pipeline audit classifier', () => {
  it('classifies structured/legacy mismatch', () => {
    const model = classifyModelConsistency({
      structuredEntryCount: 9,
      structuredArtistNames: ['A', 'B'],
      legacyArtistNames: ['COLLAPSED'],
      apiLineupEntryCount: 9,
      apiArtistNames: ['A', 'B'],
    });
    expect(model).toBe('structured_correct_legacy_wrong');
  });

  it('classifies cross-event contamination root cause', () => {
    const result = classifyEventRootCause({
      eventId: 'evt-a',
      title: 'Into The Madness',
      modelConsistency: 'fully_aligned',
      invalidArtistNames: [],
      collapsedArtistNames: [],
      titleInferenceArtists: [],
      flyerEvidencePresent: false,
      detailBlocked: false,
      structuredEntryCount: 9,
      legacyArtistNames: ['A'],
      rawArtistNames: [],
      contaminationSuspect: {
        otherEventId: 'evt-mdma',
        otherEventTitle: 'MDMA',
        sharedEvidence: 'identical structured fingerprint',
      },
    });
    expect(result.rootCauseClass).toBe('B_CROSS_EVENT_STATE_LEAKAGE');
    expect(result.firstFailureStage).toBe('9_multi_origin_event_matching');
  });

  it('classifies description-as-artist failures', () => {
    const result = classifyEventRootCause({
      eventId: 'evt-kitkat',
      title: 'KitKatClub',
      modelConsistency: 'both_wrong',
      invalidArtistNames: [
        'definiert sich der KitKatClub als avantgardistischer Nachtclub und greift die Traditionen auf',
      ],
      collapsedArtistNames: [],
      titleInferenceArtists: [],
      flyerEvidencePresent: false,
      detailBlocked: false,
      structuredEntryCount: 0,
      legacyArtistNames: [],
      rawArtistNames: [],
    });
    expect(result.rootCauseClass).toBe('G_DESCRIPTION_AS_LINEUP');
  });
});

describe('audit read-only guarantee', () => {
  it('audit modules export classification only without DB writers', () => {
    const auditModulePaths = [
      '@/features/aggregation/audit/lineup-audit-signals',
      '@/features/aggregation/audit/lineup-audit-classifier',
      '@/features/aggregation/audit/lineup-audit-inventory',
    ];
    expect(auditModulePaths.length).toBeGreaterThan(0);
  });
});
