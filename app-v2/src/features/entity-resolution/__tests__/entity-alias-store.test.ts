import { describe, expect, it } from 'vitest';

import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import { EntityAliasStoreError } from '@/features/entity-resolution/entity-alias-store-error';
import { normalizeIdentityText } from '@/features/entity-resolution/entity-alias-store';

describe('InMemoryEntityAliasStore persistence rules', () => {
  it('stores aliases idempotently', () => {
    const store = new InMemoryEntityAliasStore();
    const alias = {
      entityType: 'organizer' as const,
      canonicalId: 'org-1',
      aliasType: 'external_id' as const,
      aliasValue: 'ext-1',
      sourceId: 'source-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    store.saveAlias(alias);
    store.saveAlias({ ...alias, metadata: { note: 'updated' } });

    expect(store.findCanonicalId('organizer', 'external_id', 'ext-1', 'source-a')).toBe('org-1');
    expect(store.listAliases('organizer', 'org-1')[0]?.metadata).toEqual({ note: 'updated' });
  });

  it('rejects duplicate alias for different canonical ids', () => {
    const store = new InMemoryEntityAliasStore();
    store.saveAlias({
      entityType: 'organizer',
      canonicalId: 'org-1',
      aliasType: 'external_id',
      aliasValue: 'ext-1',
      sourceId: 'source-a',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(() =>
      store.saveAlias({
        entityType: 'organizer',
        canonicalId: 'org-2',
        aliasType: 'external_id',
        aliasValue: 'ext-1',
        sourceId: 'source-a',
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
    ).toThrow(EntityAliasStoreError);
  });

  it('keeps organizer, venue, and artist aliases separate', () => {
    const store = new InMemoryEntityAliasStore();
    store.saveAlias({
      entityType: 'organizer',
      canonicalId: 'org-1',
      aliasType: 'normalized_name',
      aliasValue: normalizeIdentityText('Bootshaus'),
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    store.saveAlias({
      entityType: 'venue',
      canonicalId: 'venue-1',
      aliasType: 'normalized_name',
      aliasValue: normalizeIdentityText('Bootshaus'),
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(store.findCanonicalId('organizer', 'normalized_name', normalizeIdentityText('Bootshaus'))).toBe(
      'org-1',
    );
    expect(store.findCanonicalId('venue', 'normalized_name', normalizeIdentityText('Bootshaus'))).toBe(
      'venue-1',
    );
  });

  it('persists manual match and keep-separate decisions', () => {
    const store = new InMemoryEntityAliasStore();
    store.saveDecision({
      entityType: 'artist',
      candidateKey: 'name=dj alias',
      decision: 'manual_override',
      canonicalId: 'artist-1',
      decidedBy: 'admin',
      decidedAt: '2026-01-01T00:00:00.000Z',
      reason: 'verified',
    });

    expect(store.getDecision('artist', 'name=dj alias')?.canonicalId).toBe('artist-1');
  });

  it('blocks keep-separate overrides', () => {
    const store = new InMemoryEntityAliasStore();
    store.saveDecision({
      entityType: 'venue',
      candidateKey: 'name=bootshaus',
      decision: 'keep_separate',
      decidedBy: 'admin',
      decidedAt: '2026-01-01T00:00:00.000Z',
      reason: 'distinct profile',
    });

    expect(() =>
      store.saveDecision({
        entityType: 'venue',
        candidateKey: 'name=bootshaus',
        decision: 'manual_override',
        canonicalId: 'venue-1',
        decidedBy: 'admin-2',
        decidedAt: '2026-01-02T00:00:00.000Z',
        reason: 'retry',
      }),
    ).toThrow(EntityAliasStoreError);
  });
});
