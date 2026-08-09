import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { valuesSemanticallyEqual } from '@/features/import/shadow/official-website-public-truth';

import type { GenericTruthFieldGroup } from './source-evidence-contract';

const GROUP_FIELDS: Record<GenericTruthFieldGroup, (keyof ImportPublishFieldPatch)[]> = {
  identity_schedule_venue: [
    'title',
    'subtitle',
    'startDate',
    'endDate',
    'timezone',
    'doorsOpenAt',
    'venueName',
    'venueCity',
    'venueAddress',
    'venuePostalCode',
    'venueCountryCode',
    'latitude',
    'longitude',
    'organizerName',
    'websiteUrl',
  ],
  tickets: ['priceText', 'ticketStatus', 'ticketPhases'],
  description: ['description'],
  genres: ['genreLabels'],
  lineup: [],
  age_environment: ['ageRestriction', 'venueEnvironment'],
  cta_checkout: ['ticketUrl'],
};

function normalizeIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value.trim();
  return new Date(parsed).toISOString();
}

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = new URL(value.trim());
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizePriceText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+(?=€)/g, '')
    .trim()
    .toLowerCase();
}

function normalizeGenreLabels(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const labels = value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim().toLowerCase())
    .sort();
  return labels.length ? labels : undefined;
}

function normalizePhases(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const phases = value as CanonicalTicketPhase[];
  const normalized = phases
    .map((phase) => ({
      name: phase.name?.trim().toLowerCase(),
      kind: phase.kind,
      priceAmount: phase.priceAmount,
      totalPriceAmount: phase.totalPriceAmount,
      priceLabel: normalizePriceText(phase.priceLabel),
      soldOut: phase.soldOut ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(normalized);
}

export function normalizePublishFieldValue(
  field: keyof ImportPublishFieldPatch,
  value: unknown,
): unknown {
  if (value === undefined || value === null) return undefined;
  if (field === 'startDate' || field === 'endDate' || field === 'doorsOpenAt') {
    return normalizeIsoDate(value);
  }
  if (field === 'ticketUrl' || field === 'websiteUrl' || field === 'imageUrl') {
    return normalizeUrl(value);
  }
  if (field === 'priceText') {
    return normalizePriceText(value);
  }
  if (field === 'genreLabels') {
    return normalizeGenreLabels(value);
  }
  if (field === 'ticketPhases') {
    return normalizePhases(value);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

export function publishFieldsNormalizedEqual(
  field: keyof ImportPublishFieldPatch,
  before: unknown,
  after: unknown,
): boolean {
  const normalizedBefore = normalizePublishFieldValue(field, before);
  const normalizedAfter = normalizePublishFieldValue(field, after);
  if (normalizedBefore === undefined && normalizedAfter === undefined) return true;
  return valuesSemanticallyEqual(normalizedBefore, normalizedAfter);
}

export interface FieldGroupDeltaReport {
  group: GenericTruthFieldGroup;
  before: unknown;
  proposed: unknown;
  normalizedEqual: boolean;
  wouldChange: boolean;
  blockReason?: string;
}

export function snapshotFromEvent(event: AdminEventRecord): Record<string, unknown> {
  return {
    title: event.title,
    subtitle: event.subtitle,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    doorsOpenAt: event.doorsOpenAt,
    venueName: event.venueName,
    venueCity: event.venueCity,
    venueAddress: event.venueAddress,
    venuePostalCode: event.venuePostalCode,
    venueCountryCode: event.venueCountryCode,
    latitude: event.latitude,
    longitude: event.longitude,
    organizerName: event.organizerName,
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    imageUrl: event.imageUrl,
    ageRestriction: event.ageRestriction,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    genreLabels: event.genreLabels,
    venueEnvironment: event.venueEnvironment,
  };
}

export function buildFieldGroupDeltas(input: {
  before: AdminEventRecord;
  patch: ImportPublishFieldPatch;
  blockedGroups: Partial<Record<GenericTruthFieldGroup, string>>;
}): FieldGroupDeltaReport[] {
  const reports: FieldGroupDeltaReport[] = [];

  for (const group of Object.keys(GROUP_FIELDS) as GenericTruthFieldGroup[]) {
    const fields = GROUP_FIELDS[group];
    let groupBefore: Record<string, unknown> = {};
    let groupProposed: Record<string, unknown> = {};
    let wouldChange = false;
    let normalizedEqual = true;

    for (const field of fields) {
      const beforeValue = snapshotFromEvent(input.before)[field];
      const proposedValue = input.patch[field];
      if (proposedValue === undefined) continue;
      if (input.blockedGroups[group]) continue;

      groupBefore[field] = beforeValue;
      groupProposed[field] = proposedValue;
      const equal = publishFieldsNormalizedEqual(field, beforeValue, proposedValue);
      if (!equal) {
        wouldChange = true;
        normalizedEqual = false;
      }
    }

    reports.push({
      group,
      before: groupBefore,
      proposed: groupProposed,
      normalizedEqual,
      wouldChange,
      blockReason: input.blockedGroups[group],
    });
  }

  return reports;
}

export function patchHasApplicableChanges(
  before: AdminEventRecord,
  patch: ImportPublishFieldPatch,
  blockedGroups: Partial<Record<GenericTruthFieldGroup, string>>,
): boolean {
  return buildFieldGroupDeltas({ before, patch, blockedGroups }).some((delta) => delta.wouldChange);
}

export function filterBlockedPatch(
  patch: ImportPublishFieldPatch,
  blockedGroups: Partial<Record<GenericTruthFieldGroup, string>>,
): ImportPublishFieldPatch {
  const filtered: ImportPublishFieldPatch = { ...patch };
  for (const [group, fields] of Object.entries(GROUP_FIELDS) as [
    GenericTruthFieldGroup,
    (keyof ImportPublishFieldPatch)[],
  ][]) {
    if (!blockedGroups[group]) continue;
    for (const field of fields) {
      delete filtered[field];
    }
  }
  return filtered;
}
