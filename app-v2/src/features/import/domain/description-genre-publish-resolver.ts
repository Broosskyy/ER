import { GENRE_SYNONYMS } from '@/features/import/matching/matching-config';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';
import { normalizeCanonicalEventDescription } from '@/features/import/domain/canonical-description-normalizer';
import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';
import { isTicketIoPlaceholderDescription } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import {
  detectDescriptionContamination,
  detectDescriptionSpacingErrors,
  isLineupChromeDescription,
  normalizeOfficialStructuredGenres,
  stripNonEditorialLineupFromDescription,
} from '@/features/import/domain/golden-content-quality-gate';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';
import {
  applyDescriptionBoundaries,
  extractDescriptionBoundariesFromHtml,
} from '@/features/import/unified-website/description-boundaries';

export interface FieldPublishProvenance {
  field: 'description' | 'genres';
  sourceId?: string;
  extractionStrategy: string;
  observedAt: string;
  inclusionReason: string;
  rawEvidence?: string;
}

export interface DescriptionGenrePublishResult {
  description?: string;
  genreLabels?: string[];
  descriptionProvenance?: FieldPublishProvenance;
  genreProvenance?: FieldPublishProvenance;
  blockedReason?: string;
  descriptionContaminated?: boolean;
  descriptionSpacingErrors?: boolean;
  rejectedGenreSignals?: Array<{ signal: string; reason: string }>;
}

const NAV_BOILERPLATE =
  /^(?:zum inhalt springen|skip to content|main navigation|primary menu|cookie|datenschutz|impressum|newsletter)/i;
const HTML_NOISE = /<(?:script|iframe|noscript|style|nav|footer|header)\b/i;
const GENRE_FALSE_POSITIVES = new Set(
  ['club event', 'open air event', 'open-air event', 'zum inhalt springen', 'event', 'party'].map(
    normalizeMatchText,
  ),
);

const ONTOLOGY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [];

for (const [canonicalId, aliases] of Object.entries(GENRE_SYNONYMS)) {
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    ONTOLOGY_PATTERNS.push({
      label: canonicalId,
      pattern: new RegExp(`\\b${escaped}\\b`, 'i'),
    });
  }
  ONTOLOGY_PATTERNS.push({
    label: canonicalId,
    pattern: new RegExp(`\\b${canonicalId.replace(/-/g, '[\\s-]')}\\b`, 'i'),
  });
}

ONTOLOGY_PATTERNS.push({ label: 'uptempo', pattern: /\buptempo\b/i });

export function stripAffenkaefigDescriptionNoise(raw: string): {
  cleaned?: string;
  removed: string[];
} {
  const removed: string[] = [];
  if (HTML_NOISE.test(raw)) {
    removed.push('html_noise_tags');
  }

  let blocks: string[];
  if (raw.includes('<')) {
    blocks = extractDescriptionBoundariesFromHtml(raw).contentBlocks;
  } else {
    const inlineParts = raw
      .split(/[\s▔━─\-_=]{8,}/)
      .map((line) => line.trim())
      .filter(Boolean);
    blocks =
      inlineParts.length > 1
        ? inlineParts
        : raw
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);
  }

  const kept: string[] = [];
  for (const block of blocks) {
    if (NAV_BOILERPLATE.test(block.trim())) {
      removed.push(block.slice(0, 80));
      continue;
    }
    if (/^>\s*line-?up/i.test(block.trim())) {
      removed.push('lineup_chrome_fragment');
      continue;
    }
    if (/^line\s*up\s*:?\s*$/i.test(block.trim())) {
      removed.push('lineup_heading_only');
      continue;
    }
    if (/checkout|ticketing|iframe|cookie-banner|comment-form/i.test(block)) {
      removed.push('embedded_or_chrome_block');
      continue;
    }
    kept.push(block);
  }

  const bounded = applyDescriptionBoundaries(kept);
  removed.push(...bounded.removedBlocks.map((entry) => entry.reason));

  let cleaned = bounded.normalizedDescription ?? bounded.cleanedText;
  if (cleaned) {
    cleaned = cleaned.replace(/^events\s*\n+/i, '').trim();
    cleaned = cleaned.replace(/\bmain\s*floor\.(?=[A-Z])/gi, 'mainfloor. ');
  }
  return {
    cleaned: cleaned ? normalizeCanonicalEventDescription(cleaned) : undefined,
    removed,
  };
}

export function extractGenresFromTrustedText(
  text: string,
  observedAt: string,
): { genres: string[]; provenance: FieldPublishProvenance } | undefined {
  const matches = new Set<string>();
  for (const { label, pattern } of ONTOLOGY_PATTERNS) {
    if (pattern.test(text)) {
      matches.add(label);
    }
  }

  const labels = normalizeCanonicalGenreLabels(
    [...matches].filter((genre) => !GENRE_FALSE_POSITIVES.has(normalizeMatchText(genre))),
  );

  if (labels.length === 0) {
    return undefined;
  }

  return {
    genres: labels,
    provenance: {
      field: 'genres',
      extractionStrategy: 'ontology_word_boundary',
      observedAt,
      inclusionReason: 'Explicit ontology term in trusted description body',
      rawEvidence: text.slice(0, 240),
    },
  };
}

