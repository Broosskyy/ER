import { describe, expect, it } from 'vitest';

import { extractContainerOuterBlocks, extractTextContent } from '@/features/aggregation/connectors/website/html-utils';
import { BOOTSHAUS_LIST_FIXTURE_HTML } from '@/features/sources/production/bootshaus-fixture';

describe('bootshaus html container extraction', () => {
  it('finds four upcoming-item containers in fixture', () => {
    const blocks = extractContainerOuterBlocks(BOOTSHAUS_LIST_FIXTURE_HTML, '.upcoming-item');
    expect(blocks.length).toBe(4);
    expect(extractTextContent(blocks[2] ?? '', '.upcoming-title')[0]).toContain('PLAY! Open Air');
    expect(extractTextContent(blocks[2] ?? '', '.date-month')[0]).toBe('Aug');
  });
});
