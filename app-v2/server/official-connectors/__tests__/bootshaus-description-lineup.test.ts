import { describe, expect, it } from 'vitest';

import {
  cleanDescriptionParagraphs,
  containsForbiddenDescriptionContent,
  isAddressFooterParagraph,
  isAppPromoParagraph,
  isMerchPromoParagraph,
  isStandaloneUrlParagraph,
  isTicketCtaParagraph,
  splitDescriptionAndLineupBlocks,
  stripTrailingFooterParagraphs,
  truncateDescriptionBeforeStructuredFloorList,
} from '../bootshaus/parse-description';
import { parseBootshausLineupParagraphs } from '../bootshaus/parse-lineup';
import {
  BOOTSHAUS_AFFENKAEFIG_FRAGMENT,
  BOOTSHAUS_DETAIL_FRAGMENT,
} from './fixtures/bootshaus-fragments';
import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import { createEmptyConnectorCounters } from '../types';

describe('bootshaus description cleanup', () => {
  it('keeps editorial event text', () => {
    const clean = cleanDescriptionParagraphs([
      "Let's go Loony... We're back on the MAINFLOOR.",
      'On August 21st, LOONYLAND returns to Bootshaus with artists and more.',
    ]);

    expect(clean).toContain('MAINFLOOR');
    expect(clean).toContain('LOONYLAND returns to Bootshaus');
  });

  it('removes footer address lines', () => {
    expect(isAddressFooterParagraph('Bootshaus / Auenweg 173 / 51063 Cologne')).toBe(true);
    const clean = cleanDescriptionParagraphs([
      'Editorial sentence about the night.',
      'Bootshaus / Auenweg 173 / 51063 Cologne',
    ]);
    expect(clean).toBe('Editorial sentence about the night.');
  });

  it('removes Bootshaus app promo and links', () => {
    expect(isAppPromoParagraph('Bootshaus Mobile App:')).toBe(true);
    expect(isStandaloneUrlParagraph('https://bit.ly/Bootshaus-App')).toBe(true);
    const clean = cleanDescriptionParagraphs([
      'Real event copy.',
      'Bootshaus Mobile App:',
      'https://bit.ly/Bootshaus-App',
    ]);
    expect(clean).toBe('Real event copy.');
  });

  it('removes merchandise promo and links', () => {
    expect(isMerchPromoParagraph('Bootshaus Merchandise')).toBe(true);
    expect(isStandaloneUrlParagraph('https://snash.com/kollektionen/bootshaus/')).toBe(true);
    const clean = cleanDescriptionParagraphs([
      'Real event copy.',
      'Bootshaus Merchandise',
      'https://snash.com/kollektionen/bootshaus/',
    ]);
    expect(clean).toBe('Real event copy.');
  });

  it('removes pure ticket call-to-action blocks', () => {
    expect(
      isTicketCtaParagraph(
        'Early Bird Tickets sind jetzt verfügbar – nur für kurze Zeit.',
      ),
    ).toBe(true);
    expect(
      isTicketCtaParagraph('Sichert euch so lange die vergünstigten Tickets im Shop.'),
    ).toBe(true);
    const clean = cleanDescriptionParagraphs([
      'AFFENKÄFIG RULES! BOOTSHAUS – FULL HOUSE!',
      'Early Bird Tickets sind jetzt verfügbar – nur für kurze Zeit.',
    ]);
    expect(clean).toBe('AFFENKÄFIG RULES! BOOTSHAUS – FULL HOUSE!');
  });

  it('removes multiple consecutive footer blocks', () => {
    const split = splitDescriptionAndLineupBlocks(
      stripTrailingFooterParagraphs([
        'Editorial intro.',
        '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
        'Einlass ab 18 Jahren / Age for admission 18 years',
        'Bootshaus / Auenweg 173 / 51063 Cologne',
        'Bootshaus Mobile App:',
        'https://bit.ly/Bootshaus-App',
        'Bootshaus Merchandise',
        'https://snash.com/kollektionen/bootshaus/',
      ]),
    );

    expect(split.descriptionParagraphs).toEqual(['Editorial intro.']);
    expect(cleanDescriptionParagraphs(split.descriptionParagraphs)).toBe('Editorial intro.');
  });

  it('keeps MAINFLOOR inside an editorial sentence', () => {
    const clean = cleanDescriptionParagraphs([
      "Let's go Loony... We're back on the MAINFLOOR.",
    ]);
    expect(clean).toContain('MAINFLOOR');
  });

  it('keeps artist names inside editorial sentences', () => {
    const clean = cleanDescriptionParagraphs([
      'On August 21st, LOONYLAND returns with LUCA DANTE SPADAFORA, 2 ENGEL & CHARLIE and more.',
    ]);
    expect(clean).toContain('2 ENGEL & CHARLIE');
  });

  it('keeps emojis inside editorial event text', () => {
    const clean = cleanDescriptionParagraphs(['AFFENKÄFIG RULES! BOOTSHAUS – FULL HOUSE! 🐒🔥']);
    expect(clean).toContain('🐒🔥');
  });

  it('does not place structured lineup blocks into descriptionClean', () => {
    const split = splitDescriptionAndLineupBlocks([
      'Intro text',
      'MAINFLOOR:',
      'ALPHA & BETA',
      'DJ GAMMA',
    ]);

    expect(split.descriptionParagraphs).toEqual(['Intro text']);
    expect(split.lineupParagraphs).toEqual(['ALPHA & BETA', 'DJ GAMMA']);
    expect(cleanDescriptionParagraphs(split.descriptionParagraphs)).toBe('Intro text');
  });

  it('does not empty a page that still has editorial description text', () => {
    const evidence = parseBootshausDetailPage(
      BOOTSHAUS_DETAIL_FRAGMENT,
      'https://bootshaus.tv/events/sample-event/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    expect(evidence.descriptionClean).toContain('LOONYLAND returns to Bootshaus');
    expect(evidence.descriptionClean).not.toContain('bit.ly/Bootshaus-App');
    expect(evidence.descriptionClean).not.toContain('Auenweg 173');
    expect(containsForbiddenDescriptionContent(evidence.descriptionClean)).toBe(false);
  });

  it('stays honestly empty when no editorial description exists', () => {
    const split = splitDescriptionAndLineupBlocks(['MAINFLOOR:', 'ONLY ARTIST']);
    expect(cleanDescriptionParagraphs(split.descriptionParagraphs)).toBe('');
    expect(parseBootshausLineupParagraphs(split.lineupParagraphs).lineupCandidates).toHaveLength(1);
  });

  it('removes structured floor lists from editorial description paragraphs', () => {
    const truncated = truncateDescriptionBeforeStructuredFloorList([
      'Editorial intro.',
      'Mainfloor:',
      'RAN-D',
    ]);

    expect(truncated).toEqual(['Editorial intro.']);
  });
    const evidence = parseBootshausDetailPage(
      BOOTSHAUS_AFFENKAEFIG_FRAGMENT,
      'https://bootshaus.tv/events/any-slug-here/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    expect(evidence.descriptionClean).toContain('AFFENKÄFIG RULES');
    expect(evidence.descriptionClean).not.toContain('Early Bird');
    expect(evidence.descriptionClean).not.toContain('vergünstigten Tickets');
    expect(evidence.descriptionClean).not.toContain('Auenweg 173');
  });
});

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
});
