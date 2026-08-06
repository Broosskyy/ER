/**
 * Phase 4.8.2.1 — classify controlled-batch preview proposals for human review.
 */
import { decodeHtmlEntities, normalizeText } from '@/features/import/normalization/text-normalizer';
import { valuesSemanticallyEqual } from '@/features/import/shadow/official-website-public-truth';

export type ProposalReviewClassification =
  | 'REAL_PRODUCTION_FIX'
  | 'FORMATTING_ONLY'
  | 'PUBLIC_SOURCE_HAS_NO_FIELD'
  | 'DIFFERENT_EVENT_CONTEXT'
  | 'IMPORTER_UNSUPPORTED'
  | 'REVIEW_REQUIRED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ControlledBatchProposal {
  eventId: string;
  title: string;
  field: string;
  category?: string;
  currentCanonical?: unknown;
  proposedValue?: unknown;
  publicEvidence?: unknown;
  sourceRole?: string;
  confidence?: number;
  legacyValue?: unknown;
  unifiedValue?: unknown;
  reason?: string;
  consumerVisible?: boolean;
  affectedOutput?: string[];
  frozenDomains?: string[];
  execute?: boolean;
}

export interface ClassifiedProposal {
  proposal: ControlledBatchProposal;
  classification: ProposalReviewClassification;
  classificationReason: string;
  risk?: RiskLevel;
  consumerImpact?: string;
  rollbackImpact?: string;
}

export interface RealProductionFix {
  eventId: string;
  eventTitle: string;
  field: string;
  currentProductionValue: unknown;
  proposedValue: unknown;
  publicSourceEvidence: unknown;
  sourceRole: string;
  whyProductionWrong: string;
  whyUnifiedCorrect: string;
  consumerImpact: string;
  confidence: number;
  risk: RiskLevel;
  rollbackImpact: string;
}

const BOOTSHAUS_OG_TITLE_SUFFIX = /\s*\|\s*Bootshaus Club\s*$/i;
const AFFENKAEFIG_TITLE_SUFFIX = /\s*[–-]\s*Affenkaefig Veranstaltungen\s*$/i;
const UNSUPPORTED_FIELDS = new Set(['ticketUrl', 'price', 'checkout_url', 'lineup', 'organizer', 'promoter']);

const CONTAMINATION_MARKERS: Array<{ pattern: RegExp; wrongEvent: string }> = [
  { pattern: /UNDERLAND ESSIGFABRIK/i, wrongEvent: 'Underland' },
  { pattern: /Rheinaudio präsentiert/i, wrongEvent: 'Underland' },
];

function stripBootshausOgTitle(value: unknown): string {
  return String(value ?? '')
    .replace(BOOTSHAUS_OG_TITLE_SUFFIX, '')
    .replace(AFFENKAEFIG_TITLE_SUFFIX, '')
    .trim();
}

function normalizeUrl(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\/$/, '')
    .toLowerCase();
}

function normalizeDescription(value: unknown): string {
  const decoded = decodeHtmlEntities(String(value ?? ''));
  return (
    normalizeText(decoded, 50_000)
      ?.replace(/\s+/g, ' ')
      .trim()
      .toLowerCase() ?? ''
  );
}

function collapseWhitespaceAndPunctuation(value: unknown): string {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function stripEmojis(value: unknown): string {
  return String(value ?? '').replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '');
}

function normalizeDescriptionCore(value: unknown): string {
  const decoded = decodeHtmlEntities(String(value ?? ''));
  return collapseWhitespaceAndPunctuation(stripEmojis(decoded));
}

function descriptionCoreSimilarity(current: unknown, proposed: unknown): number {
  const a = normalizeDescriptionCore(current);
  const b = normalizeDescriptionCore(proposed);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length > 80 && longer.includes(shorter.slice(0, Math.min(240, shorter.length)))) {
    return 0.96;
  }
  return 0;
}

function isDescriptionFormattingOnly(current: unknown, proposed: unknown): boolean {
  if (valuesSemanticallyEqual(current, proposed)) return true;
  if (normalizeDescriptionCore(current) === normalizeDescriptionCore(proposed)) return true;
  if (descriptionCoreSimilarity(current, proposed) >= 0.95) return true;
  const nc = normalizeDescription(current);
  const np = normalizeDescription(proposed);
  if (!nc || !np) return false;
  if (nc === np) return true;
  if (collapseWhitespaceAndPunctuation(current) === collapseWhitespaceAndPunctuation(proposed)) return true;
  if (nc.length > 60 && np.length > 60 && (nc.includes(np.slice(0, 80)) || np.includes(nc.slice(0, 80)))) {
    return true;
  }
  return false;
}

