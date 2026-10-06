import { extractEditorialDescription, isInvalidPrimaryDescription } from '../../shared/description-quality';
import { parseDescriptionExplicitGenres } from '../../shared/parse-description-genres';
import {
  separateStructuredEventContent,
  type StructuredContentSeparationResult,
} from '../../shared/structured-content-separation';
import { calendarDayKey, titleSimilarity } from '../../../../shared/match-normalizers';
import { classifyOutboundUrl } from './outbound-sources';
import { isEventSpecificSupplementalUrl, isGenericNonEventSupplementalUrl } from './supplemental-authority';
import type { EnrichedTicketIoEvent, FieldEvidenceEntry, VerifiedOutboundSource } from './detail-types';
import type { TicketIoEventDiscoveryCandidate } from './types';

const OCR_NOISE = /^(?:early bird|sold out|tickets?|phase \d+|presents?|venue|abendkasse)$/i;

export function separateDescriptionFields(text?: string): StructuredContentSeparationResult {
  return separateStructuredEventContent(text);
}

export function dedupeDescription(text?: string): string | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  const separated = separateStructuredEventContent(text);
  const candidate = separated.descriptionResidual ?? separated.editorialText;
  if (candidate?.trim()) {
    const paragraphs = candidate
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
    const unique: string[] = [];
    for (const paragraph of paragraphs) {
      if (!unique.some((existing) => existing === paragraph || existing.includes(paragraph))) {
        unique.push(paragraph);
      }
    }
    const joined = unique.join('\n\n').trim();
    const editorial = extractEditorialDescription(joined);
    return editorial ?? (isInvalidPrimaryDescription(joined) ? undefined : joined);
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const paragraph of paragraphs) {
    if (!unique.some((existing) => existing === paragraph || existing.includes(paragraph))) {
      unique.push(paragraph);
    }
  }
  const joined = unique.join('\n\n').trim();
  const editorial = extractEditorialDescription(joined);
  return editorial ?? (isInvalidPrimaryDescription(joined) ? undefined : joined);
}

export function qualifyDescription(description?: string): EnrichedTicketIoEvent['descriptionQualification'] {
  const clean = dedupeDescription(description);
  if (!clean) {
    return 'NO_DESCRIPTION';
  }
  if (clean.length >= 180) {
    return 'FULL_DESCRIPTION';
  }
  return 'PARTIAL_DESCRIPTION';
}

export function qualifyLineup(lineup: string[]): EnrichedTicketIoEvent['lineupQualification'] {
  const filtered = lineup.filter((name) => name.trim() && !OCR_NOISE.test(name.trim()));
  if (filtered.length >= 4) {
    return 'FULL_LINEUP';
  }
  if (filtered.length > 0) {
    return 'PARTIAL_LINEUP';
  }
  return 'NO_LINEUP';
}

export function buildGenreCandidates(
  genreHints: string[],
  title: string,
  description?: string,
): EnrichedTicketIoEvent['genreCandidates'] {
  const explicit = [...new Set(genreHints.filter(Boolean))];
  const candidates: EnrichedTicketIoEvent['genreCandidates'] = explicit.map((label) => ({
    label,
    confidence: 'explicit',
  }));

  const descriptionGenres = parseDescriptionExplicitGenres(description);
  for (const label of descriptionGenres) {
    if (!candidates.some((candidate) => candidate.label === label)) {
      candidates.push({ label, confidence: 'strong_inferred' });
    }
  }

  const corpus = `${title} ${description ?? ''}`;
  const inferred: Array<{ label: string; confidence: 'strong_inferred' | 'weak_inferred'; pattern: RegExp }> = [
    { label: 'Hard Techno', confidence: 'strong_inferred', pattern: /\bhard[\s-]?techno\b/i },
    { label: 'Techno', confidence: 'strong_inferred', pattern: /\btechno\b/i },
    { label: 'House', confidence: 'strong_inferred', pattern: /\b(?<!full\s)house\b/i },
    { label: 'Trance', confidence: 'strong_inferred', pattern: /\btrance\b/i },
    {
      label: 'Electronic Festival',
      confidence: 'weak_inferred',
      pattern: /\b(?:techno|house|trance|electronic|rave)\b.*\bfestival\b|\bfestival\b.*\b(?:techno|house|trance|electronic|rave)\b/i,
    },
  ];

  for (const entry of inferred) {
    if (entry.pattern.test(corpus) && !candidates.some((candidate) => candidate.label === entry.label)) {
      candidates.push({ label: entry.label, confidence: entry.confidence });
    }
  }

  return candidates;
}

