import { describe, expect, it } from 'vitest';

import { deduplicateDescriptionBlocks } from '../deduplicate-description';

describe('deduplicateDescriptionBlocks', () => {
  it('removes repeated semantic paragraphs', () => {
    const paragraph =
      'Opening night teaser with extended event information for the crowd.';
    const input = [paragraph, paragraph, 'Doors open at 22:00 for all ticket holders.'].join('\n\n');
    expect(deduplicateDescriptionBlocks(input)).toBe(
      `${paragraph}\n\nDoors open at 22:00 for all ticket holders.`,
    );
  });

  it('collapses repeated decorative separator blocks', () => {
    const separator = '******************************************';
    const input = ['Intro paragraph.', separator, 'Middle paragraph.', separator, 'Closing paragraph.'].join('\n\n');
    expect(deduplicateDescriptionBlocks(input)).toBe(
      `Intro paragraph.\n\n${separator}\n\nMiddle paragraph.\n\nClosing paragraph.`,
    );
  });
});
