import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import type { AdminEventTicketStatus } from '@/features/import/domain/canonical-ticket-phase';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';

export interface CanonicalTicketFieldSnapshot {
  ticketUrl?: string | null;
  priceText?: string | null;
  ticketStatus?: AdminEventTicketStatus | string | null;
  ticketPhases?: CanonicalTicketPhase[] | null;
}

export interface SemanticFieldDifference {
  path: string;
  expected: unknown;
  actual: unknown;
}

export interface CanonicalTicketSnapshotCompareResult {
  equal: boolean;
  materialDifferences: SemanticFieldDifference[];
  normalizedDifferences: SemanticFieldDifference[];
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConcreteTicketUrl(value: string | null | undefined): string | null {
  const text = normalizeOptionalText(value);
  if (!text) {
    return null;
  }
  try {
    const parsed = new URL(text);
    parsed.hash = '';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname === '/' ? '/' : pathname}`;
  } catch {
    return text.replace(/\/+$/, '').toLowerCase();
  }
}

function isShopRootTicketUrl(url: string | null): boolean {
  if (!url) {
    return false;
  }
  const classified = classifyTicketDestination(url);
  return classified.destinationClass === 'ticket_platform_root';
}

function normalizePriceAmount(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(4));
}

function normalizeTicketPhaseForCompare(phase: CanonicalTicketPhase) {
  return {
    id: phase.id,
    name: phase.name.trim(),
    kind: phase.kind,
    sortOrder: phase.sortOrder,
    priceAmount: normalizePriceAmount(phase.priceAmount),
    priceCurrency: phase.priceCurrency ?? 'EUR',
    priceLabel: normalizeOptionalText(phase.priceLabel),
    soldOut: phase.soldOut ?? false,
    isFree: phase.isFree ?? false,
    purchaseUrl: normalizeConcreteTicketUrl(phase.purchaseUrl),
  };
}

function sortPhasesForCompare(phases: CanonicalTicketPhase[]): ReturnType<typeof normalizeTicketPhaseForCompare>[] {
  return [...phases]
    .map(normalizeTicketPhaseForCompare)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.name.localeCompare(right.name, 'de');
    });
}

function normalizeTicketPhasesValue(
  phases: CanonicalTicketPhase[] | null | undefined,
): CanonicalTicketPhase[] | null {
  if (phases === null) {
    return null;
  }
  if (!Array.isArray(phases) || phases.length === 0) {
    return null;
  }
  return phases;
}

export function compareCanonicalTicketPhasesSemantically(
  expected: CanonicalTicketPhase[] | null | undefined,
  actual: CanonicalTicketPhase[] | null | undefined,
): CanonicalTicketSnapshotCompareResult {
  const materialDifferences: SemanticFieldDifference[] = [];
  const normalizedDifferences: SemanticFieldDifference[] = [];

  const expectedPhases = normalizeTicketPhasesValue(expected);
  const actualPhases = normalizeTicketPhasesValue(actual);

  if (expectedPhases === null && actualPhases === null) {
    return { equal: true, materialDifferences, normalizedDifferences };
  }
  if (expectedPhases === null || actualPhases === null) {
    materialDifferences.push({
      path: 'ticketPhases',
      expected: expectedPhases,
      actual: actualPhases,
    });
    return { equal: false, materialDifferences, normalizedDifferences };
  }

  if (expectedPhases.length !== actualPhases.length) {
    materialDifferences.push({
      path: 'ticketPhases.length',
      expected: expectedPhases.length,
      actual: actualPhases.length,
    });
    return { equal: false, materialDifferences, normalizedDifferences };
  }

  const expectedNormalized = sortPhasesForCompare(expectedPhases);
  const actualNormalized = sortPhasesForCompare(actualPhases);

  for (let index = 0; index < expectedNormalized.length; index += 1) {
    const path = `ticketPhases[${index}]`;
    const expectedPhase = expectedNormalized[index]!;
    const actualPhase = actualNormalized[index]!;
    for (const key of Object.keys(expectedPhase) as Array<keyof typeof expectedPhase>) {
      if (expectedPhase[key] !== actualPhase[key]) {
        materialDifferences.push({
          path: `${path}.${key}`,
          expected: expectedPhase[key],
          actual: actualPhase[key],
        });
      }
    }
  }

  if (
    materialDifferences.length === 0 &&
    JSON.stringify(expectedPhases) !== JSON.stringify(actualPhases)
  ) {
    normalizedDifferences.push({
      path: 'ticketPhases',
      expected: expectedPhases,
      actual: actualPhases,
    });
  }

  return {
    equal: materialDifferences.length === 0,
    materialDifferences,
    normalizedDifferences,
  };
}

export function compareCanonicalTicketSnapshotSemantically(
  expected: CanonicalTicketFieldSnapshot,
  actual: CanonicalTicketFieldSnapshot,
): CanonicalTicketSnapshotCompareResult {
  const materialDifferences: SemanticFieldDifference[] = [];
  const normalizedDifferences: SemanticFieldDifference[] = [];

  const expectedUrl = normalizeConcreteTicketUrl(expected.ticketUrl);
  const actualUrl = normalizeConcreteTicketUrl(actual.ticketUrl);
  if (expectedUrl !== actualUrl) {
    materialDifferences.push({
      path: 'ticketUrl',
      expected: expected.ticketUrl ?? null,
      actual: actual.ticketUrl ?? null,
    });
  } else if (
    isShopRootTicketUrl(actualUrl) &&
    expectedUrl &&
    !isShopRootTicketUrl(expectedUrl)
  ) {
    materialDifferences.push({
      path: 'ticketUrl',
      expected: expected.ticketUrl ?? null,
      actual: actual.ticketUrl ?? null,
    });
  }

  const expectedPrice = normalizeOptionalText(expected.priceText);
  const actualPrice = normalizeOptionalText(actual.priceText);
  if (expectedPrice !== actualPrice) {
    materialDifferences.push({
      path: 'priceText',
      expected: expected.priceText ?? null,
      actual: actual.priceText ?? null,
    });
  }

  const expectedStatus = expected.ticketStatus ?? null;
  const actualStatus = actual.ticketStatus ?? null;
  if (expectedStatus !== actualStatus) {
    materialDifferences.push({
      path: 'ticketStatus',
      expected: expectedStatus,
      actual: actualStatus,
    });
  }

  const phaseResult = compareCanonicalTicketPhasesSemantically(
    expected.ticketPhases,
    actual.ticketPhases,
  );
  materialDifferences.push(...phaseResult.materialDifferences);
  normalizedDifferences.push(...phaseResult.normalizedDifferences);

  if (
    materialDifferences.length === 0 &&
    (expected.ticketUrl ?? null) !== (actual.ticketUrl ?? null) &&
    expectedUrl === actualUrl
  ) {
    normalizedDifferences.push({
      path: 'ticketUrl',
      expected: expected.ticketUrl ?? null,
      actual: actual.ticketUrl ?? null,
    });
  }

  return {
    equal: materialDifferences.length === 0,
    materialDifferences,
    normalizedDifferences,
  };
}

export function strictTicketSnapshotEqual(
  expected: CanonicalTicketFieldSnapshot,
  actual: CanonicalTicketFieldSnapshot,
): boolean {
  const snapshot = (value: CanonicalTicketFieldSnapshot) => ({
    ticketUrl: value.ticketUrl ?? null,
    priceText: value.priceText ?? null,
    ticketStatus: value.ticketStatus ?? null,
    ticketPhases: value.ticketPhases ?? null,
  });
  return JSON.stringify(snapshot(expected)) === JSON.stringify(snapshot(actual));
}
