import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { isSearchableGenreConfidence } from '../artist-genre-intelligence/discovery-confidence-policy';
import type { GenreEvidenceExhaustionResult, GenreConfidenceBand } from '../genre-evidence';
import { canonicalGenreKey } from '../normalize-genre';
import { normalizeGenreLabelSet } from '../staging-source-evidence';
import { domainSupportsBroadElectronic } from './domain-classification';
import type {
  DiscoverySignalBundle,
  EventGenreFusionResult,
  FusionContribution,
  FusionSourceLayer,
  GenreFusionContext,
} from './types';
import { FUSION_AUTHORITY } from './types';

const STRONG_HIT_TO_GENRE: Record<string, string> = {
  techno: 'Techno',
  hard_techno: 'Hard Techno',
  hard_techno_abbrev: 'Hard Techno',
  house: 'House',
  deep_house: 'Deep House',
  tech_house: 'Tech House',
  melodic_techno: 'Melodic Techno',
  trance: 'Trance',
  psytrance: 'Psytrance',
  hardstyle: 'Hardstyle',
  hardcore: 'Hardcore',
  gabber: 'Gabber',
  dnb: "Drum'n'Bass",
  dnb_short: "Drum'n'Bass",
  jungle: 'Jungle',
  electro: 'Electro',
  edm: 'EDM',
  minimal: 'Minimal Techno',
  industrial: 'Industrial Techno',
  schranz: 'Techno',
};

function contributionFromLayer(input: {
  genreKey: string;
  displayName: string;
  layer: FusionSourceLayer;
  confidence: GenreConfidenceBand;
  sourceReference: string;
  classificationReason: string;
  independenceGroup: string;
  authorityOverride?: number;
}): FusionContribution {
  return {
    genreKey: input.genreKey,
    displayName: input.displayName,
    layer: input.layer,
    authority: input.authorityOverride ?? FUSION_AUTHORITY[input.layer],
    confidence: input.confidence,
    sourceReference: input.sourceReference,
    classificationReason: input.classificationReason,
    independenceGroup: input.independenceGroup,
  };
}

