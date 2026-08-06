import { describe, expect, it } from 'vitest';

import { ExplicitTextFlyerOcrProvider } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-ocr-provider';
import { classifyStructuredFlyerEvidence } from '@/features/aggregation/connectors/framework/detail-extraction/structured-flyer-evidence';

describe('phase475 flyer evidence', () => {
  it('extracts explicit description lineup text without external OCR', async () => {
    const provider = new ExplicitTextFlyerOcrProvider();
    const result = await provider.extract({
      eventId: 'evt-test',
      title: 'Test Event',
      imageUrl: 'https://example.com/flyer.jpg',
      description: 'LINEUP:\nBRANDON B2B SAM COLLINS\nOLIVER MAGENTA B2B LOST IDENTITY',
    });
    expect(result.status).toBe('text_extracted');
    expect(result.rawText).toContain('BRANDON');
    expect(result.rawText).toContain('SAM COLLINS');
    expect(result.source).toBe('explicit_description');
  });

  it('queues external OCR when only artwork is available', async () => {
    const provider = new ExplicitTextFlyerOcrProvider();
    const result = await provider.extract({
      eventId: 'evt-test',
      title: 'Test Event',
      imageUrl: 'https://example.com/flyer.jpg',
    });
    expect(result.status).toBe('pending_external');
  });

  it('classifies high-confidence flyer evidence for auto-publish eligibility', () => {
    const evidence = classifyStructuredFlyerEvidence({
      eventId: 'evt-test',
      imageUrl: 'https://example.com/flyer.jpg',
      ocr: {
        providerId: 'explicit_text_v1',
        providerVersion: '1.0.0',
        status: 'text_extracted',
        source: 'explicit_description',
        rawText: 'BRANDON B2B SAM COLLINS\nOLIVER MAGENTA B2B LOST IDENTITY',
        confidence: 0.9,
        reason: 'description_lineup_section',
      },
      eventTitle: 'Bootshaus on a Ship Vol. III',
    });
    expect(evidence.artistCount).toBeGreaterThan(0);
    expect(evidence.reviewDecision).toBe('auto_publish');
    expect(evidence.autoPublishAllowed).toBe(true);
  });

  it('routes low-confidence OCR to review', () => {
    const evidence = classifyStructuredFlyerEvidence({
      eventId: 'evt-test',
      imageUrl: 'https://example.com/flyer.jpg',
      ocr: {
        providerId: 'explicit_text_v1',
        providerVersion: '1.0.0',
        status: 'text_extracted',
        source: 'explicit_import_lineup',
        rawText: 'MYSTERY GUEST',
        confidence: 0.5,
        reason: 'weak_signal',
      },
    });
    expect(evidence.reviewDecision).toBe('review_required');
    expect(evidence.autoPublishAllowed).toBe(false);
  });
});
