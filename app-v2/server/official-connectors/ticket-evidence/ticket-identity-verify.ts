export type TicketIdentityResult =
  | 'ticket_identity_verified'
  | 'ticket_identity_conflict'
  | 'ticket_identity_stale_official_link'
  | 'ticket_identity_unverifiable';

export interface TicketIdentityInput {
  providerEventId: string;
  shopHost: string;
  providerTitle?: string;
  providerStartAt?: string;
  providerVenue?: string;
  officialTitle: string;
  officialStartAt: string;
  officialVenue?: string;
  officialTicketUrl?: string;
  canonicalTicketUrl?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseInstant(value: string): number | undefined {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function berlinCalendarDay(value: string): string | undefined {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return undefined;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function sameEventWindow(officialStart: string, providerStart?: string): boolean {
  if (!providerStart) {
    return true;
  }
  if (sameInstant(officialStart, providerStart, 3_600_000)) {
    return true;
  }
  const officialDay = berlinCalendarDay(officialStart);
  const providerDay = berlinCalendarDay(providerStart);
  if (officialDay && providerDay && officialDay === providerDay) {
    return true;
  }
  const officialMs = Date.parse(officialStart);
  const providerMs = Date.parse(providerStart);
  if (Number.isFinite(officialMs) && Number.isFinite(providerMs)) {
    return Math.abs(officialMs - providerMs) <= 3 * 24 * 3_600_000;
  }
  return false;
}

function sameInstant(left?: string, right?: string, toleranceMs = 3_600_000): boolean {
  const leftMs = left ? parseInstant(left) : undefined;
  const rightMs = right ? parseInstant(right) : undefined;
  if (leftMs === undefined || rightMs === undefined) {
    return false;
  }
  return Math.abs(leftMs - rightMs) <= toleranceMs;
}

function venuesCompatible(officialVenue?: string, providerVenue?: string): boolean {
  const left = normalizeText(officialVenue ?? '');
  const right = normalizeText(providerVenue ?? '');
  if (!left || !right) {
    return true;
  }
  if (left.includes(right) || right.includes(left)) {
    return true;
  }
  const leftTokens = new Set(left.split(' ').filter((token) => token.length > 3));
  const rightTokens = new Set(right.split(' ').filter((token) => token.length > 3));
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      return true;
    }
  }
  return false;
}

function titlesCompatible(officialTitle: string, providerTitle?: string, options?: { dateMatches?: boolean }): boolean {
  if (!providerTitle?.trim()) {
    return false;
  }
  const left = normalizeText(officialTitle);
  const right = normalizeText(providerTitle);
  if (left === right) {
    return true;
  }
  if (left.includes(right) || right.includes(left)) {
    return true;
  }
  const leftTokens = left.split(' ').filter((token) => token.length > 2);
  const rightTokens = right.split(' ').filter((token) => token.length > 2);
  const overlap = leftTokens.filter((token) => rightTokens.includes(token));
  if (overlap.length >= Math.min(3, Math.min(leftTokens.length, rightTokens.length))) {
    return true;
  }
  if (options?.dateMatches) {
    const strongOverlap = leftTokens.filter((token) => token.length >= 4 && rightTokens.includes(token));
    if (strongOverlap.length >= 1) {
      return true;
    }
  }
  return false;
}

function normalizeUrlForCompare(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function verifyTicketIdentity(input: TicketIdentityInput): {
  result: TicketIdentityResult;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!input.providerEventId || !input.shopHost) {
    return { result: 'ticket_identity_unverifiable', reasons: ['missing_provider_identity'] };
  }

  const hasProviderEvidence = Boolean(
    input.providerTitle?.trim() || input.providerStartAt?.trim() || input.providerVenue?.trim(),
  );
  if (
    !hasProviderEvidence &&
    input.officialTicketUrl &&
    input.canonicalTicketUrl &&
    normalizeUrlForCompare(input.officialTicketUrl) !== normalizeUrlForCompare(input.canonicalTicketUrl)
  ) {
    return { result: 'ticket_identity_unverifiable', reasons: ['missing_provider_evidence'] };
  }
  if (!hasProviderEvidence && !input.officialTicketUrl) {
    return { result: 'ticket_identity_unverifiable', reasons: ['missing_provider_evidence'] };
  }

  if (input.officialTicketUrl && input.canonicalTicketUrl) {
    if (normalizeUrlForCompare(input.officialTicketUrl) === normalizeUrlForCompare(input.canonicalTicketUrl)) {
      const officialId = input.officialTicketUrl.match(/\/([A-Za-z0-9]{6,12})\/?(?:\?|$)/)?.[1];
      if (
        officialId &&
        input.providerEventId &&
        officialId.toLowerCase() === input.providerEventId.toLowerCase()
      ) {
        return { result: 'ticket_identity_verified', reasons: [] };
      }
      if (
        input.providerStartAt &&
        input.officialStartAt &&
        !sameEventWindow(input.officialStartAt, input.providerStartAt)
      ) {
        return { result: 'ticket_identity_conflict', reasons: ['provider_date_mismatch'] };
      }
      return { result: 'ticket_identity_verified', reasons: [] };
    }

    const officialId = input.officialTicketUrl.match(/\/([A-Za-z0-9]{6,12})\/?(?:\?|$)/)?.[1];
    if (officialId && officialId.toLowerCase() !== input.providerEventId.toLowerCase()) {
      return {
        result: 'ticket_identity_stale_official_link',
        reasons: ['official_link_provider_id_mismatch'],
      };
    }
  }

  if (input.providerStartAt && input.officialStartAt && !sameEventWindow(input.officialStartAt, input.providerStartAt)) {
    reasons.push('provider_date_mismatch');
  }

  if (!venuesCompatible(input.officialVenue, input.providerVenue)) {
    reasons.push('provider_venue_mismatch');
  }

  if (!titlesCompatible(input.officialTitle, input.providerTitle, {
    dateMatches: input.providerStartAt && input.officialStartAt
      ? sameEventWindow(input.officialStartAt, input.providerStartAt)
      : false,
  })) {
    reasons.push('provider_title_mismatch');
  }

  if (reasons.includes('provider_date_mismatch')) {
    return { result: 'ticket_identity_conflict', reasons };
  }
  if (reasons.includes('provider_venue_mismatch')) {
    return { result: 'ticket_identity_conflict', reasons };
  }
  if (reasons.includes('provider_title_mismatch') && reasons.includes('provider_date_mismatch')) {
    return { result: 'ticket_identity_conflict', reasons };
  }
  if (reasons.includes('provider_title_mismatch')) {
    return { result: 'ticket_identity_conflict', reasons };
  }

  return { result: 'ticket_identity_verified', reasons: [] };
}
