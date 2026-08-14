import { describe, expect, it } from 'vitest';

import { isBoilerplateParagraph, splitDescriptionAndLineupBlocks } from '../bootshaus/parse-description';
import { parseBootshausLineupParagraphs } from '../bootshaus/parse-lineup';

describe('bootshaus description and lineup parsing', () => {
  it('rejects floor headers and keeps compound acts together', () => {
    const { lineupParagraphs } = splitDescriptionAndLineupBlocks([
      'Intro text',
      'MAINFLOOR:',
      'ALPHA & BETA',
    ]);

    const parsed = parseBootshausLineupParagraphs(lineupParagraphs);
    expect(parsed.lineupCandidates.map((act) => act.displayName)).toEqual(['ALPHA & BETA']);
    expect(parsed.rejectedCandidates.some((entry) => entry.reason === 'floor_or_boilerplate')).toBe(
      false,
    );
  });

  it('does not create artists for lineup-not-announced boilerplate', () => {
    const split = splitDescriptionAndLineupBlocks([
      'Event teaser',
      'Das Line Up hauen wir euch bald um die Ohren.',
    ]);
    expect(split.lineupNotAnnounced).toBe(true);
    expect(parseBootshausLineupParagraphs(split.lineupParagraphs).lineupCandidates).toEqual([]);
  });

  it('flags footer and app boilerplate', () => {
    expect(isBoilerplateParagraph('Bootshaus Mobile App:')).toBe(true);
    expect(isBoilerplateParagraph('Einlass ab 18 Jahren')).toBe(true);
  });
});
