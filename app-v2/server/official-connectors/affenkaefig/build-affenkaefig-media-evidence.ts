import {
  buildMediaEvidenceContextFromEvidence,
  type MediaEvidenceContext,
} from '../shared/media-evidence-context';
import type { OfficialEventEvidence } from '../types';

const AFFENKAEFIG_CONNECTOR_NOISE_TERMS = [
  'affenkaefig',
  'affenkaefig veranstaltungen',
  'www.affenkaefig.info',
  'essigfabrik',
  'elektroküche',
  'ticketkings',
];

export function buildAffenkaefigMediaEvidenceContext(
  textEvidence: OfficialEventEvidence,
): MediaEvidenceContext {
  return buildMediaEvidenceContextFromEvidence({
    venueName: textEvidence.venue?.name,
    organizerLabel: textEvidence.organizerLabel,
    city: textEvidence.venue?.city,
    officialUrl: textEvidence.officialUrl,
    officialImageUrl: textEvidence.officialImageUrl,
    additionalNoiseTerms: AFFENKAEFIG_CONNECTOR_NOISE_TERMS,
  });
}