export function verifyOutboundSources(
  candidate: Pick<EnrichedTicketIoEvent, 'title' | 'startsAt' | 'venueName' | 'eventUrl' | 'outboundLinks'>,
): VerifiedOutboundSource[] {
  return candidate.outboundLinks.map((url) => {
    const classified = classifyOutboundUrl(url);
    const reasons: string[] = [];
    let verified = false;

    if (isGenericNonEventSupplementalUrl(url)) {
      verified = false;
      reasons.push('generic_non_event_page');
    } else if (classified.role === 'ticket_provider' && url !== candidate.eventUrl) {
      verified = false;
      reasons.push('different_ticket_surface');
    } else if (classified.role === 'official_organizer' || classified.role === 'official_venue' || classified.role === 'event_website') {
      if (
        isEventSpecificSupplementalUrl(url, {
          title: candidate.title,
          venueName: candidate.venueName,
        })
      ) {
        verified = true;
        reasons.push('event_specific_supplemental');
      } else {
        reasons.push('identity_uncertain');
      }
    } else {
      reasons.push('non_authoritative_surface');
    }

    return {
      url,
      role: classified.role,
      verified,
      verificationReasons: reasons,
    };
  });
}

export function buildFieldEvidence(event: EnrichedTicketIoEvent): FieldEvidenceEntry[] {
  const entries: FieldEvidenceEntry[] = [
    {
      field: 'title',
      candidateSource: event.eventUrl,
      authorityType: 'ticket_io_detail',
      confidence: event.detailAccess === 'DETAIL_ACCESSIBLE' ? 0.95 : 0.6,
      selectedValue: event.title,
      conflicts: [],
    },
    {
      field: 'startsAt',
      candidateSource: event.eventUrl,
      authorityType: event.startsAt ? 'ticket_io_detail' : 'ticket_io_list',
      confidence: event.startsAt ? 0.9 : 0.4,
      selectedValue: event.startsAt,
      conflicts: [],
    },
    {
      field: 'venue',
      candidateSource: event.eventUrl,
      authorityType: 'ticket_io_detail',
      confidence: event.venueName ? 0.85 : 0.3,
      selectedValue: event.venueName,
      conflicts: [],
    },
    {
      field: 'ticket_target',
      candidateSource: event.eventUrl,
      authorityType: 'ticket_io_detail',
      confidence: 0.95,
      selectedValue: event.eventUrl,
      conflicts: [],
    },
    {
      field: 'current_price',
      candidateSource: event.eventUrl,
      authorityType: 'ticket_io_detail',
      confidence: event.currentAdmissionPriceMinor != null ? 0.9 : 0.2,
      selectedValue: event.currentAdmissionPriceMinor?.toString(),
      conflicts: [],
    },
  ];

  const verifiedOfficial = event.verifiedOutbound.find((source) => source.verified);
  if (verifiedOfficial) {
    entries.push({
      field: 'supplemental_official',
      candidateSource: verifiedOfficial.url,
      authorityType: 'outbound_official',
      confidence: 0.8,
      selectedValue: verifiedOfficial.url,
      conflicts: [],
    });
  }

  return entries;
}

export function inventoryFingerprint(candidate: TicketIoEventDiscoveryCandidate): string {
  return [
    candidate.identityKey,
    candidate.title,
    candidate.startsAt ?? '',
    candidate.listAmountMinor?.toString() ?? '',
    candidate.relevance,
  ].join('|');
}

export function eventsAreSameIdentity(
  left: Pick<EnrichedTicketIoEvent, 'title' | 'startsAt' | 'venueName' | 'eventUrl'>,
  right: Pick<EnrichedTicketIoEvent, 'title' | 'startsAt' | 'venueName' | 'eventUrl'>,
): boolean {
  if (left.eventUrl === right.eventUrl) {
    return true;
  }
  if (!left.startsAt || !right.startsAt) {
    return false;
  }
  const sameDay =
    calendarDayKey(left.startsAt, 'Europe/Berlin') === calendarDayKey(right.startsAt, 'Europe/Berlin');
  return sameDay && titleSimilarity(left.title, right.title) >= 0.85;
}