function tierToConfidence(tier: string): GenreConfidenceBand {
  switch (tier) {
    case 'A_DIRECT':
      return 'EXPLICIT';
    case 'B_STRONG':
    case 'C_LINEUP':
      return 'HIGH';
    case 'D_CONTEXTUAL':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function mergeContributions(contributions: FusionContribution[]): FusionContribution[] {
  const byKey = new Map<string, FusionContribution>();
  for (const entry of contributions) {
    const key = canonicalGenreKey(entry.genreKey);
    const existing = byKey.get(key);
    if (!existing || entry.authority > existing.authority) {
      byKey.set(key, { ...entry, genreKey: key });
    }
  }
  return [...byKey.values()].sort((left, right) => right.authority - left.authority);
}

function selectRecommendedGenres(contributions: FusionContribution[]): {
  genres: string[];
  confidence: GenreConfidenceBand;
  method: string;
} {
  const searchable = contributions.filter((entry) => isSearchableGenreConfidence(entry.confidence));
  if (searchable.length === 0) {
    return { genres: [], confidence: 'UNRESOLVED', method: 'no_searchable_evidence' };
  }

  const topAuthority = searchable[0]!.authority;
  const selected = searchable.filter(
    (entry) => entry.authority >= topAuthority - 8 || entry.confidence === 'EXPLICIT',
  );

  const narrow = selected.filter((entry) => entry.layer !== 'DOMAIN_ELECTRONIC');
  const finalSelection = narrow.length > 0 ? narrow : selected;
  const genres = normalizeGenreLabelSet(finalSelection.map((entry) => entry.displayName)).slice(0, 4);

  const confidence = finalSelection.reduce<GenreConfidenceBand>((best, entry) => {
    const rank = ['UNRESOLVED', 'LOW', 'MEDIUM', 'HIGH', 'EXPLICIT'];
    return rank.indexOf(entry.confidence) > rank.indexOf(best) ? entry.confidence : best;
  }, 'UNRESOLVED');

  const layers = [...new Set(finalSelection.map((entry) => entry.layer))];
  const method =
    layers.includes('HEADLINER_PROFILE') || layers.includes('LINEUP_CONSENSUS')
      ? 'artist_lineup_fusion'
      : layers.includes('DISCOVERY_GENRE_CANDIDATE') || layers.includes('DISCOVERY_RELEVANCE')
        ? 'discovery_evidence_fusion'
        : layers.includes('BOOTSHAUS_OFFICIAL')
          ? 'official_page_fusion'
          : layers.includes('EVENT_SERIES')
            ? 'event_series_fusion'
            : 'multi_source_fusion';

  return { genres, confidence, method };
}

export function fuseEventGenreEvidence(input: {
  event: StagingEventSnapshot;
  exhaustion: GenreEvidenceExhaustionResult;
  discovery?: DiscoverySignalBundle;
  fusionContext?: GenreFusionContext;
}): EventGenreFusionResult {
  const contributions: FusionContribution[] = [];

  for (const record of input.exhaustion.evidence) {
    contributions.push(
      contributionFromLayer({
        genreKey: record.genreKey,
        displayName: record.displayName,
        layer:
          record.evidenceType === 'A_DIRECT'
            ? 'EXPLICIT_EVENT'
            : record.evidenceType === 'B_STRONG'
              ? 'DESCRIPTION'
              : record.evidenceType === 'C_LINEUP'
                ? record.classificationReason.includes('headliner')
                  ? 'HEADLINER_PROFILE'
                  : 'LINEUP_CONSENSUS'
                : 'TICKET_METADATA',
        confidence: record.confidence,
        sourceReference: record.sourceUrl ?? record.sourceKey ?? record.classificationReason,
        classificationReason: record.classificationReason,
        independenceGroup: `exhaustion:${record.evidenceType}`,
      }),
    );
  }

  const discovery = input.discovery ?? input.fusionContext?.discoveryByEventId.get(input.event.eventId);
  const bootshausGenres =
    input.fusionContext?.bootshausGenresByEventId.get(input.event.eventId) ?? [];
  const seriesGenres = input.fusionContext?.seriesGenresByEventId.get(input.event.eventId) ?? [];

  if (discovery) {
    for (const label of discovery.discoveryGenreLabels) {
      const key = canonicalGenreKey(label);
      contributions.push(
        contributionFromLayer({
          genreKey: key,
          displayName: label,
          layer: 'DISCOVERY_GENRE_CANDIDATE',
          confidence: discovery.strongDiscoverySignals.length > 0 ? 'HIGH' : 'MEDIUM',
          sourceReference: discovery.strongDiscoverySignals.join(',') || 'discovery_genre_candidate',
          classificationReason: 'discovery_relevance_genre_candidate',
          independenceGroup: 'discovery:genre',
        }),
      );
    }

    if (
      discovery.importQualification !== 'WEAK_IMPORT_QUALIFICATION' &&
      discovery.strongDiscoverySignals.length > 0
    ) {
      for (const signal of discovery.strongDiscoverySignals) {
        const mapped = STRONG_HIT_TO_GENRE[signal];
        if (!mapped) {
          continue;
        }
        contributions.push(
          contributionFromLayer({
            genreKey: canonicalGenreKey(mapped),
            displayName: mapped,
            layer: 'DISCOVERY_RELEVANCE',
            confidence: 'HIGH',
            sourceReference: `strong_positive:${signal}`,
            classificationReason: 'discovery_strong_positive_signal',
            independenceGroup: 'discovery:relevance',
            authorityOverride: FUSION_AUTHORITY.DISCOVERY_RELEVANCE,
          }),
        );
      }
    }
  }

  for (const label of bootshausGenres) {
    const key = canonicalGenreKey(label);
    contributions.push(
      contributionFromLayer({
        genreKey: key,
        displayName: label,
        layer: 'BOOTSHAUS_OFFICIAL',
        confidence: 'HIGH',
        sourceReference: 'bootshaus.tv/events',
        classificationReason: 'bootshaus_official_page_genres',
        independenceGroup: 'official:bootshaus',
      }),
    );
  }

  if (seriesGenres.length > 0) {
    for (const label of seriesGenres) {
      contributions.push(
        contributionFromLayer({
          genreKey: label,
          displayName: label,
          layer: 'EVENT_SERIES',
          confidence: 'MEDIUM',
          sourceReference: 'classified_series_sibling',
          classificationReason: 'event_series_genre_inheritance',
          independenceGroup: 'series:related',
        }),
      );
    }
  }

  const merged = mergeContributions(contributions);
  let { genres, confidence, method } = selectRecommendedGenres(merged);

  const domain = discovery?.domainClassification ?? 'AMBIGUOUS';
  const weakOnly =
    discovery?.importQualification === 'WEAK_IMPORT_QUALIFICATION' &&
    merged.every((entry) => entry.layer === 'EVENT_SERIES' || entry.layer === 'DOMAIN_ELECTRONIC');

  if (
    genres.length === 0 &&
    domainSupportsBroadElectronic(domain) &&
    !weakOnly &&
    (discovery?.strongDiscoverySignals.length ?? 0) > 0
  ) {
    merged.push(
      contributionFromLayer({
        genreKey: 'electronic',
        displayName: 'Electronic',
        layer: 'DOMAIN_ELECTRONIC',
        confidence: domain === 'ELECTRONIC_HIGH' ? 'MEDIUM' : 'LOW',
        sourceReference: discovery?.relevance.reasons.join(';') ?? 'domain_electronic',
        classificationReason: 'domain_electronic_with_discovery_signals',
        independenceGroup: 'domain:broad',
      }),
    );
    const broad = selectRecommendedGenres(merged);
    genres = broad.genres;
    confidence = broad.confidence;
    method = 'domain_electronic_fusion';
  }

  const current = input.event.genres;
  const changed =
    current.length !== genres.length ||
    !current.every((genre) => genres.some((entry) => canonicalGenreKey(entry) === canonicalGenreKey(genre)));

  const importEligibilityReview =
    genres.length === 0 &&
    (discovery?.importQualification === 'WEAK_IMPORT_QUALIFICATION' ||
      domain === 'AMBIGUOUS' ||
      domain === 'NON_ELECTRONIC');

  return {
    eventId: input.event.eventId,
    title: input.event.title,
    domainClassification: domain,
    importQualification: discovery?.importQualification ?? 'UNKNOWN',
    contributions: merged,
    recommendedGenres: genres.length > 0 ? genres : input.exhaustion.recommendedGenres,
    genreConfidence: genres.length > 0 ? confidence : tierToConfidence('UNRESOLVED'),
    classificationMethod: method,
    changedFromCurrent: changed,
    importEligibilityReview,
  };
}

export function fuseGenreEvidenceForStaging(
  events: StagingEventSnapshot[],
  exhaustions: GenreEvidenceExhaustionResult[],
  fusionContext: GenreFusionContext,
): EventGenreFusionResult[] {
  return events.map((event, index) =>
    fuseEventGenreEvidence({
      event,
      exhaustion: exhaustions[index]!,
      fusionContext,
    }),
  );
}
