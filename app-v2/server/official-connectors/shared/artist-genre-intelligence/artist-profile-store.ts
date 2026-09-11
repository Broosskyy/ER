import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getArtistIdentityKey } from './artist-identity';
import { buildArtistGenreProfile, mergeArtistEvidence } from './artist-genre-consensus';
import type { ArtistCacheMetrics, ArtistGenreEvidence, ArtistGenreProfile, ArtistProviderHealth } from './types';
import { ARTIST_PROFILE_STALE_DAYS } from './types';

const CACHE_DIR = '.tmp/m9-3b-2d-artist-genre-cache';
const CACHE_FILE = join(CACHE_DIR, 'artist-profiles.json');
const LEGACY_CACHE_FILE = join('.tmp/m5-3-artist-corroboration-cache', 'artist-corroboration.json');

export class ArtistProfileStore {
  private profiles = new Map<string, ArtistGenreProfile>();
  private metrics: ArtistCacheMetrics = {
    artistCacheEntries: 0,
    artistEvidenceRecords: 0,
    artistCacheHits: 0,
    artistCacheMisses: 0,
    artistEvidenceProviderRequests: 0,
    providerSuccesses: 0,
    providerFailures: 0,
    providerTimeouts: 0,
    staleArtistProfiles: 0,
  };
  private providerHealth = new Map<string, ArtistProviderHealth>();

  load(): void {
    if (existsSync(CACHE_FILE)) {
      try {
        const payload = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as {
          profiles?: ArtistGenreProfile[];
        };
        this.profiles = new Map(
          (payload.profiles ?? []).map((profile) => [profile.artistIdentity, profile]),
        );
      } catch {
        this.profiles = new Map();
      }
    }
    this.importLegacyCache();
    this.refreshMetrics();
  }

  private importLegacyCache(): void {
    if (!existsSync(LEGACY_CACHE_FILE)) {
      return;
    }
    try {
      const payload = JSON.parse(readFileSync(LEGACY_CACHE_FILE, 'utf8')) as {
        records?: Array<{
          artistName: string;
          identityKey: string;
          normalizedGenres: Array<{ genreKey: string; displayName: string }>;
          projectionDecision: string;
        }>;
      };
      const observedAt = new Date().toISOString();
      for (const record of payload.records ?? []) {
        if (record.projectionDecision !== 'published' || record.normalizedGenres.length === 0) {
          continue;
        }
        const identity = record.identityKey || getArtistIdentityKey(record.artistName);
        if (this.profiles.has(identity)) {
          continue;
        }
        const evidence: ArtistGenreEvidence[] = record.normalizedGenres.map((genre) => ({
          artistIdentity: identity,
          normalizedName: record.artistName,
          genreKey: genre.genreKey,
          displayName: genre.displayName,
          sourceType: 'MUSICBRAINZ',
          sourceReference: 'legacy-corroboration-cache',
          evidenceStrength: 'STRONG',
          confidence: 'HIGH',
          observedAt,
          classificationReason: 'legacy_dual_source_cache',
        }));
        this.profiles.set(
          identity,
          buildArtistGenreProfile({
            artistIdentity: identity,
            normalizedName: record.artistName,
            evidence,
            observedAt,
          }),
        );
      }
    } catch {
      // ignore legacy import failures
    }
  }

  getProfile(artistName: string): ArtistGenreProfile | undefined {
    const identity = getArtistIdentityKey(artistName);
    const profile = this.profiles.get(identity);
    if (profile) {
      this.metrics.artistCacheHits += 1;
      if (this.isStale(profile)) {
        this.metrics.staleArtistProfiles += 1;
      }
      return profile;
    }
    this.metrics.artistCacheMisses += 1;
    return undefined;
  }

  upsertEvidence(artistName: string, evidence: ArtistGenreEvidence[]): ArtistGenreProfile {
    const identity = getArtistIdentityKey(artistName);
    const observedAt = new Date().toISOString();
    const existing = this.profiles.get(identity);
    const mergedEvidence = mergeArtistEvidence(existing?.genreEvidence ?? [], evidence);
    const profile = buildArtistGenreProfile({
      artistIdentity: identity,
      normalizedName: artistName,
      evidence: mergedEvidence,
      observedAt,
    });
    profile.refreshedAt = observedAt;
    profile.staleAfter = new Date(
      Date.now() + ARTIST_PROFILE_STALE_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    this.profiles.set(identity, profile);
    this.refreshMetrics();
    return profile;
  }

  allProfiles(): ArtistGenreProfile[] {
    return [...this.profiles.values()];
  }

  importProfile(profile: ArtistGenreProfile): void {
    this.profiles.set(profile.artistIdentity, profile);
    this.refreshMetrics();
  }

  importProfiles(profiles: ArtistGenreProfile[]): void {
    for (const profile of profiles) {
      this.importProfile(profile);
    }
  }

  getMetrics(): ArtistCacheMetrics {
    return { ...this.metrics };
  }

  recordProviderRequest(providerId: string, outcome: 'success' | 'failure' | 'timeout'): void {
    this.metrics.artistEvidenceProviderRequests += 1;
    const health =
      this.providerHealth.get(providerId) ??
      ({ providerId, requests: 0, successes: 0, failures: 0, timeouts: 0 } satisfies ArtistProviderHealth);
    health.requests += 1;
    if (outcome === 'success') {
      health.successes += 1;
      this.metrics.providerSuccesses += 1;
    } else if (outcome === 'timeout') {
      health.timeouts += 1;
      this.metrics.providerTimeouts += 1;
    } else {
      health.failures += 1;
      this.metrics.providerFailures += 1;
    }
    this.providerHealth.set(providerId, health);
  }

  getProviderHealth(): ArtistProviderHealth[] {
    return [...this.providerHealth.values()];
  }

  save(): void {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      CACHE_FILE,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          cacheVersion: 1,
          profiles: this.allProfiles(),
        },
        null,
        2,
      )}\n`,
    );
    this.refreshMetrics();
  }

  private isStale(profile: ArtistGenreProfile): boolean {
    if (!profile.staleAfter) {
      return false;
    }
    return new Date(profile.staleAfter).getTime() < Date.now();
  }

  private refreshMetrics(): void {
    this.metrics.artistCacheEntries = this.profiles.size;
    this.metrics.artistEvidenceRecords = this.allProfiles().reduce(
      (sum, profile) => sum + profile.genreEvidence.length,
      0,
    );
  }
}

export function profileStoreFingerprint(store: ArtistProfileStore): string {
  const payload = store
    .allProfiles()
    .map((profile) => `${profile.artistIdentity}:${profile.canonicalGenres.map((g) => g.genreKey).join(',')}`)
    .sort()
    .join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
