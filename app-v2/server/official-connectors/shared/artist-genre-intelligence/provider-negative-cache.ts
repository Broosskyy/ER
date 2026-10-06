import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getArtistIdentityKey } from './artist-identity';

export type ProviderOutcome =
  | 'EVIDENCE_FOUND'
  | 'NO_RESULT'
  | 'TEMPORARY_FAILURE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'IDENTITY_UNRESOLVED';

export interface ProviderNegativeCacheEntry {
  artistIdentity: string;
  providerId: string;
  outcome: ProviderOutcome;
  observedAt: string;
  expiresAt: string;
  detail?: string;
}

const CACHE_DIR = '.tmp/m9-3b-2d-artist-genre-cache';
const CACHE_FILE = join(CACHE_DIR, 'provider-negative-cache.json');

const EXPIRY_MS: Record<ProviderOutcome, number> = {
  EVIDENCE_FOUND: 30 * 24 * 60 * 60 * 1000,
  NO_RESULT: 7 * 24 * 60 * 60 * 1000,
  TEMPORARY_FAILURE: 2 * 60 * 60 * 1000,
  RATE_LIMITED: 60 * 60 * 1000,
  TIMEOUT: 30 * 60 * 1000,
  IDENTITY_UNRESOLVED: 24 * 60 * 60 * 1000,
};

export class ProviderNegativeCache {
  private entries = new Map<string, ProviderNegativeCacheEntry>();

  load(): void {
    if (!existsSync(CACHE_FILE)) {
      return;
    }
    try {
      const payload = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as {
        entries?: ProviderNegativeCacheEntry[];
      };
      this.entries = new Map(
        (payload.entries ?? []).map((entry) => [`${entry.artistIdentity}:${entry.providerId}`, entry]),
      );
    } catch {
      this.entries = new Map();
    }
  }

  save(): void {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      CACHE_FILE,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), entries: [...this.entries.values()] }, null, 2)}\n`,
    );
  }

  shouldFetch(providerId: string, artistName: string): boolean {
    const key = `${getArtistIdentityKey(artistName)}:${providerId}`;
    const entry = this.entries.get(key);
    if (!entry) {
      return true;
    }
    if (new Date(entry.expiresAt).getTime() <= Date.now()) {
      return true;
    }
    return entry.outcome === 'TEMPORARY_FAILURE' || entry.outcome === 'RATE_LIMITED' || entry.outcome === 'TIMEOUT';
  }

  record(providerId: string, artistName: string, outcome: ProviderOutcome, detail?: string): void {
    const observedAt = new Date();
    const expiresAt = new Date(observedAt.getTime() + EXPIRY_MS[outcome]);
    const key = `${getArtistIdentityKey(artistName)}:${providerId}`;
    this.entries.set(key, {
      artistIdentity: getArtistIdentityKey(artistName),
      providerId,
      outcome,
      observedAt: observedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      detail,
    });
  }

  allEntries(): ProviderNegativeCacheEntry[] {
    return [...this.entries.values()];
  }

  invalidateForArtists(artistNames: string[], providerIds?: string[]): number {
    let removed = 0;
    for (const artistName of artistNames) {
      const identity = getArtistIdentityKey(artistName);
      for (const [key, entry] of [...this.entries.entries()]) {
        if (entry.artistIdentity !== identity) {
          continue;
        }
        if (providerIds && !providerIds.includes(entry.providerId)) {
          continue;
        }
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  audit(): {
    total: number;
    byOutcome: Record<ProviderOutcome, number>;
    activeBlocks: number;
    expired: number;
  } {
    const byOutcome: Record<ProviderOutcome, number> = {
      EVIDENCE_FOUND: 0,
      NO_RESULT: 0,
      TEMPORARY_FAILURE: 0,
      RATE_LIMITED: 0,
      TIMEOUT: 0,
      IDENTITY_UNRESOLVED: 0,
    };
    let activeBlocks = 0;
    let expired = 0;
    const now = Date.now();
    for (const entry of this.entries.values()) {
      byOutcome[entry.outcome] += 1;
      if (new Date(entry.expiresAt).getTime() > now) {
        activeBlocks += 1;
      } else {
        expired += 1;
      }
    }
    return { total: this.entries.size, byOutcome, activeBlocks, expired };
  }
}
