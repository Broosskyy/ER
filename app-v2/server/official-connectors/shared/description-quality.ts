import {
  isAgeAdmissionParagraph,
  isBoilerplateParagraph,
  isTicketCtaParagraph,
} from '../bootshaus/parse-description';

export type DescriptionBlockCategory =
  | 'EVENT_EDITORIAL'
  | 'EVENT_DETAILS'
  | 'LINEUP_CONTEXT'
  | 'VENUE_INFO'
  | 'ADMISSION_POLICY'
  | 'TICKET_POLICY'
  | 'LEGAL'
  | 'PRIVACY'
  | 'CHECKOUT_BOILERPLATE'
  | 'UNKNOWN';

const TICKET_POLICY_MARKERS = [
  /all sales are final/i,
  /jeder kauf ist endgültig/i,
  /kein umtausch/i,
  /no refund/i,
  /ticket-?weiterverkauf/i,
  /besitz der tickets verbrieft/i,
  /zutrittsrecht/i,
  /proof of age/i,
  /identity card/i,
  /driver'?s license/i,
  /student id/i,
  /health insurance card/i,
  /photos or scans/i,
];

const LEGAL_MARKERS = [/\bagb\b/i, /terms and conditions/i, /nutzungsbedingungen/i, /widerruf/i];
const PRIVACY_MARKERS = [/privacy policy/i, /datenschutz/i, /cookie/i];
const CHECKOUT_MARKERS = [/checkout/i, /zahlungsart/i, /payment method/i];

export function classifyDescriptionParagraph(text: string): DescriptionBlockCategory {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'UNKNOWN';
  }

  if (isAgeAdmissionParagraph(trimmed)) {
    return 'ADMISSION_POLICY';
  }
  if (TICKET_POLICY_MARKERS.some((pattern) => pattern.test(trimmed))) {
    return 'TICKET_POLICY';
  }
  if (LEGAL_MARKERS.some((pattern) => pattern.test(trimmed))) {
    return 'LEGAL';
  }
  if (PRIVACY_MARKERS.some((pattern) => pattern.test(trimmed))) {
    return 'PRIVACY';
  }
  if (CHECKOUT_MARKERS.some((pattern) => pattern.test(trimmed))) {
    return 'CHECKOUT_BOILERPLATE';
  }
  if (isTicketCtaParagraph(trimmed) || isBoilerplateParagraph(trimmed)) {
    return 'TICKET_POLICY';
  }

  if (/^line\s*-?\s*up\b/i.test(trimmed) || /\bfeaturing\b/i.test(trimmed)) {
    return 'LINEUP_CONTEXT';
  }
  if (/\bvenue\b|\blocation\b|\badresse\b/i.test(trimmed) && trimmed.length < 220) {
    return 'VENUE_INFO';
  }

  return 'EVENT_EDITORIAL';
}

const NON_EDITORIAL_CATEGORIES = new Set<DescriptionBlockCategory>([
  'ADMISSION_POLICY',
  'TICKET_POLICY',
  'LEGAL',
  'PRIVACY',
  'CHECKOUT_BOILERPLATE',
]);

export function extractEditorialDescription(text?: string): string | undefined {
  if (!text?.trim()) {
    return undefined;
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const editorial = paragraphs.filter((paragraph) => {
    const category = classifyDescriptionParagraph(paragraph);
    return !NON_EDITORIAL_CATEGORIES.has(category);
  });

  const joined = editorial.join('\n\n').trim();
  return joined.length > 0 ? joined : undefined;
}

export function descriptionEditorialRatio(text?: string): number {
  if (!text?.trim()) {
    return 0;
  }
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return 0;
  }
  const editorialCount = paragraphs.filter(
    (paragraph) => !NON_EDITORIAL_CATEGORIES.has(classifyDescriptionParagraph(paragraph)),
  ).length;
  return editorialCount / paragraphs.length;
}

export function isInvalidPrimaryDescription(text?: string): boolean {
  const clean = text?.trim();
  if (!clean) {
    return false;
  }
  const editorial = extractEditorialDescription(clean);
  if (!editorial) {
    return true;
  }
  if (editorial.length < 80 && descriptionEditorialRatio(clean) < 0.5) {
    return true;
  }
  return false;
}

export function descriptionQualityScore(text?: string): number {
  const clean = text?.trim();
  if (!clean) {
    return 0;
  }
  const editorial = extractEditorialDescription(clean);
  if (!editorial) {
    return 0;
  }
  let score = Math.min(editorial.length / 400, 1) * 0.6;
  score += descriptionEditorialRatio(clean) * 0.4;
  return score;
}

export function preferDescription(
  left?: string,
  right?: string,
): { value: string | undefined; source: 'left' | 'right' | 'none' } {
  const leftScore = descriptionQualityScore(left);
  const rightScore = descriptionQualityScore(right);
  if (leftScore === 0 && rightScore === 0) {
    return { value: undefined, source: 'none' };
  }
  if (rightScore > leftScore + 0.05) {
    return { value: extractEditorialDescription(right) ?? right?.trim(), source: 'right' };
  }
  if (leftScore > rightScore + 0.05) {
    return { value: extractEditorialDescription(left) ?? left?.trim(), source: 'left' };
  }
  const leftLen = extractEditorialDescription(left)?.length ?? 0;
  const rightLen = extractEditorialDescription(right)?.length ?? 0;
  if (rightLen > leftLen) {
    return { value: extractEditorialDescription(right) ?? right?.trim(), source: 'right' };
  }
  return { value: extractEditorialDescription(left) ?? left?.trim(), source: 'left' };
}
