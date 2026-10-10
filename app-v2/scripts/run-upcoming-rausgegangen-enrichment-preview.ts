#!/usr/bin/env tsx
/**
 * Upcoming Rausgegangen existing-event enrichment preview.
 *
 * Read-only:
 * - reads a frozen manifest of existing staging records
 * - re-fetches public Rausgegangen event pages
 * - runs the existing Rausgegangen + ticket evidence pipelines
 * - simulates consumer ticket persistence
 * - writes JSON artifacts only
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EventMatchCatalogEntry } from '../server/ingestion/identity/event-match-types';
import {
  planTicketEvidencePersistence,
  summarizeTicketPersistencePlan,
  type TicketPersistencePlannerContext,
} from '../server/official-connectors/ticket-evidence/ticket-persistence-planner';
import type {
  ExistingEventTicketRecord,
} from '../server/official-connectors/ticket-evidence/ticket-persistence-types';
import type { VerifiedTicketCompleteResult } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import {
  finalizeRausgegangenControlledImportEvidence,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-controlled-import-bridge';
import { verifyRausgegangenCandidateLive } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-live-verify';

const REPO_ROOT = join(process.cwd(), '..');
const MANIFEST_PATH = join(
  process.cwd(),
  'scripts',
  'manifests',
  'upcoming-rausgegangen-enrichment-scope.json',
);
const OUT = join(REPO_ROOT, 'artifacts', 'event-enrichment-completeness');

interface CurrentTicket {
  ticketId: string;
  provider: string | null;
  ticketUrl: string | null;
  priceFromMinor: number | null;
  currency: string | null;
  salesStatus: string | null;
  sortOrder: number;
}

interface ScopeEvent {
  eventId: string;
  sourceId: string;
  sourceEventKey: string;
  sourceUrl: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  timezone: string;
  venueName?: string | null;
  city?: string | null;
  organizerName?: string | null;
  currentLineupCount: number;
  hasDescription: boolean;
  currentTicket?: CurrentTicket | null;
}

interface ScopeManifest {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  scope: string;
  count: number;
  events: ScopeEvent[];
}

interface PreviewRow {
  eventId: string;
  sourceEventKey: string;
  title: string;
  sourceUrl: string;
  liveAccessible: boolean;
  fetchStatus?: number;
  current: {
    description: boolean;
    lineupCount: number;
    ticketRow: boolean;
    ticketUrl: boolean;
    ticketPrice: boolean;
    ticketStatus: boolean;
  };
  recovered: {
    description: boolean;
    descriptionText?: string;
    descriptionQualification: string;
    lineupCount: number;
    lineupQualification: string;
    ticketUrl?: string;
    ticketAvailability: string;
    ticketAction: string;
    sourcePriceMinor?: number;
  };
  ticketPipeline?: {
    classification: string;
    identityResult?: string;
    canonicalTicketUrl?: string;
    providerKey?: string;
    normalizedStatus?: string;
    priceState?: string;
    priceMinor?: number;
    ticketSourceState?: string;
    verifiedTicketComplete: boolean;
  };
  promotable: {
    description: boolean;
    lineup: boolean;
    ticketTarget: boolean;
    ticketPrice: boolean;
    ticketStatus: boolean;
  };
  blockers: string[];
  error?: string;
}

function writeJson(name: string, value: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function berlinDateKey(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function loadManifest(): ScopeManifest {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ScopeManifest;
  if (manifest.schemaVersion !== 1) {
    throw new Error('enrichment_scope_schema_invalid');
  }
  if (manifest.events.length !== manifest.count || manifest.count !== 44) {
    throw new Error(
      'enrichment_scope_count_invalid:' + manifest.count + ':' + manifest.events.length,
    );
  }
  const ids = new Set(manifest.events.map((event) => event.eventId));
  const keys = new Set(manifest.events.map((event) => event.sourceEventKey));
  const urls = new Set(manifest.events.map((event) => event.sourceUrl));
  if (ids.size !== manifest.count || keys.size !== manifest.count || urls.size !== manifest.count) {
    throw new Error('enrichment_scope_duplicates');
  }
  return manifest;
}

function buildCatalog(events: ScopeEvent[]): EventMatchCatalogEntry[] {
  return events.map((event) => ({
    eventId: event.eventId,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone || 'Europe/Berlin',
    venueName: event.venueName ?? undefined,
    venueCity: event.city ?? undefined,
    organizerName: event.organizerName ?? undefined,
    lineupBillingNames: [],
    sourceBindings: [
      {
        sourceId: event.sourceId,
        eventId: event.eventId,
        sourceRole: 'official',
        sourceUrl: event.sourceUrl,
        sourceEventKey: event.sourceEventKey,
        connectorId: 'rausgegangen-discovery',
      },
    ],
  }));
}

function buildTicketPlannerContext(events: ScopeEvent[]): TicketPersistencePlannerContext {
  const existingTickets: ExistingEventTicketRecord[] = events.flatMap((event) => {
    const ticket = event.currentTicket;
    if (!ticket) {
      return [];
    }
    return [
      {
        ticketId: ticket.ticketId,
        eventId: event.eventId,
        provider: ticket.provider,
        ticketUrl: ticket.ticketUrl,
        priceFromMinor: ticket.priceFromMinor,
        currency: ticket.currency,
        salesStatus: ticket.salesStatus,
        sortOrder: ticket.sortOrder,
      },
    ];
  });

  return {
    officialBindings: events.map((event) => ({
      eventId: event.eventId,
      officialUrl: event.sourceUrl,
      sourceId: event.sourceId,
      contentHash: null,
      rawPayload: null,
      title: event.title,
    })),
    existingTickets,
    existingTicketSources: [],
  };
}

function currentCompleteness(event: ScopeEvent) {
  return {
    description: event.hasDescription,
    lineupCount: event.currentLineupCount,
    ticketRow: Boolean(event.currentTicket),
    ticketUrl: Boolean(event.currentTicket?.ticketUrl),
    ticketPrice: event.currentTicket?.priceFromMinor != null,
    ticketStatus: Boolean(event.currentTicket?.salesStatus),
  };
}

async function main(): Promise<void> {
  const manifest = loadManifest();
  const catalog = buildCatalog(manifest.events);
  const plannerContext = buildTicketPlannerContext(manifest.events);
  const referenceInstant = new Date();
  const referenceDateLocal = berlinDateKey(referenceInstant);

  const rows: PreviewRow[] = [];
  const ticketResults: VerifiedTicketCompleteResult[] = [];

  for (const [index, event] of manifest.events.entries()) {
    process.stderr.write(
      '[ENRICHMENT] ' +
        String(index + 1).padStart(2, '0') +
        '/' +
        manifest.count +
        ' ' +
        event.sourceEventKey +
        '\n',
    );

    const current = currentCompleteness(event);

    try {
      const live = await verifyRausgegangenCandidateLive(
        {
          identityKey: event.sourceEventKey,
          title: event.title,
          startsAt: event.startsAt,
          city: event.city ?? undefined,
          sourceUrl: event.sourceUrl,
          matchClassification: 'EXISTING_EXACT',
        },
        catalog,
        referenceInstant,
        referenceDateLocal,
        {
          // Existing-event recovery is deliberately slower than discovery.
          // Rausgegangen started returning 403s at the discovery cadence.
          requestDelayMs: 1750,
          maxRetries: 1,
        },
      );

      const finalized = await finalizeRausgegangenControlledImportEvidence(
        live.enriched,
        live.fetchResult,
        referenceInstant.toISOString(),
      );
      if (finalized.ticketResult) {
        ticketResults.push(finalized.ticketResult);
      }

      const evidence = finalized.evidence;
      const recoveredLineup = evidence.lineupCandidates ?? [];
      const ticket = finalized.ticketResult;
      const ticketUrl =
        ticket?.canonicalTicketUrl ??
        ticket?.resolvedAction?.canonicalTicketUrl ??
        live.verification.ticketUrl;
      const normalizedStatus =
        ticket?.ticketEvidence?.normalizedStatus ??
        ticket?.statusProjection?.normalizedStatus;
      const verifiedPrice =
        ticket?.priceEvidence?.state === 'verified_current' &&
        ticket.priceEvidence.amountMinor != null
          ? ticket.priceEvidence.amountMinor
          : undefined;
      const verifiedTarget =
        ticket?.identityResult === 'ticket_identity_verified' &&
        Boolean(ticketUrl?.startsWith('https://'));
      const blockers: string[] = [];

      if (!live.verification.liveAccessible) {
        blockers.push('source_not_live_accessible');
      }
      if (!verifiedTarget && live.verification.ticketUrl) {
        blockers.push('ticket_target_not_identity_verified');
      }
      if (live.verification.lineup.length > 0 && recoveredLineup.length === 0) {
        blockers.push('lineup_hints_not_safe_for_promotion');
      }

      rows.push({
        eventId: event.eventId,
        sourceEventKey: event.sourceEventKey,
        title: event.title,
        sourceUrl: event.sourceUrl,
        liveAccessible: live.verification.liveAccessible,
        fetchStatus: live.verification.fetchStatus,
        current,
        recovered: {
          description: Boolean(evidence.descriptionClean?.trim()),
          descriptionText: evidence.descriptionClean?.trim() || undefined,
          descriptionQualification: live.verification.descriptionQualification,
          lineupCount: recoveredLineup.length,
          lineupQualification: live.verification.lineupQualification,
          ticketUrl,
          ticketAvailability: live.verification.ticketAvailability,
          ticketAction: live.verification.ticketAction,
          sourcePriceMinor: live.verification.currentAdmissionPriceMinor,
        },
        ticketPipeline: ticket
          ? {
              classification: ticket.classification,
              identityResult: ticket.identityResult,
              canonicalTicketUrl: ticket.canonicalTicketUrl,
              providerKey: ticket.providerKey ?? ticket.ticketEvidence?.providerKey,
              normalizedStatus,
              priceState: ticket.priceEvidence?.state,
              priceMinor: ticket.priceEvidence?.amountMinor,
              ticketSourceState: ticket.ticketSourceStateEvidence?.state,
              verifiedTicketComplete: Boolean(ticket.verifiedTicketComplete),
            }
          : undefined,
        promotable: {
          description:
            !current.description &&
            Boolean(evidence.descriptionClean?.trim()) &&
            live.verification.descriptionQualification !== 'NO_DESCRIPTION',
          lineup:
            current.lineupCount === 0 &&
            recoveredLineup.length > 0 &&
            live.verification.lineupQualification === 'FULL_LINEUP',
          // Ticket-field promotability is recalculated from the persistence
          // plan below. Raw pipeline fields are diagnostic only.
          ticketTarget: false,
          ticketPrice: false,
          ticketStatus: false,
        },
        blockers,
      });
    } catch (error) {
      rows.push({
        eventId: event.eventId,
        sourceEventKey: event.sourceEventKey,
        title: event.title,
        sourceUrl: event.sourceUrl,
        liveAccessible: false,
        current,
        recovered: {
          description: false,
          descriptionQualification: 'NO_DESCRIPTION',
          lineupCount: 0,
          lineupQualification: 'NO_LINEUP',
          ticketAvailability: 'UNKNOWN',
          ticketAction: 'NONE',
        },
        promotable: {
          description: false,
          lineup: false,
          ticketTarget: false,
          ticketPrice: false,
          ticketStatus: false,
        },
        blockers: ['pipeline_error'],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ticketPlans = planTicketEvidencePersistence(ticketResults, plannerContext);
  const ticketPlanSummary = summarizeTicketPersistencePlan(ticketPlans);
  const planByKey = new Map(ticketPlans.map((plan) => [plan.sourceEventKey, plan]));

  const rowsWithPlan = rows.map((row) => {
    const plan = planByKey.get(row.sourceEventKey);
    const ticketMutation =
      Boolean(plan) &&
      (plan!.ticketOperation === 'insert' || plan!.ticketOperation === 'update');
    const providerUnavailable = plan?.ticketSourceState === 'provider_access_unavailable';
    const plannedTicket = plan?.plannedTicketRow;

    // Persisted ticket links may be useful even when availability is unknown.
    // The planner now stores those as availability_unverified and the consumer
    // renders a neutral "Ticketseite öffnen" action instead of claiming sales.
    const safeTicketMutation = ticketMutation;

    return {
      ...row,
      promotable: {
        ...row.promotable,
        ticketTarget:
          !row.current.ticketUrl &&
          safeTicketMutation &&
          Boolean(plannedTicket?.ticketUrl),
        ticketPrice:
          !row.current.ticketPrice &&
          safeTicketMutation &&
          plannedTicket?.priceFromMinor != null,
        ticketStatus:
          !row.current.ticketStatus &&
          safeTicketMutation &&
          Boolean(plannedTicket?.salesStatus) &&
          !['availability_unverified', 'provider_access_unavailable', 'unavailable_unknown'].includes(
            plannedTicket?.salesStatus ?? '',
          ),
      },
      ticketPersistencePlan: plan
        ? {
            ticketOperation: plan.ticketOperation,
            ticketOperationReason: plan.ticketOperationReason,
            ticketSourceState: plan.ticketSourceState,
            providerUnavailableNeutralLink:
              providerUnavailable &&
              ticketMutation &&
              Boolean(plannedTicket?.ticketUrl) &&
              plannedTicket?.salesStatus === 'availability_unverified',
            plannedTicketRow: plan.plannedTicketRow,
            providerSourceOperation: plan.providerSourceOperation,
            consumerProjection: plan.consumerProjection,
          }
        : undefined,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    scopeCount: manifest.count,
    liveAccessible: rowsWithPlan.filter((row) => row.liveAccessible).length,
    blockedOrUnavailable: rowsWithPlan.filter((row) => !row.liveAccessible).length,
    sourceErrors: rowsWithPlan.filter((row) => row.error).length,
    current: {
      withDescription: rowsWithPlan.filter((row) => row.current.description).length,
      withLineup: rowsWithPlan.filter((row) => row.current.lineupCount > 0).length,
      withTicketRow: rowsWithPlan.filter((row) => row.current.ticketRow).length,
      withTicketUrl: rowsWithPlan.filter((row) => row.current.ticketUrl).length,
      withTicketPrice: rowsWithPlan.filter((row) => row.current.ticketPrice).length,
      withTicketStatus: rowsWithPlan.filter((row) => row.current.ticketStatus).length,
    },
    recoverable: {
      descriptions: rowsWithPlan.filter((row) => row.promotable.description).length,
      lineups: rowsWithPlan.filter((row) => row.promotable.lineup).length,
      ticketTargets: rowsWithPlan.filter((row) => row.promotable.ticketTarget).length,
      ticketPrices: rowsWithPlan.filter((row) => row.promotable.ticketPrice).length,
      ticketStatuses: rowsWithPlan.filter((row) => row.promotable.ticketStatus).length,
    },
    afterPotentialRecovery: {
      withDescription: rowsWithPlan.filter(
        (row) => row.current.description || row.promotable.description,
      ).length,
      withLineup: rowsWithPlan.filter(
        (row) => row.current.lineupCount > 0 || row.promotable.lineup,
      ).length,
      withTicketUrl: rowsWithPlan.filter(
        (row) => row.current.ticketUrl || row.promotable.ticketTarget,
      ).length,
      withTicketPrice: rowsWithPlan.filter(
        (row) => row.current.ticketPrice || row.promotable.ticketPrice,
      ).length,
      withTicketStatus: rowsWithPlan.filter(
        (row) => row.current.ticketStatus || row.promotable.ticketStatus,
      ).length,
    },
    ticketPlanSummary: {
      inserts: ticketPlanSummary.currentTicketInsertsRequired,
      safeTicketMutations: rowsWithPlan.filter((row) =>
        row.promotable.ticketTarget ||
        row.promotable.ticketPrice ||
        row.promotable.ticketStatus
      ).length,
      providerUnavailableNeutralLinks: rowsWithPlan.filter(
        (row) => row.ticketPersistencePlan?.providerUnavailableNeutralLink,
      ).length,
      updates: ticketPlanSummary.currentTicketUpdatesRequired,
      deletes: ticketPlanSummary.currentTicketDeletesRequired,
      providerSourceReferences: ticketPlanSummary.providerSourceReferencesRequired,
      provenanceUpdates: ticketPlanSummary.provenanceUpdatesRequired,
      allIdempotent: ticketPlanSummary.allIdempotent,
    },
  };

  writeJson('summary.json', summary);
  writeJson('preview.json', rowsWithPlan);

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