function hasLegacyHtmlEntities(value: unknown): boolean {
  return /&(?:[a-z]+|#\d+);/i.test(String(value ?? ''));
}

function parseInstant(value: unknown): number | null {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

function isSameInstant(a: unknown, b: unknown): boolean {
  const ta = parseInstant(a);
  const tb = parseInstant(b);
  return ta !== null && tb !== null && ta === tb;
}

function hasContamination(text: unknown, eventTitle: string): boolean {
  const raw = String(text ?? '');
  for (const marker of CONTAMINATION_MARKERS) {
    if (marker.pattern.test(raw) && !eventTitle.toLowerCase().includes(marker.wrongEvent.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function isFlyerFormattingOnly(current: unknown, proposed: unknown): boolean {
  const c = normalizeUrl(current);
  const p = normalizeUrl(proposed);
  if (!c || !p) return false;
  if (c === p) return true;
  return c.replace(/-\d+x\d+(?=\.\w+$)/, '') === p.replace(/-\d+x\d+(?=\.\w+$)/, '');
}

export function classifyControlledBatchProposal(proposal: ControlledBatchProposal): ClassifiedProposal {
  const { field, currentCanonical, proposedValue, publicEvidence, title } = proposal;

  if (UNSUPPORTED_FIELDS.has(field)) {
    return {
      proposal,
      classification: 'IMPORTER_UNSUPPORTED',
      classificationReason: `Field "${field}" is outside official-website importer ownership for controlled batch.`,
    };
  }

  const hasPublic =
    publicEvidence !== undefined && publicEvidence !== null && publicEvidence !== '';
  if (!hasPublic) {
    return {
      proposal,
      classification: 'PUBLIC_SOURCE_HAS_NO_FIELD',
      classificationReason: 'No public source evidence for this field on the official page.',
    };
  }

  if (field === 'title') {
    const strippedCurrent = stripBootshausOgTitle(currentCanonical);
    const strippedProposed = stripBootshausOgTitle(proposedValue);
    const strippedPublic = stripBootshausOgTitle(publicEvidence);
    if (strippedCurrent === strippedProposed && strippedProposed === strippedPublic) {
      return {
        proposal,
        classification: 'FORMATTING_ONLY',
        classificationReason: 'Only og:title branding suffix differs (e.g. "| Bootshaus Club"); consumer title unchanged.',
      };
    }
    if (strippedCurrent !== strippedProposed && strippedProposed === strippedPublic) {
      return {
        proposal,
        classification: 'REVIEW_REQUIRED',
        classificationReason: 'Title body differs beyond og suffix stripping; needs human confirmation.',
        risk: 'MEDIUM',
      };
    }
  }

  if (field === 'description') {
    if (isDescriptionFormattingOnly(currentCanonical, proposedValue)) {
      return {
        proposal,
        classification: 'FORMATTING_ONLY',
        classificationReason: 'Whitespace, HTML entity, or punctuation normalization only; semantic content unchanged.',
      };
    }
    if (!isDescriptionFormattingOnly(currentCanonical, proposedValue) && valuesSemanticallyEqual(proposedValue, publicEvidence)) {
      const similarity = descriptionCoreSimilarity(currentCanonical, proposedValue);
      if (hasContamination(currentCanonical, title)) {
        return {
          proposal,
          classification: 'REAL_PRODUCTION_FIX',
          classificationReason: 'Canonical description contains wrong-event contamination; unified matches official page.',
          risk: 'HIGH',
          consumerImpact: 'Event detail description replaces wrong event text with official page body.',
          rollbackImpact: 'Restore previous description from pre-batch snapshot.',
        };
      }
      if (hasLegacyHtmlEntities(currentCanonical)) {
        return {
          proposal,
          classification: 'REVIEW_REQUIRED',
          classificationReason:
            'Legacy HTML entity encoding in production; unified/public text is a decode/normalization candidate, not a proven semantic correction.',
          risk: 'LOW',
        };
      }
      if (similarity >= 0.75) {
        return {
          proposal,
          classification: 'REVIEW_REQUIRED',
          classificationReason:
            'Description differs mainly by HTML entity, whitespace, or minor public-page markup normalization; not a clear production error.',
          risk: 'LOW',
        };
      }
      return {
        proposal,
        classification: 'REAL_PRODUCTION_FIX',
        classificationReason: 'Production description materially differs from public official page; unified matches public truth.',
        risk: 'MEDIUM',
        consumerImpact: 'Event detail description text updates to match official website.',
        rollbackImpact: 'Restore prior description from batch snapshot.',
      };
    }
  }

  if (field === 'dateTime') {
    if (isSameInstant(currentCanonical, proposedValue)) {
      return {
        proposal,
        classification: 'FORMATTING_ONLY',
        classificationReason: 'Same event instant; only ISO timezone/format representation differs.',
      };
    }
    return {
      proposal,
      classification: 'REVIEW_REQUIRED',
      classificationReason: 'Date/time instant may differ; requires timezone and public page confirmation.',
      risk: 'HIGH',
      consumerImpact: 'Could change displayed event date/time if applied.',
      rollbackImpact: 'Restore start_date from pre-batch snapshot.',
    };
  }

  if (field === 'city' || field === 'location' || field === 'venue' || field === 'coordinates') {
    if (valuesSemanticallyEqual(currentCanonical, proposedValue)) {
      return {
        proposal,
        classification: 'FORMATTING_ONLY',
        classificationReason: 'Location field differs only by formatting.',
      };
    }
    return {
      proposal,
      classification: 'REVIEW_REQUIRED',
      classificationReason: 'Venue/location change from JSON-LD needs human verification against multi-source roles.',
      risk: 'HIGH',
      consumerImpact: 'Could change venue or location labels on event detail and cards.',
      rollbackImpact: 'Restore venue/location fields from pre-batch snapshot.',
    };
  }

  if (field === 'flyer' || field === 'gallery') {
    if (isFlyerFormattingOnly(currentCanonical, proposedValue)) {
      return {
        proposal,
        classification: 'FORMATTING_ONLY',
        classificationReason: 'Same image asset; only resize suffix or trailing slash differs.',
      };
    }
    if (normalizeUrl(currentCanonical) !== normalizeUrl(proposedValue)) {
      return {
        proposal,
        classification: 'REAL_PRODUCTION_FIX',
        classificationReason: 'Official og:image differs from current canonical flyer URL.',
        risk: 'MEDIUM',
        consumerImpact: 'Hero image / flyer on event detail and discovery cards updates.',
        rollbackImpact: 'Restore prior image_url from pre-batch snapshot.',
      };
    }
  }

  if (valuesSemanticallyEqual(currentCanonical, proposedValue)) {
    return {
      proposal,
      classification: 'FORMATTING_ONLY',
      classificationReason: 'Values are semantically equal after normalization.',
    };
  }

  return {
    proposal,
    classification: 'REVIEW_REQUIRED',
    classificationReason: 'Could not auto-classify; requires human reviewer.',
    risk: 'MEDIUM',
  };
}

export function toRealProductionFix(classified: ClassifiedProposal): RealProductionFix | null {
  if (classified.classification !== 'REAL_PRODUCTION_FIX') return null;
  const p = classified.proposal;
  const risk = classified.risk ?? 'MEDIUM';
  return {
    eventId: p.eventId,
    eventTitle: p.title,
    field: p.field,
    currentProductionValue: p.currentCanonical,
    proposedValue: p.proposedValue,
    publicSourceEvidence: p.publicEvidence,
    sourceRole: p.sourceRole ?? 'official_website_source',
    whyProductionWrong: classified.classificationReason,
    whyUnifiedCorrect: 'Unified official-website importer extracts value directly from live public page evidence.',
    consumerImpact: classified.consumerImpact ?? `Updates consumer-visible ${p.field}.`,
    confidence: p.confidence ?? 0.85,
    risk,
    rollbackImpact: classified.rollbackImpact ?? 'Restore field from pre-batch snapshot.',
  };
}

export interface ElevatedFieldFinding {
  eventId: string;
  title: string;
  field: string;
  currentCanonical: unknown;
  proposedValue: unknown;
  publicEvidence: unknown;
  note: string;
}

/** Rows missed by preview builder but visible in shadow field comparison. */
export function elevateMissedProductionFixes(
  fieldComparisonItems: Array<{
    eventId: string;
    title: string;
    field: string;
    status: string;
    publicTruth?: unknown;
    unified?: unknown;
    canonical?: unknown;
  }>,
): ElevatedFieldFinding[] {
  const elevated: ElevatedFieldFinding[] = [];
  for (const row of fieldComparisonItems) {
    if (row.field !== 'description') continue;
    if (row.status !== 'UNIFIED_MATCHES_PUBLIC_TRUTH' && row.status !== 'STALE_CANONICAL_PRODUCTION') continue;
    if (!row.publicTruth || !row.unified) continue;
    if (valuesSemanticallyEqual(row.canonical, row.unified)) continue;
    if (hasContamination(row.canonical, row.title) || !valuesSemanticallyEqual(row.canonical, row.publicTruth)) {
      elevated.push({
        eventId: row.eventId,
        title: row.title,
        field: row.field,
        currentCanonical: row.canonical,
        proposedValue: row.unified,
        publicEvidence: row.publicTruth,
        note: 'Elevated from shadow field comparison — canonical stale vs public truth but omitted from Phase 4.8.2 preview.',
      });
    }
  }
  return elevated;
}

export function classifyAllProposals(proposals: ControlledBatchProposal[]): ClassifiedProposal[] {
  return proposals.map(classifyControlledBatchProposal);
}

export function summarizeClassifications(classified: ClassifiedProposal[]): Record<ProposalReviewClassification, number> {
  const totals: Record<ProposalReviewClassification, number> = {
    REAL_PRODUCTION_FIX: 0,
    FORMATTING_ONLY: 0,
    PUBLIC_SOURCE_HAS_NO_FIELD: 0,
    DIFFERENT_EVENT_CONTEXT: 0,
    IMPORTER_UNSUPPORTED: 0,
    REVIEW_REQUIRED: 0,
  };
  for (const item of classified) {
    totals[item.classification] += 1;
  }
  return totals;
}
