import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { parseDescriptionExplicitGenres } from '../parse-description-genres';
import { canonicalGenreKey, normalizeOfficialGenreLabel } from '../normalize-genre';
import {
  collectDescriptionTexts,
  loadEventSourcePayloads,
  type SourcePayloadRow,
} from '../staging-source-evidence';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { getArtistIdentityKey, normalizeArtistDisplayName } from './artist-identity';
import type { ArtistGenreEvidence, ArtistProviderHealth } from './types';
import type { ArtistProfileStore } from './artist-profile-store';

export interface ArtistEvidenceProvider {
  providerId: string;
  collectEvidence(input: ArtistEvidenceProviderInput): Promise<ArtistGenreEvidence[]>;
}

export interface ArtistEvidenceProviderInput {
  artistName: string;
  events: StagingEventSnapshot[];
  runQuery?: LinkedQueryExecutor;
  sourceRowsByEvent?: Map<string, SourcePayloadRow[]>;
  store: ArtistProfileStore;
}

function toEvidenceRecord(input: {
  artistName: string;
  genreLabel: string;
  sourceType: ArtistGenreEvidence['sourceType'];
  sourceReference: string;
  evidenceStrength: ArtistGenreEvidence['evidenceStrength'];
  confidence: ArtistGenreEvidence['confidence'];
  classificationReason: string;
}): ArtistGenreEvidence | undefined {
  const normalized = normalizeOfficialGenreLabel(input.genreLabel);
  if (normalized.status !== 'normalized') {
    return undefined;
  }
  const identity = getArtistIdentityKey(input.artistName);
  return {
    artistIdentity: identity,
    normalizedName: normalizeArtistDisplayName(input.artistName),
    genreKey: normalized.genreKey,
    displayName: normalized.displayName,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    evidenceStrength: input.evidenceStrength,
    confidence: input.confidence,
    observedAt: new Date().toISOString(),
    rawLabel: input.genreLabel,
    classificationReason: input.classificationReason,
  };
}

export const historicalEventProvider: ArtistEvidenceProvider = {
  providerId: 'historical-event',
  async collectEvidence({ artistName, events }) {
    const identity = getArtistIdentityKey(artistName);
    const evidence: ArtistGenreEvidence[] = [];
    for (const event of events) {
      if (event.genres.length === 0) {
        continue;
      }
      const lineupMatch = event.lineup.some((act) => getArtistIdentityKey(act) === identity);
      if (!lineupMatch) {
        continue;
      }
      for (const genreLabel of event.genres) {
        const record = toEvidenceRecord({
          artistName,
          genreLabel,
          sourceType: 'HISTORICAL_EVENT',
          sourceReference: `${event.eventId}:${event.title}`,
          evidenceStrength: 'STRONG',
          confidence: 'HIGH',
          classificationReason: 'verified_historical_event_genre',
        });
        if (record) {
          evidence.push(record);
        }
      }
    }
    return evidence;
  },
};

export const eventDescriptionProvider: ArtistEvidenceProvider = {
  providerId: 'event-description',
  async collectEvidence({ artistName, events, runQuery, sourceRowsByEvent }) {
    const identity = getArtistIdentityKey(artistName);
    const evidence: ArtistGenreEvidence[] = [];
    for (const event of events) {
      const sourceRows =
        sourceRowsByEvent?.get(event.eventId) ??
        (runQuery ? loadEventSourcePayloads(runQuery, event.eventId) : []);
      const texts = collectDescriptionTexts(event, sourceRows);
      for (const text of texts) {
        if (!text.toLowerCase().includes(artistName.toLowerCase().split(' ')[0] ?? '')) {
          continue;
        }
        const artistWindow =
          text.match(
            new RegExp(
              `${artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,220}`,
              'i',
            ),
          )?.[0] ?? text;
        for (const genreLabel of parseDescriptionExplicitGenres(artistWindow)) {
          const record = toEvidenceRecord({
            artistName,
            genreLabel,
            sourceType: 'EVENT_DESCRIPTION',
            sourceReference: `${event.eventId}:description`,
            evidenceStrength: 'MODERATE',
            confidence: 'MEDIUM',
            classificationReason: 'artist_associated_description_genre',
          });
          if (record) {
            evidence.push(record);
          }
        }
      }
    }
    return evidence;
  },
};

export async function runArtistEvidenceProviders(input: {
  artistNames: string[];
  events: StagingEventSnapshot[];
  runQuery?: LinkedQueryExecutor;
  store: ArtistProfileStore;
  providers: ArtistEvidenceProvider[];
  externalResolver?: (artistName: string) => Promise<ArtistGenreEvidence[]>;
}): Promise<Map<string, ArtistGenreEvidence[]>> {
  const sourceRowsByEvent = new Map<string, SourcePayloadRow[]>();
  if (input.runQuery) {
    for (const event of input.events) {
      sourceRowsByEvent.set(event.eventId, loadEventSourcePayloads(input.runQuery, event.eventId));
    }
  }

  const evidenceByArtist = new Map<string, ArtistGenreEvidence[]>();
  for (const artistName of input.artistNames) {
    const collected: ArtistGenreEvidence[] = [];
    for (const provider of input.providers) {
      try {
        const records = await provider.collectEvidence({
          artistName,
          events: input.events,
          runQuery: input.runQuery,
          sourceRowsByEvent,
          store: input.store,
        });
        input.store.recordProviderRequest(provider.providerId, 'success');
        collected.push(...records);
      } catch {
        input.store.recordProviderRequest(provider.providerId, 'failure');
      }
    }
    if (input.externalResolver) {
      try {
        const external = await input.externalResolver(artistName);
        input.store.recordProviderRequest('external-metadata', external.length > 0 ? 'success' : 'failure');
        collected.push(...external);
      } catch {
        input.store.recordProviderRequest('external-metadata', 'failure');
      }
    }
    evidenceByArtist.set(getArtistIdentityKey(artistName), collected);
  }
  return evidenceByArtist;
}

export function providerHealthSummary(store: ArtistProfileStore): ArtistProviderHealth[] {
  return store.getProviderHealth();
}
