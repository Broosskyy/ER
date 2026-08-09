import {
  analyzeEventTitleCore,
  compareEventTitleCores,
  scoreTitleCoreAgreement,
} from '@/features/import/matching/event-title-core';
import { sameCalendarDay } from '@/features/import/matching/matching-utils';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';

export type CanonicalCollisionVerdict = 'none' | 'collision_review_required';

export interface CanonicalIdentityCollisionResult {
  verdict: CanonicalCollisionVerdict;
  collisionEventIds: string[];
  reasons: string[];
  signals: {
    titleCoreAgrees: boolean;
    venueCompatible: boolean;
    officialIdentityAgrees: boolean;
    adjacentUtcLocalDay: boolean;
    overlappingSchedule: boolean;
    ticketUrlsDiffer: boolean;
  };
}

function normalizeOfficialUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    parsed.search = '';
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}`;
  } catch {
    return undefined;
  }
}

function officialIdentityAgrees(left: EventIdentitySnapshot, right: EventIdentitySnapshot): boolean {
  const leftOfficial = normalizeOfficialUrl(left.websiteUrl);
  const rightOfficial = normalizeOfficialUrl(right.websiteUrl);
  if (leftOfficial && rightOfficial) {
    return leftOfficial === rightOfficial;
  }
  if (left.sourceId && right.sourceId && left.sourceId === right.sourceId) {
    return true;
  }
  return false;
}

function parseInstant(value: string | undefined): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function utcCalendarDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function adjacentUtcCalendarDays(left: string | undefined, right: string | undefined): boolean {
  const leftDate = parseInstant(left);
  const rightDate = parseInstant(right);
  if (!leftDate || !rightDate) {
    return false;
  }
  const leftKey = utcCalendarDayKey(leftDate);
  const rightKey = utcCalendarDayKey(rightDate);
  if (leftKey === rightKey) {
    return true;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.abs(leftDate.getTime() - rightDate.getTime()) / dayMs;
  return diffDays <= 1;
}

function overlappingSchedule(left: EventIdentitySnapshot, right: EventIdentitySnapshot): boolean {
  const leftStart = parseInstant(left.startDate);
  const rightStart = parseInstant(right.startDate);
  if (!leftStart || !rightStart) {
    return false;
  }
  const windowMs = 8 * 60 * 60 * 1000;
  return Math.abs(leftStart.getTime() - rightStart.getTime()) <= windowMs;
}

function sameLocalEventDay(left: EventIdentitySnapshot, right: EventIdentitySnapshot): boolean {
  if (!left.startDate || !right.startDate) {
    return false;
  }
  return sameCalendarDay(left.startDate, right.startDate);
}

function titleCoreAgrees(left: EventIdentitySnapshot, right: EventIdentitySnapshot): boolean {
  const leftCore = analyzeEventTitleCore(left.title, {
    venueName: left.venueName,
  });
  const rightCore = analyzeEventTitleCore(right.title, {
    venueName: right.venueName,
  });
  const comparison = compareEventTitleCores(leftCore, rightCore);
  if (comparison.coresAgree && comparison.maxMatchStrength !== 'none') {
    return true;
  }
  const scored = scoreTitleCoreAgreement(left.title, right.title, {
    dateAgrees: sameLocalEventDay(left, right) || adjacentUtcCalendarDays(left.startDate, right.startDate),
    venueCompatible: venueCompatible(left.venueName, right.venueName),
  }, {
    left: { venueName: left.venueName },
    right: { venueName: right.venueName },
  });
  return scored.maxMatchStrength === 'exact' || scored.maxMatchStrength === 'partial';
}

export function evaluateCanonicalIdentityCollision(
  target: EventIdentitySnapshot,
  catalog: EventIdentitySnapshot[],
): CanonicalIdentityCollisionResult {
  const competitors = catalog.filter((entry) => entry.eventId !== target.eventId);
  const collisionEventIds: string[] = [];
  const reasons: string[] = [];
  let strongestSignals: CanonicalIdentityCollisionResult['signals'] | undefined;

  for (const other of competitors) {
    const titleAgrees = titleCoreAgrees(target, other);
    const venueOk = venueCompatible(target.venueName, other.venueName);
    const officialOk = officialIdentityAgrees(target, other);
    const adjacentDay =
      adjacentUtcCalendarDays(target.startDate, other.startDate) || sameLocalEventDay(target, other);
    const overlap = overlappingSchedule(target, other);
    const ticketUrlsDiffer =
      Boolean(target.ticketUrl?.trim() && other.ticketUrl?.trim()) &&
      target.ticketUrl!.trim() !== other.ticketUrl!.trim();

    const signals = {
      titleCoreAgrees: titleAgrees,
      venueCompatible: venueOk,
      officialIdentityAgrees: officialOk,
      adjacentUtcLocalDay: adjacentDay,
      overlappingSchedule: overlap,
      ticketUrlsDiffer,
    };

    const canonicalCollision =
      titleAgrees &&
      venueOk &&
      officialOk &&
      (sameLocalEventDay(target, other) || adjacentDay || overlap);

    if (!canonicalCollision) {
      continue;
    }

    collisionEventIds.push(other.eventId);
    if (ticketUrlsDiffer) {
      reasons.push('divergent_ticket_urls_under_shared_identity');
    }
    if (adjacentDay && !sameLocalEventDay(target, other)) {
      reasons.push('adjacent_utc_local_day_shift');
    }
    strongestSignals = signals;
  }

  if (collisionEventIds.length === 0) {
    return {
      verdict: 'none',
      collisionEventIds: [],
      reasons: [],
      signals: {
        titleCoreAgrees: false,
        venueCompatible: false,
        officialIdentityAgrees: false,
        adjacentUtcLocalDay: false,
        overlappingSchedule: false,
        ticketUrlsDiffer: false,
      },
    };
  }

  return {
    verdict: 'collision_review_required',
    collisionEventIds: [...new Set(collisionEventIds)],
    reasons: [...new Set(['canonical_identity_collision', ...reasons])],
    signals: strongestSignals ?? {
      titleCoreAgrees: true,
      venueCompatible: true,
      officialIdentityAgrees: true,
      adjacentUtcLocalDay: true,
      overlappingSchedule: false,
      ticketUrlsDiffer: false,
    },
  };
}
