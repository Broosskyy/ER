import type { OfficialEventEvidence } from '../../official-connectors/types';
import type { EventCandidate, EventCandidateLineupAct } from '../types/event-candidate';

function mapLineupRole(
  role: OfficialEventEvidence['lineupCandidates'][number]['evidenceRole'],
): EventCandidateLineupAct['billingRole'] {
  return role;
}

export function officialEvidenceToEventCandidate(evidence: OfficialEventEvidence): EventCandidate {
  return {
    origin: {
      kind: 'official_connector',
      connectorId: evidence.connectorId,
      sourceEventKey: evidence.sourceEventKey,
      officialUrl: evidence.officialUrl,
      pageFingerprint: evidence.pageFingerprint,
      fetchedAt: evidence.fetchedAt,
      enrichmentGaps: evidence.enrichmentGaps,
    },
    title: evidence.title,
    startsAt: evidence.startsAt,
    endsAt: evidence.endsAt,
    timezone: evidence.sourceTimezone,
    organizerName: evidence.organizerLabel,
    description: evidence.descriptionClean,
    imageUrl: evidence.officialImageUrl,
    venue: evidence.venue
      ? {
          name: evidence.venue.name,
          addressLine: evidence.venue.address,
          postalCode: evidence.venue.postalCode,
          city: evidence.venue.city,
          countryCode: evidence.venue.countryCode,
        }
      : undefined,
    lineup: evidence.lineupCandidates.map((candidate) => ({
      billingName: candidate.displayName,
      billingRole: mapLineupRole(candidate.evidenceRole),
      sortOrder: candidate.billingOrder,
    })),
    genres: evidence.explicitGenreLabels.map((label, index) => ({
      genreKey: label.toLowerCase().replace(/\s+/g, '-'),
      displayName: label,
      sortOrder: index,
    })),
    tickets: [],
  };
}
