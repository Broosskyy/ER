import { describe, expect, it } from 'vitest';

import {
  expandLineupArtistName,
  expandLineupLine,
  expandSegmentedLineupNames,
  isCollapsedLineupArtistName,
  splitLineupTextIntoLines,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';

describe('lineup billing parser (Phase 4.6.7)', () => {
  it('splits B2B pairs into individual artists', () => {
    expect(expandLineupLine('BRANDON b2b SAM COLLINS')).toEqual([
      { displayName: 'BRANDON', isB2b: true, role: 'b2b' },
      { displayName: 'SAM COLLINS', isB2b: true, role: 'b2b' },
    ]);
  });

  it('splits F2F pairs case-insensitively', () => {
    expect(expandLineupArtistName('DYSTOPIA f2f VALKYRIE')).toEqual(['DYSTOPIA', 'VALKYRIE']);
  });

  it('preserves line boundaries from HTML breaks', () => {
    const lines = splitLineupTextIntoLines(
      'Artist A b2b Artist B<br>Artist C b2b Artist D<br>Artist E',
    );
    expect(lines).toHaveLength(3);
    expect(expandSegmentedLineupNames(lines)).toEqual([
      'Artist A',
      'Artist B',
      'Artist C',
      'Artist D',
      'Artist E',
    ]);
  });

  it('detects collapsed artist entities', () => {
    expect(isCollapsedLineupArtistName('BRANDON b2b SAM COLLINS OLIVER MAGENTA')).toBe(true);
    expect(isCollapsedLineupArtistName('LEVI')).toBe(false);
    expect(isCollapsedLineupArtistName('Brandon')).toBe(false);
  });

  it('rejects collapsed names during sanitization', () => {
    const names = sanitizeLineupArtistNames(['BRANDON b2b SAM COLLINS', 'Oliver Magenta']);
    expect(names).toEqual(['BRANDON', 'SAM COLLINS', 'Oliver Magenta']);
  });

  it('extracts segmented lineup from multiline description blocks', () => {
    const description = `Line Up:
Brandon b2b Sam Collins
Oliver Magenta b2b Lost Identity
Dave Replay
Emin
Alukes
Makla`;
    const names = extractLineupNamesFromDescriptionText(description);
    expect(names).toEqual([
      'Brandon',
      'Sam Collins',
      'Oliver Magenta',
      'Lost Identity',
      'Dave Replay',
      'Emin',
      'Alukes',
      'Makla',
    ]);
  });

  it('expands collapsed b2b rows from multiline ship lineup', () => {
    const description = `Line Up:
Brandon b2b Sam Collins
Oliver Magenta b2b Lost Identity
Dave Replay b2b Emin
Alukes b2b Makla`;
    expect(extractLineupNamesFromDescriptionText(description)).toEqual([
      'Brandon',
      'Sam Collins',
      'Oliver Magenta',
      'Lost Identity',
      'Dave Replay',
      'Emin',
      'Alukes',
      'Makla',
    ]);
  });

  it('does not invent support acts for hosted-by lines', () => {
    expect(expandLineupLine('Hosted by: Bootshaus')).toEqual([]);
  });

  it('does not heuristically split unknown ALL CAPS tokens', () => {
    expect(expandLineupArtistName('HYPNOTIZED')).toEqual(['HYPNOTIZED']);
    expect(expandLineupArtistName('STIMULATE')).toEqual(['STIMULATE']);
    expect(expandLineupArtistName('COLLINSOLIVER')).toEqual(['COLLINSOLIVER']);
  });

  it('preserves separate artists when HTML line breaks exist in lineup block', () => {
    const description = `Line Up:
BRANDON b2b SAM COLLINS
OLIVER MAGENTA b2b LOST IDENTITY
DAVE REPLAY b2b EMIN
ALUKES b2b MAKLA`;
    expect(extractLineupNamesFromDescriptionText(description)).toEqual([
      'BRANDON',
      'SAM COLLINS',
      'OLIVER MAGENTA',
      'LOST IDENTITY',
      'DAVE REPLAY',
      'EMIN',
      'ALUKES',
      'MAKLA',
    ]);
  });

  it('stops lineup extraction before footer divider blocks', () => {
    const description =
      'Line Up:\nBRANDON b2b SAM COLLINS\nOLIVER MAGENTA\nMAKLA▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren';
    expect(extractLineupNamesFromDescriptionText(description)).toEqual([
      'BRANDON',
      'SAM COLLINS',
      'OLIVER MAGENTA',
      'MAKLA',
    ]);
  });
});
