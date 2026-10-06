import { describe, expect, it } from 'vitest';

import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { isLineupPlaceholderLine } from '../../shared/lineup-normalization';

describe('lineup coverage placeholders', () => {
  it('rejects folgt as lineup artist', () => {
    expect(isLineupPlaceholderLine('Folgt')).toBe(true);
    expect(isLineupPlaceholderLine('line-up folgt')).toBe(true);
  });
});

describe('lineup recoverable classification logic', () => {
  it('treats placeholder-only canonical lineup as invalid', () => {
    const lineup = ['Folgt'];
    const invalid = lineup.every((name) => isLineupPlaceholderLine(name));
    expect(invalid).toBe(true);
  });
});
