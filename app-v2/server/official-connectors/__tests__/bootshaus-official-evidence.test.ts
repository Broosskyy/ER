import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import {
  isFloorOrStageHeader,
  isLineupIntroMarker,
  mergeOfficialLineupEvidence,
  parseBootshausLineupParagraphs,
  parseExplicitLineupSentences,
  splitDescriptionAndStructuredLineup,
} from '../bootshaus/parse-lineup';
import { normalizeOfficialGenreLabels } from '../bootshaus/normalize-genre';
import { createEmptyConnectorCounters } from '../types';
import {
  BOOTSHAUS_AFFENKAEFIG_FRAGMENT,
  BOOTSHAUS_CHRIS_FRAGMENT,
  BOOTSHAUS_DETAIL_FRAGMENT,
} from './fixtures/bootshaus-fragments';

function parseCachedDetail(sourceEventKey: string) {
  const html = readFileSync(`.tmp/m3-bootshaus-cache/details/${sourceEventKey}.html`, 'utf8');
  return parseBootshausDetailPage(
    html,
    `https://bootshaus.tv/events/${sourceEventKey}/`,
    '2026-08-14T12:00:00.000Z',
    createEmptyConnectorCounters(),
  );
}

describe('bootshaus official lineup evidence', () => {
  it('parses zaagstep full line-up block from cached html', () => {
    const evidence = parseCachedDetail('blacklist-inurfase-pres-zaagstep-by-dr-donk');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'Dr Donk pres. ZAAGSTEP (Album Showcase)',
      'Dr Donk b2b Yoshiko',
      'GPF',
      'Invaderz',
      'Lekkerfaces',
      'Madcore',
      'Must Die!',
      'Revenge Of The Nerds (Albino b2b Dr Donk b2b Ricky West)',
      'TMPR',
    ]);
    expect(evidence.descriptionClean).not.toContain('HIGHLIGHTS');
    expect(evidence.descriptionClean?.length ?? 0).toBeGreaterThan(200);
  });

  it('parses nibirii explicit genres from official description text', () => {
    const evidence = parseCachedDetail('nibirii-festival-2026');
    expect(evidence.explicitGenreLabels).toEqual([
      'Techno',
      'Hard Techno',
      'Psytrance',
      'Groove',
      'Bounce',
      'Drum & Bass',
    ]);
    expect(evidence.descriptionClean).not.toMatch(/\n-\n/);
    expect(evidence.descriptionClean?.trim().endsWith('-')).toBe(false);
  });

  it('recognizes lineup header variants', () => {
    expect(isLineupIntroMarker('Line-Up:')).toBe(true);
    expect(isLineupIntroMarker('LINEUP')).toBe(true);
    expect(isLineupIntroMarker('Artists')).toBe(true);
  });

  it('recognizes floor and stage headers case-insensitively', () => {
    expect(isFloorOrStageHeader('Mainfloor:')).toBe(true);
    expect(isFloorOrStageHeader('MAINFLOOR')).toBe(true);
    expect(isFloorOrStageHeader('Outdoor:')).toBe(true);
    expect(isFloorOrStageHeader('Dreherei by PLAY! Music Label Showcase')).toBe(true);
  });

  it('parses structured floor billing blocks', () => {
    const parsed = parseBootshausLineupParagraphs([
      'Intro',
      'MAINFLOOR:',
      'ALPHA & BETA',
      'DJ GAMMA',
    ]);
    expect(parsed.lineupCandidates.map((act) => act.displayName)).toEqual(['ALPHA & BETA', 'DJ GAMMA']);
  });

  it('parses explicit lineup sentences and merges with floor billing', () => {
    const sentences = parseExplicitLineupSentences([
      'Das Lineup vereint mit Ran-D, Kili b2b Complex, Zelecter, Restrictless und MC Livid zahlreiche Artists.',
      'Ergänzt wird es durch Aversion und Devin Wild, die exklusiv zu erleben sind.',
    ]);
    const floorActs = splitDescriptionAndStructuredLineup([
      'Mainfloor:',
      'RAN-D',
      'DEVIN WILD',
      'AVERSION',
      'KILI b2b COMPLEX',
      'ZELECTER',
      'RESTRICTLESS',
    ]);
    const merged = mergeOfficialLineupEvidence([
      ...sentences,
      ...floorActs.lineupBlocks.flatMap((block, blockIndex) =>
        block.rawLines.map((line, lineIndex) => ({
          displayName: line,
          rawText: line,
          evidenceRole: 'artist' as const,
          blockType: 'floor_billing' as const,
          blockIndex,
          lineIndex,
          confidence: 'high' as const,
        })),
      ),
    ]);
    expect(merged.lineupCandidates.map((act) => act.displayName)).toEqual([
      'RAN-D',
      'KILI b2b COMPLEX',
      'ZELECTER',
      'RESTRICTLESS',
      'MC Livid',
      'AVERSION',
      'DEVIN WILD',
    ]);
  });

  it('does not promote general prose mentions into lineup acts', () => {
    const sentences = parseExplicitLineupSentences([
      'On August 21st, LOONYLAND returns with LUCA DANTE SPADAFORA, 2 ENGEL & CHARLIE and more.',
    ]);
    expect(sentences).toEqual([]);
  });

  it('parses into the madness from cached html with seven acts', () => {
    const evidence = parseCachedDetail('into-the-madness-pre-party-weekender-w-ran-d-and-more');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'RAN-D',
      'KILI b2b COMPLEX',
      'ZELECTER',
      'RESTRICTLESS',
      'MC Livid',
      'AVERSION',
      'DEVIN WILD',
    ]);
    expect(evidence.explicitGenreLabels).toContain('Hardstyle');
  });

  it('parses kaz james line-up block without flyer-only uri-b artifact', () => {
    const evidence = parseCachedDetail('122-pres-kaz-james-at-palma-de-mallorca-es');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual(['KAZ JAMES', 'ALICIA HAHN']);
  });

  it('keeps r3hab lineup and genres stable', () => {
    const evidence = parseCachedDetail('r3hab-pres-by-bootshaus');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'R3HAB',
      'LA FUENTE',
      'OLIVER MAGENTA',
      'RELOVA',
      'DHALI',
      'DAVE REPLAY',
    ]);
    expect(evidence.explicitGenreLabels.length).toBe(6);
  });

  it('parses sommerfest structured floor lineup from cached html', () => {
    const evidence = parseCachedDetail('5-9-26-bootshaus-sommerfest-auf-4-floors');
    expect(evidence.lineupCandidates.length).toBeGreaterThanOrEqual(15);
    expect(evidence.lineupCandidates.some((act) => act.displayName === 'MAX BERING')).toBe(true);
    expect(evidence.lineupCandidates.some((act) => act.displayName === 'MAXCHERRY')).toBe(true);
  });

  it('keeps reference regressions for loonyland, chris and affenkaefig', () => {
    const loonyland = parseBootshausDetailPage(
      BOOTSHAUS_DETAIL_FRAGMENT,
      'https://bootshaus.tv/events/loonyland-pres-luca-dante-spadafora-2-engel-charlie/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );
    const chris = parseBootshausDetailPage(
      BOOTSHAUS_CHRIS_FRAGMENT,
      'https://bootshaus.tv/events/16-10-26-chris-stussy-pres-by-bootshaus/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );
    const affenkaefig = parseBootshausDetailPage(
      BOOTSHAUS_AFFENKAEFIG_FRAGMENT,
      'https://bootshaus.tv/events/affenkaefig-rules-bootshaus-koeln/',
      '2026-08-14T12:00:00.000Z',
      createEmptyConnectorCounters(),
    );

    expect(loonyland.lineupCandidates).toHaveLength(5);
    expect(loonyland.lineupCandidates[1]?.displayName).toBe('2 ENGEL & CHARLIE');
    expect(chris.lineupCandidates.map((act) => act.displayName)).toEqual(['CHRIS STUSSY']);
    expect(affenkaefig.lineupCandidates).toEqual([]);
    expect(affenkaefig.enrichmentGaps).toContain('lineup_not_announced');
  });

  it('recognizes dj lineup intro markers', () => {
    expect(isLineupIntroMarker('DJ LineUp:')).toBe(true);
    expect(isFloorOrStageHeader('DJ LineUp:')).toBe(false);
    expect(isFloorOrStageHeader('ELEMENTS:')).toBe(false);
  });

  it('parses kitkat dj lineup without decor bullets or prose', () => {
    const evidence = parseCachedDetail('sa-22-08-2026-kitkatclub');
    expect(evidence.lineupCandidates.map((act) => act.displayName)).toEqual([
      'Clark Kent',
      'Lucien Foort',
      'Don Basti',
      'AL:PAY',
    ]);
    expect(evidence.descriptionClean?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('bootshaus official genre evidence', () => {
  it('normalizes slash and alias genre labels', () => {
    const result = normalizeOfficialGenreLabels(["DRUM'N'BASS", 'DnB', 'Deep/TechHouse']);
    expect(result.normalized.map((entry) => entry.genreKey)).toEqual(
      expect.arrayContaining(['drum-and-bass', 'deep-tech-house']),
    );
  });

  it('does not publish unknown genre labels without documenting them', () => {
    const result = normalizeOfficialGenreLabels(['TotallyUnknownGenreXYZ']);
    expect(result.unmapped).toHaveLength(1);
    expect(result.normalized).toHaveLength(0);
  });
});