export function resolveDescriptionGenrePublish(input: {
  existingDescription?: string;
  existingGenres?: string[];
  officialDescription?: string;
  officialHtml?: string;
  officialGenreLabels?: string[];
  ticketPlatformDescription?: string;
  ticketPlatformGenres?: string[];
  event: EventIdentitySnapshot;
  ticketEvidence?: {
    pageTitle?: string;
    listRowTitle?: string;
    eventDate?: string;
    venueName?: string;
  };
  sourceId?: string;
  observedAt?: string;
}): DescriptionGenrePublishResult {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const structuredGenres = normalizeOfficialStructuredGenres(input.officialGenreLabels);
  const rejectedGenreSignals: Array<{ signal: string; reason: string }> = [];

  const officialRaw = input.officialHtml ?? input.officialDescription;
  const strippedOfficial =
    officialRaw !== undefined ? stripAffenkaefigDescriptionNoise(officialRaw).cleaned : undefined;
  const editorialDescription = strippedOfficial
    ? stripNonEditorialLineupFromDescription(strippedOfficial)
    : undefined;
  const normalizedEditorial = editorialDescription
    ? normalizeCanonicalEventDescription(editorialDescription)
    : undefined;
  const contamination = detectDescriptionContamination(normalizedEditorial);
  const spacingErrors = detectDescriptionSpacingErrors(normalizedEditorial);

  if (normalizedEditorial?.trim()) {
    const genreResult = extractGenresFromTrustedText(normalizedEditorial, observedAt);
    const mergedGenres =
      structuredGenres ??
      genreResult?.genres ??
      input.existingGenres;
    if (structuredGenres && genreResult?.genres?.length) {
      for (const genre of genreResult.genres) {
        if (!structuredGenres.includes(genre)) {
          rejectedGenreSignals.push({ signal: genre, reason: 'text_genre_subordinate_to_structured_tags' });
        }
      }
    }
    return {
      description: contamination.contaminated ? undefined : normalizedEditorial,
      genreLabels: mergedGenres,
      descriptionProvenance: contamination.contaminated
        ? undefined
        : {
            field: 'description',
            sourceId: input.sourceId,
            extractionStrategy: 'official_body_boundaries',
            observedAt,
            inclusionReason: 'Official website body after boundary stripping',
          },
      genreProvenance: structuredGenres
        ? {
            field: 'genres',
            sourceId: input.sourceId,
            extractionStrategy: 'official_structured_tags',
            observedAt,
            inclusionReason: 'Structured official genre tags',
            rawEvidence: input.officialGenreLabels?.join(', '),
          }
        : genreResult?.provenance,
      blockedReason:
        contamination.contaminated && normalizedEditorial?.trim()
          ? 'description_contaminated'
          : undefined,
      descriptionContaminated:
        contamination.contaminated && Boolean(normalizedEditorial?.trim()),
      descriptionSpacingErrors: spacingErrors,
      rejectedGenreSignals,
    };
  }

  if (structuredGenres?.length) {
    return {
      genreLabels: structuredGenres,
      genreProvenance: {
        field: 'genres',
        sourceId: input.sourceId,
        extractionStrategy: 'official_structured_tags',
        observedAt,
        inclusionReason: 'Structured official genre tags without editorial description',
        rawEvidence: input.officialGenreLabels?.join(', '),
      },
      blockedReason:
        contamination.contaminated && Boolean(strippedOfficial?.trim())
          ? 'description_contaminated'
          : undefined,
      descriptionContaminated:
        contamination.contaminated && Boolean(strippedOfficial?.trim()),
      descriptionSpacingErrors: spacingErrors,
      rejectedGenreSignals,
    };
  }

  const existingUsable = input.existingDescription?.trim();
  if (
    existingUsable &&
    !isTicketIoPlaceholderDescription(existingUsable) &&
    !isLineupChromeDescription(existingUsable)
  ) {
    const genreResult = extractGenresFromTrustedText(existingUsable, observedAt);
    return {
      description: normalizeCanonicalEventDescription(existingUsable),
      genreLabels: genreResult?.genres ?? input.existingGenres,
      descriptionProvenance: {
        field: 'description',
        extractionStrategy: 'preserve_existing_official',
        observedAt,
        inclusionReason: 'Existing trusted description preserved',
      },
      genreProvenance: genreResult?.provenance,
    };
  }

  const ticketDesc = input.ticketPlatformDescription?.trim();
  const ticketGenres = input.ticketPlatformGenres;
  if (ticketDesc || ticketGenres?.length) {
    const identity = evaluateEventEvidenceIdentityGate({
      event: input.event,
      evidence: {
        pageTitle: input.ticketEvidence?.pageTitle,
        listRowTitle: input.ticketEvidence?.listRowTitle,
        eventDate: input.ticketEvidence?.eventDate,
        venueName: input.ticketEvidence?.venueName,
      },
    });

    if (!identity.criticalFieldsPublishAllowed) {
      return {
        blockedReason: `ticket_platform_description_blocked:${identity.verdict}`,
      };
    }

    const cleanedTicket = ticketDesc
      ? normalizeCanonicalEventDescription(ticketDesc)
      : undefined;
    const genreResult =
      cleanedTicket !== undefined
        ? extractGenresFromTrustedText(cleanedTicket, observedAt)
        : ticketGenres
          ? {
              genres: normalizeCanonicalGenreLabels(
                ticketGenres.filter(
                  (genre) => !GENRE_FALSE_POSITIVES.has(normalizeMatchText(genre)),
                ),
              ),
              provenance: {
                field: 'genres' as const,
                sourceId: input.sourceId,
                extractionStrategy: 'ticket_platform_tags',
                observedAt,
                inclusionReason: 'Ticket platform tags with matching identity',
              },
            }
          : undefined;

    return {
      description: cleanedTicket,
      genreLabels: genreResult?.genres,
      descriptionProvenance: cleanedTicket
        ? {
            field: 'description',
            sourceId: input.sourceId,
            extractionStrategy: 'ticket_platform_fallback',
            observedAt,
            inclusionReason: 'Ticket platform description after identity gate',
          }
        : undefined,
      genreProvenance: genreResult?.provenance,
    };
  }

  return {
    blockedReason: 'no_trusted_description_or_genre_evidence',
  };
}
