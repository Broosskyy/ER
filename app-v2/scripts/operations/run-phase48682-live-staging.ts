/**
 * @deprecated Retired — use run-bootshaus-source-pack-proof.ts / runSourcePackImport().
 * Phase 4.8.6.8.2 — bounded, read-only live staging validation.
 *
 * DB access is SELECT-only. The only writes are the two requested JSON artifacts.
 */
import './load-ops-env';

import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { resolveSourceConnectorKeyFromRecord } from '@/features/aggregation/connectors/source-connector-resolution';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import type { SourceRecord } from '@/data/types/records';
import type { EventRow } from '@/data/mappers/event-mapper';
import { importConfig } from '@/features/import/config/import-config';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import {
  deriveTicketStatusFromPhases,
  normalizeSourceTicketOffer,
  type CanonicalTicketPhase,
} from '@/features/import/domain/canonical-ticket-phase';
import { resolveOfficialOutboundRelationship } from '@/features/import/domain/official-page-ticket-corroboration';
import {
  analyzeEventTitleCore,
  compareEventTitleCores,
} from '@/features/import/matching/event-title-core';
import { normalizeMatchText, sameCalendarDay } from '@/features/import/matching/matching-utils';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { parseDetailEvidenceFromHtml } from '@/features/import/clean-import-core/detail-evidence-parser';
import type {
  CleanImportDecision,
  CleanSourceFamily,
  ConnectorOutput,
  EventEvidence,
} from '@/features/import/clean-import-core/event-evidence';
import {
  evaluateSourceNativeIdentityCompatibility,
  IdentityResolver,
  type SourceNativeIdentity,
} from '@/features/import/clean-import-core/identity-resolver';
import { ImportRunner } from '@/features/import/clean-import-core/import-runner';
import { resolveMissingLiveEvidenceDisposition } from '@/features/import/clean-import-core/review-decision';
import { SourceAdapter } from '@/features/import/clean-import-core/source-adapter';
import { extractNativeEventCheckoutUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';

const RUN_LIMIT_MS = 45 * 60_000;
const HTTP_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS_PER_URL = 2;
const FETCH_CONCURRENCY = 4;
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../docs/real-data');
const SUMMARY_PATH = join(OUTPUT_DIR, '_phase48682_live_staging_summary.json');
const EVENTS_PATH = join(OUTPUT_DIR, '_phase48682_live_staging_events.json');
const REFERENCES = [
  'LEVI',
  'BC173',
  'R3HAB',
  'Bootshaus Sommerfest',
  'Underland',
  'Sommerfest Elektroküche',
  'MDMA',
] as const;
const HISTORICAL_REFERENCES = ['LEVI', 'Sommerfest Elektroküche'] as const;
const ACTIVE_ACCEPTANCE_CASES = [
  { label: 'BC173 am 15.08.', title: 'BC173', date: '2026-08-15' },
  { label: 'M.D.M.A. am 15.08.', title: 'MDMA', date: '2026-08-15' },
  { label: 'R3HAB am 04.09.', title: 'R3HAB', date: '2026-09-04' },
  {
    label: 'Bootshaus Sommerfest am 05.09.',
    title: 'Bootshaus Sommerfest',
    date: '2026-09-05',
  },
  { label: 'Underland am 05.09.', title: 'Underland', date: '2026-09-05' },
  {
    label: 'Affenkäfig-Party im Bootshaus',
    title: 'Affenkäfig',
    venue: 'Bootshaus',
  },
  {
    label: 'Affenkäfig-Party am 19.09. in der Essigfabrik',
    title: 'Affenkäfig',
    date: '2026-09-19',
    venue: 'Essigfabrik',
  },
  { label: 'MDMA am 10.10.', title: 'MDMA', date: '2026-10-10' },
] as const;

type JsonRecord = Record<string, unknown>;
type SourceFamilyOrUnsupported = CleanSourceFamily | 'unsupported';
type StagingIdentityVerdict = 'exact' | 'corroborated' | 'partial' | 'mismatch' | 'unverifiable';

interface ReferenceRow {
  canonical_event_id: string;
  source_id: string;
  external_event_id?: string | null;
  original_url?: string | null;
  active?: boolean | null;
}

interface ImportMappingRow {
  source_id: string;
  external_id: string;
  resulting_event_id?: string | null;
  updated_at?: string | null;
}

type ExistingEventRow = Pick<
  EventRow,
  | 'id'
  | 'title'
  | 'description'
  | 'source_id'
  | 'start_date'
  | 'end_date'
  | 'venue_name'
  | 'website_url'
  | 'ticket_url'
  | 'price_text'
  | 'ticket_status'
  | 'status'
>;

interface Contribution {
  sourceId: string;
  sourceName: string;
  externalId: string;
  mappedEventId?: string;
  ignoredMappedEventId?: string;
  ownershipConfirmed: boolean;
  output: ConnectorOutput;
  raw: RawImportedEvent;
}

interface Cluster {
  id: string;
  mappedEventId?: string;
  contributions: Contribution[];
  duplicateCandidate: boolean;
  clusterReasons: string[];
}

interface SourceFetchResult {
  sourceId: string;
  sourceName: string;
  connectorKey?: string;
  family: SourceFamilyOrUnsupported;
  status: 'success' | 'failed' | 'deduplicated_endpoint';
  rawEventCount: number;
  contributionCount: number;
  error?: string;
  finishedAt?: string;
}

interface StagingEvent {
  existingEventId?: string;
  sourceIds: string[];
  identityVerdict: StagingIdentityVerdict;
  decision: CleanImportDecision | 'historical_preserve';
  stagingCategory: 'active_live' | 'historical_preserve';
  canonicalPreview?: {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    venueName?: string;
    organizerName?: string;
    genreLabels?: string[];
    lineup?: string[];
    minimumAge?: number;
    venueEnvironment?: string;
    websiteUrl?: string;
    ticketUrl?: string;
    priceText?: string;
    ticketStatus?: string;
    ticketPhases?: unknown[];
    ticketEvidence?: {
      ticketUrl?: string;
      priceText?: string;
      ticketStatus?: string;
      ticketPhases?: unknown[];
      admissionProducts?: unknown[];
      excludedProducts?: unknown[];
      verifiedAt?: string;
    };
  };
  evidenceOrigins: Record<string, string>;
  missingFields: string[];
  reviewReasons: string[];
  clusterId: string;
  coreDecision?: CleanImportDecision;
  sourceContributions: Array<{
    sourceId: string;
    externalId: string;
    sourceFamily: CleanSourceFamily;
    sourceUrl: string;
    requestedSourceUrl?: string;
    finalSourceUrl?: string;
    verifiedAt?: string;
    liveValues: {
      title?: string;
      startDate?: string;
      endDate?: string;
      venueName?: string;
      description?: string;
      genreLabels?: string[];
      lineup?: string[];
      minimumAge?: string;
      venueEnvironment?: string;
      websiteUrl?: string;
      ticketUrl?: string;
      priceText?: string;
      ticketStatus?: string;
      ticketPhases?: unknown[];
      admissionProducts?: unknown[];
      excludedAddOns?: string[];
      excludedProducts?: unknown[];
    };
  }>;
  existingComparison?: {
    title?: string;
    startDate?: string;
    venueName?: string;
    websiteUrl?: string;
    ticketUrl?: string;
  };
  historicalSnapshot?: {
    title: string;
    startDate: string;
    endDate: string;
    venueName?: string;
    websiteUrl?: string;
    ticketUrl?: string;
    priceText?: string;
    ticketStatus?: string;
    status: string;
  };
}

interface GetOnlyRestConfig {
  baseUrl: string;
  serverSecret: string;
}

interface GetOnlyRestResult<T> {
  data: T[];
  status: number;
}

function readOnlyOpsRestConfig(): GetOnlyRestConfig {
  const envPath =
    process.env.ER_OPS_ENV_FILE ??
    join(dirname(fileURLToPath(import.meta.url)), '../../.env');
  const values: Record<string, string> = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line || /^\s*#/.test(line)) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) continue;
      values[line.slice(0, separatorIndex).trim()] = line
        .slice(separatorIndex + 1)
        .trim();
    }
  }
  const baseUrl = values.EXPO_PUBLIC_SUPABASE_URL ?? values.SUPABASE_URL;
  const serverSecret = values.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serverSecret) {
    throw new Error('readonly_server_secret_supabase_configuration_missing');
  }
  if (
    serverSecret === values.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    !serverSecret.startsWith('sb_secret_')
  ) {
    throw new Error('readonly_ops_requires_opaque_server_secret');
  }
  return { baseUrl, serverSecret };
}

async function getOnlyRestRows<T>(
  config: GetOnlyRestConfig,
  table: string,
  query: Record<string, string>,
  method = 'GET',
): Promise<GetOnlyRestResult<T>> {
  if (method.toUpperCase() !== 'GET') {
    throw new Error(`readonly_rest_method_blocked:${method.toUpperCase()}`);
  }
  if (!/^[a-z][a-z0-9_]*$/i.test(table) || table.toLowerCase() === 'rpc') {
    throw new Error(`readonly_rest_resource_blocked:${table}`);
  }
  const url = new URL(`/rest/v1/${table}`, config.baseUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      apikey: config.serverSecret,
    },
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object'
        ? (payload as { code?: string; message?: string })
        : undefined;
    throw new Error(
      `readonly_rest_get_failed:${table}:${response.status}:${error?.code ?? 'unknown'}:${
        error?.message ?? 'unknown'
      }`,
    );
  }
  if (!Array.isArray(payload)) {
    throw new Error(`readonly_rest_invalid_response:${table}`);
  }
  return { data: payload as T[], status: response.status };
}

async function runSmokeTest(config: GetOnlyRestConfig): Promise<void> {
  const sources = await getOnlyRestRows<{ id: string }>(config, 'sources', {
    select: 'id',
    limit: '1',
  });
  const events = await getOnlyRestRows<{ id: string }>(config, 'events', {
    select: 'id',
    status: 'eq.published',
    limit: '1',
  });
  console.log(
    JSON.stringify(
      {
        credentialType: 'opaque_server_secret_apikey_header_only',
        getOnlyGuard: true,
        sources: { httpStatus: sources.status, rowCount: sources.data.length },
        publishedEvents: { httpStatus: events.status, rowCount: events.data.length },
      },
      null,
      2,
    ),
  );
}

function metadata(raw: RawImportedEvent): JsonRecord {
  return raw.sourceMetadata ?? {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sourceFamily(source: SourceRecord): SourceFamilyOrUnsupported {
  if (source.sourceType === 'website') return 'official_website';
  if (source.sourceType !== 'ticket_platform') return 'unsupported';
  const platform = (source.sourceConfig?.ticketPlatform as { platform?: string } | undefined)
    ?.platform;
  if (platform === 'ticket_io') return 'ticket_io';
  if (platform === 'ticket_king') return 'ticket_kings';
  return 'unsupported';
}

function normalizeEndpointUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().toLowerCase();
  } catch {
    return value.trim().replace(/\/+$/, '').toLowerCase();
  }
}

function sourceEndpoint(source: SourceRecord): string {
  const ticketConfig = source.sourceConfig?.ticketPlatform as
    | { platform?: string; shopSlug?: string; listUrl?: string }
    | undefined;
  const endpoint =
    ticketConfig?.listUrl ??
    (ticketConfig?.platform && ticketConfig.shopSlug
      ? `${ticketConfig.platform}:${ticketConfig.shopSlug}`
      : undefined) ??
    source.baseUrl ??
    source.website;
  return endpoint ? normalizeEndpointUrl(endpoint) : `source:${source.id}`;
}

function sourceOwnershipLabels(source: SourceRecord): string[] {
  const metadataOrganizer = stringValue(source.metadata?.organizerName);
  const allowedOrganizers = (
    source.sourceConfig?.ticketPlatform as
      | { scope?: { allowedOrganizers?: string[] } }
      | undefined
  )?.scope?.allowedOrganizers;
  const displayLabel = source.displayName
    .replace(/ticket\s*kings?/gi, '')
    .replace(/\borg\b/gi, '')
    .replace(/[—–:_-]+/g, ' ')
    .trim();
  return [
    source.organizerName,
    metadataOrganizer,
    ...(allowedOrganizers ?? []),
    displayLabel,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeMatchText)
    .filter((value, index, all) => value.length >= 4 && all.indexOf(value) === index);
}

function sourceOwnsRawEvent(source: SourceRecord, raw: RawImportedEvent): boolean {
  const labels = sourceOwnershipLabels(source);
  if (labels.length === 0) {
    return false;
  }
  const identityCorpus = normalizeMatchText(
    [raw.organizerName, raw.title, raw.venueName].filter(Boolean).join(' '),
  );
  return labels.some(
    (label) => identityCorpus.includes(label) || label.includes(identityCorpus),
  );
}

function resolveContributionOwner(
  endpointSources: SourceRecord[],
  raw: RawImportedEvent,
  requireOrganizerOwnership: boolean,
): SourceRecord | undefined {
  if (endpointSources.length === 1) {
    const onlySource = endpointSources[0]!;
    if (!requireOrganizerOwnership || sourceOwnershipLabels(onlySource).length === 0) {
      return onlySource;
    }
    return sourceOwnsRawEvent(onlySource, raw) ? onlySource : undefined;
  }
  const matches = endpointSources.filter((source) => sourceOwnsRawEvent(source, raw));
  return matches.length === 1 ? matches[0] : undefined;
}

function connectorIdentity(output: ConnectorOutput): SourceNativeIdentity {
  return {
    title: output.title,
    startDate: output.startDate,
    venueName: output.venueName,
    locationText: output.locationText,
  };
}

function withoutFixtureData(source: SourceRecord): SourceRecord {
  const sourceConfig = structuredClone(source.sourceConfig ?? {});
  const reference = sourceConfig.reference;
  if (reference) {
    sourceConfig.reference = {
      connectorKey: reference.connectorKey,
    };
  }
  sourceConfig.connectorFramework = {
    ...sourceConfig.connectorFramework,
    retry: {
      ...sourceConfig.connectorFramework?.retry,
      maxRetries: 0,
    },
    rateLimit: {
      ...sourceConfig.connectorFramework?.rateLimit,
      concurrentRequests: FETCH_CONCURRENCY,
    },
  };
  sourceConfig.website = {
    ...sourceConfig.website,
    limits: {
      ...sourceConfig.website?.limits,
      timeoutMs: HTTP_TIMEOUT_MS,
    },
  };
  return { ...source, sourceConfig };
}

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    return () => {
      this.active -= 1;
      this.waiters.shift()?.();
    };
  }
}

function installBoundedFetch(deadline: number) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const semaphore = new Semaphore(FETCH_CONCURRENCY);
  const sourceContext = new AsyncLocalStorage<string>();
  const attempts = new Map<string, number>();
  const capturedBodies = new Map<string, Promise<string | undefined>>();
  const redirectTargets = new Map<string, string>();

  const boundedFetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const sourceId = sourceContext.getStore() ?? 'unscoped';
    const key = `${sourceId}|${request.url}`;
    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    if (attempt > MAX_ATTEMPTS_PER_URL) {
      throw new Error(`phase48682_retry_limit_exceeded:${request.url}`);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error('phase48682_time_limit_reached');
    }

    const release = await semaphore.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, Math.min(HTTP_TIMEOUT_MS, remaining)),
    );
    const abortFromCaller = () => controller.abort();
    request.signal.addEventListener('abort', abortFromCaller, { once: true });
    try {
      const response = await originalFetch(request, { signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
          redirectTargets.set(key, new URL(location, request.url).toString());
        }
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (/html|json|text/i.test(contentType)) {
        const body = response
          .clone()
          .text()
          .then((value) => value)
          .catch(() => undefined);
        capturedBodies.set(key, body);
        if (response.url) capturedBodies.set(`${sourceId}|${response.url}`, body);
      }
      return response;
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', abortFromCaller);
      release();
    }
  };

  globalThis.fetch = boundedFetch;
  return {
    sourceContext,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    async captured(sourceId: string, url: string | undefined): Promise<string | undefined> {
      if (!url) return undefined;
      let currentUrl = url;
      const visited = new Set<string>();
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        const key = `${sourceId}|${currentUrl}`;
        if (visited.has(key)) return undefined;
        visited.add(key);
        const nextUrl = redirectTargets.get(key);
        if (!nextUrl) {
          return capturedBodies.get(key)?.catch(() => undefined);
        }
        currentUrl = nextUrl;
      }
      return undefined;
    },
    finalUrl(sourceId: string, url: string | undefined): string | undefined {
      if (!url) return undefined;
      let currentUrl = url;
      const visited = new Set<string>();
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        const key = `${sourceId}|${currentUrl}`;
        if (visited.has(key)) return undefined;
        visited.add(key);
        const nextUrl = redirectTargets.get(key);
        if (!nextUrl) return currentUrl;
        currentUrl = nextUrl;
      }
      return undefined;
    },
  };
}

function mapLineup(raw: RawImportedEvent) {
  const entries = metadata(raw).lineupEntries;
  const names = Array.isArray(entries)
    ? entries
        .map((entry) =>
          entry && typeof entry === 'object'
            ? stringValue((entry as JsonRecord).displayName)
            : undefined,
        )
        .filter((value): value is string => Boolean(value))
    : (raw.artistNames ?? []);
  return names.map((name, index) => ({
    sortOrder: index,
    displayName: name,
    rawSourceSpelling: name,
    normalizedName: normalizeMatchText(name),
    billingRelation: 'SOLO' as const,
    isB2b: false,
    isF2f: false,
    isLiveSet: false,
    confidence: 0.8,
    reviewState: 'accepted' as const,
    inclusionReason: 'productive_connector_output',
  }));
}

function mapTicketPhases(raw: RawImportedEvent): CanonicalTicketPhase[] | undefined {
  const offers = metadata(raw).ticketOffers;
  if (!Array.isArray(offers)) return undefined;
  const phases = offers
    .filter((entry): entry is JsonRecord => Boolean(entry && typeof entry === 'object'))
    .map((entry, index) => {
      const priceAmount = numberValue(entry.priceAmount);
      const purchaseUrl = stringValue(entry.purchaseUrl);
      const explicitSoldOut =
        typeof entry.soldOut === 'boolean' ? entry.soldOut : undefined;
      return normalizeSourceTicketOffer(
        {
          name: stringValue(entry.name) ?? 'Admission',
          priceAmount,
          priceCurrency: stringValue(entry.priceCurrency),
          availability: stringValue(entry.availability),
          soldOut:
            explicitSoldOut ??
            (purchaseUrl && priceAmount !== undefined && priceAmount > 0
              ? false
              : undefined),
          purchaseUrl,
          validFrom: stringValue(entry.validFrom),
          validUntil: stringValue(entry.validUntil),
        },
        index,
      );
    });
  return phases.length ? phases : undefined;
}

function baseConnectorOutput(
  source: SourceRecord,
  family: CleanSourceFamily,
  raw: RawImportedEvent,
  verifiedAt: string,
): ConnectorOutput {
  const meta = metadata(raw);
  const phases = mapTicketPhases(raw);
  const lineup = mapLineup(raw);
  const minimumAge =
    raw.minimumAge !== undefined ? String(raw.minimumAge) : stringValue(meta.minimumAge);
  const venueEnvironment = stringValue(meta.venueEnvironment);
  const publicTicketUrl =
    stringValue(meta.publicTicketPageUrl) ??
    stringValue(meta.publicCtaCandidateUrl) ??
    raw.ticketUrl ??
    raw.eventUrl;
  return {
    sourceId: source.id,
    sourceFamily: family,
    sourceUrl:
      raw.eventUrl ?? raw.originalLink ?? raw.sourceUrl ?? source.baseUrl ?? source.website ?? '',
    requestedSourceUrl:
      raw.eventUrl ?? raw.originalLink ?? raw.sourceUrl ?? source.baseUrl ?? source.website,
    finalSourceUrl:
      raw.eventUrl ?? raw.originalLink ?? raw.sourceUrl ?? source.baseUrl ?? source.website,
    verifiedAt: stringValue(meta.verifiedAt) ?? stringValue(meta.observedAt) ?? verifiedAt,
    title: raw.title,
    startDate: raw.startDate,
    endDate: raw.endDate,
    venueName: raw.venueName,
    locationText: raw.venueName ?? raw.venueAddress ?? raw.cityName,
    officialWebsiteUrl:
      family === 'official_website'
        ? (raw.eventUrl ?? raw.originalLink ?? raw.sourceUrl ?? source.baseUrl ?? source.website)
        : undefined,
    outboundTicketUrls: family === 'official_website' && raw.ticketUrl ? [raw.ticketUrl] : [],
    description: raw.description,
    genres: raw.genreNames,
    lineup: lineup.length ? lineup : undefined,
    lineupState: lineup.length ? 'explicit_artists' : undefined,
    minimumAge,
    venueEnvironment:
      venueEnvironment === 'indoor' ||
      venueEnvironment === 'outdoor' ||
      venueEnvironment === 'hybrid'
        ? venueEnvironment
        : undefined,
    publicTicketUrl: family === 'official_website' ? undefined : publicTicketUrl,
    checkoutEvidenceUrl:
      family === 'official_website' ? undefined : stringValue(meta.checkoutEvidenceUrl),
    admissionPrice:
      family !== 'official_website' && raw.priceAmount !== undefined
        ? {
            amount: raw.priceAmount,
            currency: raw.priceCurrency ?? 'EUR',
            text: raw.priceText,
          }
        : undefined,
    ticketPhases: family === 'official_website' ? undefined : phases,
    admissionProducts: family === 'official_website' ? undefined : phases,
    ticketStatus:
      family === 'official_website' || !phases ? undefined : deriveTicketStatusFromPhases(phases),
    diagnostics: [],
  };
}

function overlayDetail(base: ConnectorOutput, detail: ConnectorOutput): ConnectorOutput {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== undefined)),
    sourceId: base.sourceId,
    sourceFamily: base.sourceFamily,
    sourceUrl: detail.finalSourceUrl ?? base.sourceUrl,
    requestedSourceUrl: detail.requestedSourceUrl ?? base.requestedSourceUrl,
    finalSourceUrl: detail.finalSourceUrl ?? base.finalSourceUrl,
    verifiedAt: base.verifiedAt,
    officialWebsiteUrl:
      base.sourceFamily === 'official_website'
        ? (detail.officialWebsiteUrl ?? base.officialWebsiteUrl)
        : undefined,
    outboundTicketUrls: [
      ...(base.outboundTicketUrls ?? []),
      ...(detail.outboundTicketUrls ?? []),
    ].filter((url, index, all) => all.indexOf(url) === index),
    diagnostics: [...(base.diagnostics ?? []), ...(detail.diagnostics ?? [])],
  };
}

function identityCompatible(left: ConnectorOutput, right: ConnectorOutput): boolean {
  return evaluateSourceNativeIdentityCompatibility(
    connectorIdentity(left),
    connectorIdentity(right),
  ).compatible;
}

function officialTicketRelationship(left: ConnectorOutput, right: ConnectorOutput): boolean {
  const official = left.sourceFamily === 'official_website' ? left : right;
  const ticket = left.sourceFamily === 'official_website' ? right : left;
  if (official.sourceFamily !== 'official_website' || ticket.sourceFamily === 'official_website') {
    return false;
  }
  return (
    identityCompatible(official, ticket) &&
    resolveOfficialOutboundRelationship({
      publicTicketPageUrl: ticket.publicTicketUrl,
      outboundTicketUrls: official.outboundTicketUrls ?? [],
    }).confirmed
  );
}

function clusterContributions(contributions: Contribution[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const contribution of contributions) {
    let candidates: Cluster[] = [];
    if (contribution.mappedEventId) {
      const sameMapping = clusters.filter(
        (cluster) => cluster.mappedEventId === contribution.mappedEventId,
      );
      candidates = sameMapping.filter((cluster) =>
        cluster.contributions.some((entry) =>
          identityCompatible(entry.output, contribution.output),
        ),
      );
      if (sameMapping.length > 0 && candidates.length === 0) {
        for (const cluster of sameMapping) {
          cluster.duplicateCandidate = true;
          cluster.clusterReasons.push('stale_source_mapping_identity_conflict');
        }
        contribution.ignoredMappedEventId = contribution.mappedEventId;
        contribution.mappedEventId = undefined;
        contribution.output = {
          ...contribution.output,
          duplicateCandidate: true,
          diagnostics: [
            ...(contribution.output.diagnostics ?? []),
            'stale_source_mapping_identity_conflict',
          ],
        };
      }
    } else {
      candidates = clusters.filter((cluster) =>
        cluster.contributions.some(
          (entry) =>
            identityCompatible(entry.output, contribution.output) ||
            officialTicketRelationship(entry.output, contribution.output),
        ),
      );
    }
    if (candidates.length === 1) {
      candidates[0]!.contributions.push(contribution);
      continue;
    }
    const ambiguous = candidates.length > 1;
    if (ambiguous) {
      for (const candidate of candidates) {
        candidate.duplicateCandidate = true;
        candidate.clusterReasons.push(
          `ambiguous_cluster_candidate:${contribution.sourceId}:${contribution.externalId}`,
        );
      }
    }
    clusters.push({
      id: `staging-${String(clusters.length + 1).padStart(4, '0')}`,
      mappedEventId: contribution.mappedEventId,
      contributions: [contribution],
      duplicateCandidate: ambiguous,
      clusterReasons: ambiguous ? ['ambiguous_cluster_assignment'] : [],
    });
  }

  for (let leftIndex = 0; leftIndex < clusters.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < clusters.length; rightIndex += 1) {
      const left = clusters[leftIndex]!;
      const right = clusters[rightIndex]!;
      const a = left.contributions[0]?.output;
      const b = right.contributions[0]?.output;
      if (!a?.title || !b?.title || !a.startDate || !b.startDate) continue;
      const sameTitleAndDay =
        compareEventTitleCores(
          analyzeEventTitleCore(a.title, { venueName: a.venueName }),
          analyzeEventTitleCore(b.title, { venueName: b.venueName }),
        ).coresAgree && sameCalendarDay(a.startDate, b.startDate);
      if (sameTitleAndDay && !identityCompatible(a, b)) {
        left.duplicateCandidate = true;
        right.duplicateCandidate = true;
        left.clusterReasons.push(`identity_conflict_with:${right.id}`);
        right.clusterReasons.push(`identity_conflict_with:${left.id}`);
      }
    }
  }
  return clusters;
}

function originFor<T>(
  evidence: EventEvidence[],
  value: T | undefined,
  read: (entry: EventEvidence) => { value: T; sourceUrl: string } | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const serialized = JSON.stringify(value);
  return evidence.map(read).find((entry) => entry && JSON.stringify(entry.value) === serialized)
    ?.sourceUrl;
}

function evidenceOrigins(
  evidence: EventEvidence[],
  canonical: ReturnType<ImportRunner['run']>['canonicalEvent'],
): Record<string, string> {
  if (!canonical) return {};
  const origins: Record<string, string | undefined> = {
    title: originFor(evidence, canonical.title, (entry) => entry.identity.title),
    startDate: originFor(evidence, canonical.startDate, (entry) => entry.identity.startDate),
    endDate: originFor(evidence, canonical.endDate, (entry) => entry.identity.endDate),
    venueName: originFor(evidence, canonical.venueName, (entry) => entry.identity.venueName),
    websiteUrl: originFor(
      evidence,
      canonical.websiteUrl,
      (entry) => entry.identity.officialWebsiteUrl,
    ),
    description: originFor(evidence, canonical.description, (entry) => entry.content.description),
    genreLabels: originFor(evidence, canonical.genres, (entry) => entry.content.genres),
    lineup: originFor(evidence, canonical.lineup, (entry) => entry.content.lineup),
    minimumAge: originFor(evidence, canonical.minimumAge, (entry) => entry.content.minimumAge),
    venueEnvironment: originFor(
      evidence,
      canonical.venueEnvironment,
      (entry) => entry.content.venueEnvironment,
    ),
    ticketUrl: originFor(evidence, canonical.ticketUrl, (entry) => entry.tickets.publicTicketUrl),
    priceText: originFor(
      evidence,
      canonical.admissionPrice,
      (entry) => entry.tickets.admissionPrice,
    ),
    ticketStatus: originFor(
      evidence,
      canonical.ticketStatus,
      (entry) => entry.tickets.ticketStatus,
    ),
    ticketPhases: originFor(
      evidence,
      canonical.ticketPhases,
      (entry) => entry.tickets.ticketPhases,
    ),
  };
  return Object.fromEntries(
    Object.entries(origins).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function identityVerdict(
  coreVerdict: ReturnType<IdentityResolver['resolve']>['verdict'],
  evidence: EventEvidence[],
): StagingIdentityVerdict {
  if (coreVerdict === 'duplicate_candidate') return 'unverifiable';
  if (coreVerdict !== 'unverifiable') return coreVerdict;
  const hasPartial = evidence.some((entry) => {
    const fields = [
      entry.identity.title,
      entry.identity.startDate,
      entry.identity.venueName ?? entry.identity.locationText,
    ].filter(Boolean);
    return fields.length >= 2;
  });
  return hasPartial ? 'partial' : 'unverifiable';
}

function minimumAge(value: string | undefined): number | undefined {
  const match = value?.match(/\d{1,2}/);
  return match ? Number(match[0]) : undefined;
}

function normalizeMissing(fields: string[]): string[] {
  return fields.map((field) => {
    if (field === 'admissionPrice') return 'priceText';
    if (field === 'genres') return 'genreLabels';
    if (field === 'venueOrLocation') return 'venueName';
    return field;
  });
}

function classifyWrongUrlRole(event: StagingEvent): boolean {
  const website = event.canonicalPreview?.websiteUrl;
  const ticket = event.canonicalPreview?.ticketUrl;
  const websiteClass = website ? classifyTicketDestination(website).destinationClass : undefined;
  const ticketClass = ticket ? classifyTicketDestination(ticket).destinationClass : undefined;
  return (
    websiteClass === 'ticket_platform_event' ||
    websiteClass === 'ticket_platform_listing' ||
    websiteClass === 'embedded_checkout_evidence' ||
    ticketClass === 'official_event_page'
  );
}

function hasRedirectPlaceholderContent(event: StagingEvent): boolean {
  const values = [
    event.canonicalPreview?.title,
    event.canonicalPreview?.description,
    ...(event.canonicalPreview?.lineup ?? []),
    ...event.sourceContributions.flatMap((entry) => [
      entry.liveValues.title,
      entry.liveValues.description,
      ...(entry.liveValues.lineup ?? []),
    ]),
  ].filter((value): value is string => Boolean(value));
  return values.some((value) =>
    /^(?:301|302|303|307|308)\s+(?:moved permanently|found|temporary redirect|permanent redirect)$/i.test(
      value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    ),
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

type BoundedFetch = ReturnType<typeof installBoundedFetch>;

async function executeProbeSource(
  originalSource: SourceRecord,
  boundedFetch: BoundedFetch,
): Promise<{
  source: SourceRecord;
  family: CleanSourceFamily;
  events: RawImportedEvent[];
  verifiedAt: string;
}> {
  const family = sourceFamily(originalSource);
  if (family === 'unsupported') {
    throw new Error(`probe_unsupported_source:${originalSource.id}`);
  }
  const source = withoutFixtureData(originalSource);
  const connectorKey = resolveSourceConnectorKeyFromRecord(source);
  const aggregationSource = mapSourceRecordToAggregationSource(source);
  const importSource = mapSourceRecordToImportSource(source);
  const context: PipelineRunContext = {
    runId: `phase48684-probe-${source.id}-${Date.now()}`,
    source: aggregationSource,
    triggerType: 'manual',
    startedAt: new Date().toISOString(),
  };
  const execution = await boundedFetch.sourceContext.run(source.id, () =>
    sourceConnectorRegistry
      .getExecutor()
      .execute(
        sourceConnectorRegistry.get(connectorKey),
        aggregationSource,
        importSource,
        context,
      ),
  );
  return {
    source,
    family,
    events: execution.events,
    verifiedAt: new Date().toISOString(),
  };
}

function upcomingEvents(events: RawImportedEvent[]): RawImportedEvent[] {
  const now = Date.now();
  return events
    .filter((event) => {
      const eventTime = Date.parse(event.endDate ?? event.startDate ?? '');
      return Number.isFinite(eventTime) && eventTime > now;
    })
    .sort(
      (left, right) =>
        Date.parse(left.startDate ?? '') - Date.parse(right.startDate ?? ''),
    );
}

async function normalizeProbeOutput(
  probe: Awaited<ReturnType<typeof executeProbeSource>>,
  raw: RawImportedEvent,
  boundedFetch: BoundedFetch,
): Promise<ConnectorOutput> {
  const base = baseConnectorOutput(
    probe.source,
    probe.family,
    raw,
    probe.verifiedAt,
  );
  const detailUrl = raw.eventUrl ?? raw.originalLink ?? raw.sourceUrl;
  const detailHtml = await boundedFetch.captured(probe.source.id, detailUrl);
  const finalDetailUrl =
    boundedFetch.finalUrl(probe.source.id, detailUrl) ?? detailUrl;
  if (!detailHtml || !detailUrl) {
    return {
      ...base,
      diagnostics: [...(base.diagnostics ?? []), 'detail_html_unavailable'],
    };
  }
  let checkoutHtml: string | undefined;
  let checkoutDiagnostic: string | undefined;
  if (probe.family === 'ticket_kings') {
    const checkoutUrl = extractNativeEventCheckoutUrl(detailHtml);
    checkoutHtml = await boundedFetch.captured(probe.source.id, checkoutUrl);
    if (!checkoutHtml && checkoutUrl) {
      try {
        checkoutHtml = (
          await importFetchService.fetch({
            url: checkoutUrl,
            timeoutMs: HTTP_TIMEOUT_MS,
            allowedContentTypes: ['text/html', 'text/plain'],
          })
        ).body;
      } catch {
        checkoutDiagnostic = 'checkout_fetch_unavailable';
      }
    }
  }
  const parsed = parseDetailEvidenceFromHtml({
    sourceId: probe.source.id,
    sourceFamily: probe.family,
    sourceUrl: finalDetailUrl ?? detailUrl,
    verifiedAt: base.verifiedAt,
    html: detailHtml,
    checkoutHtml,
    identity: {
      title: base.title,
      startDate: base.startDate,
      endDate: base.endDate,
      venueName: base.venueName,
      locationText: base.locationText,
    },
    listCard:
      probe.family !== 'official_website' && base.title
        ? {
            title: base.title,
            eventDate: base.startDate,
            venueName: base.venueName,
            priceText: raw.priceText,
            publicTicketUrl: base.publicTicketUrl,
            soldOut:
              typeof metadata(raw).soldOut === 'boolean'
                ? metadata(raw).soldOut === true
                : undefined,
          }
        : undefined,
  });
  return overlayDetail(base, {
    ...parsed,
    requestedSourceUrl: detailUrl,
    finalSourceUrl: finalDetailUrl,
    diagnostics: [
      ...(parsed.diagnostics ?? []),
      ...(checkoutDiagnostic ? [checkoutDiagnostic] : []),
    ],
  });
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function presentFieldTypes(record: JsonRecord, fields: string[]) {
  return fields
    .filter((field) => record[field] !== undefined)
    .map((field) => ({ field, type: valueType(record[field]) }));
}

async function runEvidenceProbes(config: GetOnlyRestConfig): Promise<void> {
  const sourceRows = await getOnlyRestRows<SourceRow>(config, 'sources', {
    select: '*',
    enabled: 'eq.true',
    archived: 'eq.false',
    limit: '5000',
  });
  const sources = sourceRows.data
    .map(mapSourceRowToRecord)
    .filter((source) => source.enabled && !source.archived);
  const boundedFetch = installBoundedFetch(Date.now() + 15 * 60_000);
  const sourceRuns = new Map<
    string,
    Awaited<ReturnType<typeof executeProbeSource>>
  >();
  const execute = async (source: SourceRecord) => {
    const existing = sourceRuns.get(source.id);
    if (existing) return existing;
    const run = await executeProbeSource(source, boundedFetch);
    sourceRuns.set(source.id, run);
    return run;
  };

  try {
    let officialSelection:
      | {
          run: Awaited<ReturnType<typeof executeProbeSource>>;
          raw: RawImportedEvent;
        }
      | undefined;
    for (const source of sources.filter(
      (candidate) => sourceFamily(candidate) === 'official_website',
    )) {
      const run = await execute(source);
      const raw = upcomingEvents(run.events).find((event) => {
        const requested =
          event.eventUrl ?? event.originalLink ?? event.sourceUrl;
        const finalUrl = boundedFetch.finalUrl(source.id, requested);
        return Boolean(requested && finalUrl && finalUrl !== requested);
      });
      if (raw) {
        officialSelection = { run, raw };
        break;
      }
    }
    if (!officialSelection) {
      throw new Error('probe_failed:official_website:no_redirected_upcoming_detail');
    }

    const selectTicketProbe = async (family: CleanSourceFamily) => {
      for (const source of sources.filter(
        (candidate) => sourceFamily(candidate) === family,
      )) {
        const run = await execute(source);
        const raw = upcomingEvents(run.events)[0];
        if (raw) return { run, raw };
      }
      throw new Error(`probe_failed:${family}:no_upcoming_connector_output`);
    };

    const ticketIoSelection = await selectTicketProbe('ticket_io');
    const ticketKingsSelection = await selectTicketProbe('ticket_kings');
    const selections = [
      { label: 'official_redirect', ...officialSelection },
      { label: 'ticket_io', ...ticketIoSelection },
      { label: 'ticket_kings', ...ticketKingsSelection },
    ] as const;
    const results = [];
    for (const selection of selections) {
      const output = await normalizeProbeOutput(
        selection.run,
        selection.raw,
        boundedFetch,
      );
      const evidence = new SourceAdapter().adapt(output);
      const rawMetadata = metadata(selection.raw);
      const admissionProducts =
        evidence.tickets.admissionProducts?.value ?? [];
      const nativeOffers = Array.isArray(rawMetadata.ticketOffers)
        ? rawMetadata.ticketOffers
        : [];
      const hasUnverifiedZero =
        evidence.tickets.admissionPrice?.value.amount === 0 &&
        !admissionProducts.some((phase) => phase.isFree === true);
      const reason =
        selection.run.family === 'official_website'
          ? undefined
          : admissionProducts.length > 0
            ? undefined
            : 'no_visible_admission_price';
      const redirectContent = [
        evidence.identity.title?.value,
        evidence.content.description?.value,
        ...(evidence.content.lineup?.value.map((entry) => entry.displayName) ??
          []),
      ].some((value) => value === '301 Moved Permanently');
      const nativeOffersDiscarded =
        nativeOffers.length > 0 && admissionProducts.length === 0;
      const passed =
        selection.run.family === 'official_website'
          ? Boolean(
              evidence.finalSourceUrl &&
                evidence.finalSourceUrl !== evidence.requestedSourceUrl &&
                !redirectContent,
            )
          : !hasUnverifiedZero &&
            !nativeOffersDiscarded &&
            (admissionProducts.length > 0 || Boolean(reason));
      results.push({
        probe: selection.label,
        sourceFamily: selection.run.family,
        passed,
        reason,
        requestedUrlPresent: Boolean(evidence.requestedSourceUrl),
        finalUrlPresent: Boolean(evidence.finalSourceUrl),
        redirectContentRejected: !redirectContent,
        rawConnectorFields: presentFieldTypes(selection.raw as unknown as JsonRecord, [
          'priceText',
          'priceAmount',
          'ticketUrl',
          'sourceMetadata',
        ]),
        metadataFields: presentFieldTypes(rawMetadata, [
          'ticketOffers',
          'availability',
          'soldOut',
          'verifiedAt',
          'checkoutEvidenceUrl',
        ]),
        eventEvidenceFields: presentFieldTypes(
          {
            ticketUrl: evidence.tickets.publicTicketUrl?.value,
            priceText: evidence.tickets.admissionPrice?.value.text,
            ticketStatus: evidence.tickets.ticketStatus?.value,
            ticketPhases: evidence.tickets.ticketPhases?.value,
            admissionProducts: evidence.tickets.admissionProducts?.value,
            excludedProducts: evidence.tickets.excludedProducts?.value,
            verifiedAt: evidence.verifiedAt,
          },
          [
            'ticketUrl',
            'priceText',
            'ticketStatus',
            'ticketPhases',
            'admissionProducts',
            'excludedProducts',
            'verifiedAt',
          ],
        ),
      });
      if (!passed) {
        throw new Error(
          `probe_failed:${selection.label}:${
            nativeOffersDiscarded
              ? 'native_offers_discarded'
              : hasUnverifiedZero
                ? 'unverified_zero_price'
                : redirectContent
                  ? 'redirect_placeholder_content'
                  : reason ?? 'evidence_incomplete'
          }`,
        );
      }
    }
    console.log(JSON.stringify({ probes: results }, null, 2));
  } finally {
    boundedFetch.restore();
  }
}

async function main(): Promise<void> {
  const startedAtMs = Date.now();
  const deadline = startedAtMs + RUN_LIMIT_MS;
  const previousSummary = existsSync(SUMMARY_PATH)
    ? (JSON.parse(readFileSync(SUMMARY_PATH, 'utf8')) as JsonRecord)
    : undefined;
  const previousStagingEvents = existsSync(EVENTS_PATH)
    ? (JSON.parse(readFileSync(EVENTS_PATH, 'utf8')) as StagingEvent[])
    : [];
  importConfig.timeoutMs = HTTP_TIMEOUT_MS;
  importConfig.retryCount = 1;
  const restConfig = readOnlyOpsRestConfig();

  const [sourcesResult, referencesResult, importsResult, eventsResult] = await Promise.all([
    getOnlyRestRows<SourceRow>(restConfig, 'sources', {
      select: '*',
      enabled: 'eq.true',
      archived: 'eq.false',
      limit: '5000',
    }),
    getOnlyRestRows<ReferenceRow>(restConfig, 'event_source_references', {
      select: 'canonical_event_id,source_id,external_event_id,original_url,active',
      active: 'eq.true',
      limit: '10000',
    }),
    getOnlyRestRows<ImportMappingRow>(restConfig, 'import_records', {
      select: 'source_id,external_id,resulting_event_id,updated_at',
      resulting_event_id: 'not.is.null',
      order: 'updated_at.desc',
      limit: '10000',
    }),
    getOnlyRestRows<ExistingEventRow>(restConfig, 'events', {
      select:
        'id,title,description,source_id,start_date,end_date,venue_name,website_url,ticket_url,price_text,ticket_status,status',
      limit: '10000',
    }),
  ]);

  const sources = sourcesResult.data
    .map(mapSourceRowToRecord)
    .filter((source) => source.enabled && !source.archived);
  const references = referencesResult.data;
  const importMappings = importsResult.data;
  const existingEvents = eventsResult.data;
  const mappedByExternal = new Map<string, string>();
  const mappedByUrl = new Map<string, string>();
  for (const row of references) {
    if (row.external_event_id) {
      mappedByExternal.set(`${row.source_id}|${row.external_event_id}`, row.canonical_event_id);
    }
    if (row.original_url)
      mappedByUrl.set(`${row.source_id}|${row.original_url}`, row.canonical_event_id);
  }
  for (const row of importMappings) {
    const key = `${row.source_id}|${row.external_id}`;
    if (row.resulting_event_id && !mappedByExternal.has(key)) {
      mappedByExternal.set(key, row.resulting_event_id);
    }
  }
  const endpointSources = new Map<string, SourceRecord[]>();
  for (const source of sources) {
    const key = sourceEndpoint(source);
    endpointSources.set(key, [...(endpointSources.get(key) ?? []), source]);
  }

  const boundedFetch = installBoundedFetch(deadline);
  const fetchResults: SourceFetchResult[] = [];
  const contributions: Contribution[] = [];
  const ingestedEndpointEvents = new Set<string>();
  try {
    await mapWithConcurrency(sources, FETCH_CONCURRENCY, async (originalSource) => {
      const family = sourceFamily(originalSource);
      const source = withoutFixtureData(originalSource);
      let connectorKey: ReturnType<typeof resolveSourceConnectorKeyFromRecord> | undefined;
      try {
        if (Date.now() >= deadline) throw new Error('phase48682_time_limit_reached');
        if (family === 'unsupported') {
          throw new Error('unsupported_clean_source_family_or_fixture_only');
        }
        connectorKey = resolveSourceConnectorKeyFromRecord(source);
        const aggregationSource = mapSourceRecordToAggregationSource(source);
        const importSource = mapSourceRecordToImportSource(source);
        const connector = sourceConnectorRegistry.get(connectorKey);
        const context: PipelineRunContext = {
          runId: `phase48682-${source.id}-${Date.now()}`,
          source: aggregationSource,
          triggerType: 'manual',
          startedAt: new Date().toISOString(),
        };
        const execution = await boundedFetch.sourceContext.run(source.id, () =>
          sourceConnectorRegistry
            .getExecutor()
            .execute(connector, aggregationSource, importSource, context),
        );
        const finishedAt = new Date().toISOString();
        let contributionCount = 0;
        const endpoint = sourceEndpoint(source);
        const owners = endpointSources.get(endpoint) ?? [source];
        const detailUrlCounts = new Map<string, number>();
        for (const event of execution.events) {
          const url = event.eventUrl ?? event.originalLink ?? event.sourceUrl;
          if (url) detailUrlCounts.set(url, (detailUrlCounts.get(url) ?? 0) + 1);
        }
        for (const raw of execution.events) {
          const owner = resolveContributionOwner(
            owners,
            raw,
            family === 'ticket_kings',
          );
          const ownershipConfirmed = Boolean(owner);
          const effectiveSource = owner ?? source;
          const endpointEventKey = `${endpoint}|${raw.externalId}`;
          if (ingestedEndpointEvents.has(endpointEventKey)) {
            continue;
          }
          ingestedEndpointEvents.add(endpointEventKey);
          let base = baseConnectorOutput(effectiveSource, family, raw, finishedAt);
          if (!ownershipConfirmed) {
            base = {
              ...base,
              duplicateCandidate: true,
              diagnostics: [
                ...(base.diagnostics ?? []),
                'source_ownership_unconfirmed',
              ],
            };
          }
          const detailUrl = raw.eventUrl ?? raw.originalLink ?? raw.sourceUrl;
          const detailHtml = await boundedFetch.captured(source.id, detailUrl);
          const finalDetailUrl = boundedFetch.finalUrl(source.id, detailUrl) ?? detailUrl;
          let output = base;
          const canUseOfficialDetail =
            family === 'official_website' &&
            detailUrl &&
            detailUrlCounts.get(detailUrl) === 1 &&
            normalizeEndpointUrl(detailUrl) !== normalizeEndpointUrl(endpoint);
          if (
            detailHtml &&
            detailUrl &&
            (family !== 'official_website' || canUseOfficialDetail)
          ) {
            let checkoutHtml: string | undefined;
            let checkoutDiagnostic: string | undefined;
            if (family === 'ticket_kings') {
              const checkoutUrl = extractNativeEventCheckoutUrl(detailHtml);
              checkoutHtml = await boundedFetch.captured(source.id, checkoutUrl);
              if (!checkoutHtml && checkoutUrl) {
                try {
                  checkoutHtml = (
                    await importFetchService.fetch({
                      url: checkoutUrl,
                      timeoutMs: HTTP_TIMEOUT_MS,
                      allowedContentTypes: ['text/html', 'text/plain'],
                    })
                  ).body;
                } catch {
                  checkoutDiagnostic = 'checkout_fetch_unavailable';
                }
              }
            }
            const parsedEvidence = parseDetailEvidenceFromHtml({
              sourceId: source.id,
              sourceFamily: family,
              sourceUrl: finalDetailUrl ?? detailUrl,
              verifiedAt: base.verifiedAt,
              html: detailHtml,
              checkoutHtml,
              identity: {
                title: base.title,
                startDate: base.startDate,
                endDate: base.endDate,
                venueName: base.venueName,
                locationText: base.locationText,
              },
              listCard: base.title
                ? {
                    title: base.title,
                    eventDate: base.startDate,
                    venueName: base.venueName,
                    priceText: raw.priceText,
                    publicTicketUrl: base.publicTicketUrl,
                    soldOut: metadata(raw).soldOut === true,
                  }
                : undefined,
            });
            const parsed = {
              ...parsedEvidence,
              requestedSourceUrl: detailUrl,
              finalSourceUrl: finalDetailUrl,
              diagnostics: [
                ...(parsedEvidence.diagnostics ?? []),
                ...(checkoutDiagnostic ? [checkoutDiagnostic] : []),
              ],
            };
            output = overlayDetail(base, parsed);
          }
          const mappedEventId =
            mappedByExternal.get(`${effectiveSource.id}|${raw.externalId}`) ??
            mappedByUrl.get(`${effectiveSource.id}|${detailUrl ?? ''}`);
          contributions.push({
            sourceId: effectiveSource.id,
            sourceName: effectiveSource.displayName,
            externalId: raw.externalId,
            mappedEventId,
            ownershipConfirmed,
            output,
            raw,
          });
          contributionCount += 1;
        }
        fetchResults.push({
          sourceId: source.id,
          sourceName: source.displayName,
          connectorKey,
          family,
          status: 'success',
          rawEventCount: execution.events.length,
          contributionCount,
          finishedAt,
        });
      } catch (error) {
        fetchResults.push({
          sourceId: source.id,
          sourceName: source.displayName,
          connectorKey,
          family,
          status: 'failed',
          rawEventCount: 0,
          contributionCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  } finally {
    boundedFetch.restore();
  }

  const existingById = new Map(existingEvents.map((event) => [event.id, event]));
  for (const contribution of contributions) {
    if (!contribution.mappedEventId) continue;
    const existing = existingById.get(contribution.mappedEventId);
    const compatibility = existing
      ? evaluateSourceNativeIdentityCompatibility(connectorIdentity(contribution.output), {
          title: existing.title,
          startDate: existing.start_date,
          venueName: existing.venue_name ?? undefined,
        })
      : { compatible: false, reasons: ['mapped_event_not_found'] };
    if (compatibility.compatible) continue;
    contribution.ignoredMappedEventId = contribution.mappedEventId;
    contribution.mappedEventId = undefined;
    contribution.output = {
      ...contribution.output,
      duplicateCandidate: true,
      diagnostics: [
        ...(contribution.output.diagnostics ?? []),
        'stale_source_mapping_identity_conflict',
        ...compatibility.reasons.map((reason) => `stale_mapping:${reason}`),
      ],
    };
  }

  const clusters = clusterContributions(contributions);
  for (const cluster of clusters) {
    if (cluster.mappedEventId) continue;
    const first = cluster.contributions[0]?.output;
    if (!first?.title || !first.startDate) continue;
    const matches = existingEvents.filter((event) =>
      identityCompatible(first, {
        sourceId: 'db-catalog',
        sourceFamily: 'official_website',
        sourceUrl: event.website_url ?? '',
        verifiedAt: undefined,
        title: event.title,
        startDate: event.start_date,
        venueName: event.venue_name ?? undefined,
        officialWebsiteUrl: event.website_url ?? undefined,
      }),
    );
    if (matches.length === 1) cluster.mappedEventId = matches[0]!.id;
    if (matches.length > 1) {
      cluster.duplicateCandidate = true;
      cluster.clusterReasons.push(`multiple_existing_event_candidates:${matches.length}`);
    }
  }

  const importRunner = new ImportRunner();
  const identityResolver = new IdentityResolver();
  const stagingEvents: StagingEvent[] = clusters.map((cluster) => {
    const outputs = cluster.contributions.map((entry) => ({
      ...entry.output,
      duplicateCandidate: entry.output.duplicateCandidate || cluster.duplicateCandidate,
    }));
    const result = importRunner.run(outputs);
    const resolution = identityResolver.resolve(result.evidence);
    const canonical = result.canonicalEvent;
    const acceptedTicketEvidence = resolution.acceptedEvidence.find(
      (entry) => entry.sourceFamily !== 'official_website',
    );
    const hasVerifiedPartialIdentity = result.evidence.some(
      (entry) => entry.verifiedAt && entry.identity.title && entry.identity.startDate,
    );
    const decision: CleanImportDecision =
      result.decision === 'reject' && hasVerifiedPartialIdentity ? 'review' : result.decision;
    const existing = cluster.mappedEventId ? existingById.get(cluster.mappedEventId) : undefined;
    const stagingCategory =
      resolveMissingLiveEvidenceDisposition({
        existingEventId: existing?.id,
        endDate: existing?.end_date ?? canonical?.endDate,
        hasLiveEvidence: false,
        now: new Date(startedAtMs),
      }) === 'historical_preserve'
        ? 'historical_preserve'
        : 'active_live';
    const diagnostics = outputs.flatMap((output) => output.diagnostics ?? []);
    return {
      existingEventId: cluster.mappedEventId,
      sourceIds: [...new Set(cluster.contributions.map((entry) => entry.sourceId))],
      identityVerdict: identityVerdict(resolution.verdict, result.evidence),
      decision: stagingCategory === 'historical_preserve' ? 'historical_preserve' : decision,
      stagingCategory,
      canonicalPreview: canonical
        ? {
            title: canonical.title,
            description: canonical.description,
            startDate: canonical.startDate,
            endDate: canonical.endDate,
            venueName: canonical.venueName ?? canonical.locationText,
            genreLabels: canonical.genres,
            lineup: canonical.lineup?.map((entry) => entry.displayName),
            minimumAge: minimumAge(canonical.minimumAge),
            venueEnvironment: canonical.venueEnvironment,
            websiteUrl: canonical.websiteUrl,
            ticketUrl: canonical.ticketUrl,
            priceText:
              canonical.admissionPrice?.text ??
              (canonical.admissionPrice
                ? `${canonical.admissionPrice.amount.toFixed(2)} ${canonical.admissionPrice.currency}`
                : undefined),
            ticketStatus: canonical.ticketStatus,
            ticketPhases: canonical.ticketPhases,
            ticketEvidence: {
              ticketUrl: canonical.ticketUrl,
              priceText:
                canonical.admissionPrice?.text ??
                (canonical.admissionPrice
                  ? `${canonical.admissionPrice.amount.toFixed(2)} ${canonical.admissionPrice.currency}`
                  : undefined),
              ticketStatus: canonical.ticketStatus,
              ticketPhases: canonical.ticketPhases,
              admissionProducts:
                acceptedTicketEvidence?.tickets.admissionProducts?.value,
              excludedProducts:
                acceptedTicketEvidence?.tickets.excludedProducts?.value,
              verifiedAt: acceptedTicketEvidence?.verifiedAt,
            },
          }
        : undefined,
      evidenceOrigins: evidenceOrigins(result.evidence, canonical),
      missingFields: normalizeMissing([
        ...result.missingRequiredFields,
        ...result.missingOptionalFields,
      ]),
      reviewReasons: [
        ...result.reviewReasons,
        ...cluster.clusterReasons,
        ...(result.decision !== decision
          ? ['staging_policy:verified_partial_identity_requires_review']
          : []),
        ...diagnostics.filter((entry) =>
          /conflict|mismatch|missing|blocked|unavailable|excluded_add_on/i.test(entry),
        ),
      ].filter((value, index, all) => all.indexOf(value) === index),
      clusterId: cluster.id,
      coreDecision: result.decision,
      sourceContributions: result.evidence.map((entry, index) => ({
        sourceId: entry.sourceId,
        externalId: cluster.contributions[index]?.externalId ?? 'unknown',
        sourceFamily: entry.sourceFamily,
        sourceUrl: entry.sourceUrl,
        requestedSourceUrl: entry.requestedSourceUrl,
        finalSourceUrl: entry.finalSourceUrl,
        verifiedAt: entry.verifiedAt,
        liveValues: {
          title: entry.identity.title?.value,
          startDate: entry.identity.startDate?.value,
          endDate: entry.identity.endDate?.value,
          venueName: entry.identity.venueName?.value ?? entry.identity.locationText?.value,
          description: entry.content.description?.value,
          genreLabels: entry.content.genres?.value,
          lineup: entry.content.lineup?.value.map((lineupEntry) => lineupEntry.displayName),
          minimumAge: entry.content.minimumAge?.value,
          venueEnvironment: entry.content.venueEnvironment?.value,
          websiteUrl: entry.identity.officialWebsiteUrl?.value,
          ticketUrl: entry.tickets.publicTicketUrl?.value,
          priceText:
            entry.tickets.admissionPrice?.value.text ??
            (entry.tickets.admissionPrice
              ? `${entry.tickets.admissionPrice.value.amount.toFixed(2)} ${entry.tickets.admissionPrice.value.currency}`
              : undefined),
          ticketStatus: entry.tickets.ticketStatus?.value,
          ticketPhases: entry.tickets.ticketPhases?.value,
          admissionProducts: entry.tickets.admissionProducts?.value,
          excludedAddOns: entry.diagnostics
            .filter((diagnostic) => diagnostic.startsWith('excluded_add_on:'))
            .map((diagnostic) => diagnostic.slice('excluded_add_on:'.length)),
          excludedProducts: entry.tickets.excludedProducts?.value,
        },
      })),
      existingComparison: existing
        ? {
            title: existing.title,
            startDate: existing.start_date,
            venueName: existing.venue_name ?? undefined,
            websiteUrl: existing.website_url ?? undefined,
            ticketUrl: existing.ticket_url ?? undefined,
          }
        : undefined,
    };
  });
  const representedExistingIds = new Set(
    stagingEvents
      .map((event) => event.existingEventId)
      .filter((eventId): eventId is string => Boolean(eventId)),
  );
  for (const existing of existingEvents) {
    const disposition = resolveMissingLiveEvidenceDisposition({
      existingEventId: existing.id,
      endDate: existing.end_date ?? undefined,
      hasLiveEvidence: false,
      now: new Date(startedAtMs),
    });
    if (
      disposition !== 'historical_preserve' ||
      representedExistingIds.has(existing.id) ||
      !existing.end_date
    ) {
      continue;
    }
    stagingEvents.push({
      existingEventId: existing.id,
      sourceIds: existing.source_id ? [existing.source_id] : [],
      identityVerdict: 'unverifiable',
      decision: 'historical_preserve',
      stagingCategory: 'historical_preserve',
      evidenceOrigins: {},
      missingFields: [],
      reviewReasons: ['historical_event_absent_from_current_live_lists_preserved'],
      clusterId: `historical-${existing.id}`,
      sourceContributions: [],
      existingComparison: {
        title: existing.title,
        startDate: existing.start_date,
        venueName: existing.venue_name ?? undefined,
        websiteUrl: existing.website_url ?? undefined,
        ticketUrl: existing.ticket_url ?? undefined,
      },
      historicalSnapshot: {
        title: existing.title,
        startDate: existing.start_date,
        endDate: existing.end_date,
        venueName: existing.venue_name ?? undefined,
        websiteUrl: existing.website_url ?? undefined,
        ticketUrl: existing.ticket_url ?? undefined,
        priceText: existing.price_text ?? undefined,
        ticketStatus: existing.ticket_status ?? undefined,
        status: existing.status,
      },
    });
  }

  const activeStagingEvents = stagingEvents.filter(
    (event) => event.stagingCategory === 'active_live',
  );
  const historicalStagingEvents = stagingEvents.filter(
    (event) => event.stagingCategory === 'historical_preserve',
  );
  const decisionCounts = Object.fromEntries(
    (['publish', 'publish_partial', 'review', 'duplicate_candidate', 'reject'] as const).map(
      (decision) => [
        decision,
        activeStagingEvents.filter((event) => event.decision === decision).length,
      ],
    ),
  );
  const coveragePredicates: Record<string, (event: StagingEvent) => boolean> = {
    identity: (event) =>
      event.identityVerdict === 'exact' || event.identityVerdict === 'corroborated',
    date: (event) => Boolean(event.canonicalPreview?.startDate),
    venue: (event) => Boolean(event.canonicalPreview?.venueName),
    description: (event) => Boolean(event.canonicalPreview?.description),
    genres: (event) => Boolean(event.canonicalPreview?.genreLabels?.length),
    lineup: (event) => Boolean(event.canonicalPreview?.lineup?.length),
    tickets: (event) => Boolean(event.canonicalPreview?.ticketUrl),
    verifiedAt: (event) => event.sourceContributions.some((entry) => Boolean(entry.verifiedAt)),
  };
  const coverage = Object.fromEntries(
    Object.entries(coveragePredicates).map(([field, predicate]) => {
      const covered = activeStagingEvents.filter(predicate).length;
      return [
        field,
        {
          covered,
          total: activeStagingEvents.length,
          percent: activeStagingEvents.length
            ? Number(((covered / activeStagingEvents.length) * 100).toFixed(1))
            : 0,
        },
      ];
    }),
  );
  const referenceMatrix = REFERENCES.filter(
    (reference) => reference !== 'LEVI' && reference !== 'Sommerfest Elektroküche',
  ).map((reference) => {
    const needle = normalizeMatchText(reference);
    const matches = stagingEvents.filter((event) => {
      const titles = [
        event.canonicalPreview?.title,
        ...event.sourceContributions.map((entry) => {
          const contribution = contributions.find(
            (candidate) =>
              candidate.sourceId === entry.sourceId && candidate.externalId === entry.externalId,
          );
          return contribution?.output.title;
        }),
      ].filter((value): value is string => Boolean(value));
      return titles.some((title) => normalizeMatchText(title).includes(needle));
    });
    return {
      reference,
      foundSources: [...new Set(matches.flatMap((event) => event.sourceIds))],
      currentLiveValues: matches.map((event) => ({
        clusterId: event.clusterId,
        canonicalPreview: event.canonicalPreview,
        sourceContributions: event.sourceContributions,
      })),
      canonicalPreview: matches.length === 1 ? matches[0]?.canonicalPreview : undefined,
      decision:
        matches.length === 0
          ? 'review'
          : matches.length > 1
            ? 'duplicate_candidate'
            : matches[0]?.decision,
      missingOrConflictingEvidence:
        matches.length === 0
          ? ['live_reference_not_found']
          : matches
              .flatMap((event) => [...event.missingFields, ...event.reviewReasons])
              .filter((value, index, all) => all.indexOf(value) === index),
    };
  });
  const acceptanceMatrix = ACTIVE_ACCEPTANCE_CASES.map((acceptance) => {
    const titleNeedle = normalizeMatchText(acceptance.title).replace(/\s+/g, '');
    const matches = activeStagingEvents.filter((event) => {
      const values = [
        event.canonicalPreview,
        ...event.sourceContributions.map((entry) => entry.liveValues),
      ].filter((value): value is NonNullable<typeof value> => Boolean(value));
      return values.some((value) => {
        const titleMatches = value.title
          ? normalizeMatchText(value.title).replace(/\s+/g, '').includes(titleNeedle)
          : false;
        const dateMatches =
          !('date' in acceptance) ||
          !acceptance.date ||
          value.startDate?.slice(0, 10) === acceptance.date;
        const venueMatches =
          !('venue' in acceptance) ||
          !acceptance.venue ||
          (value.venueName
            ? normalizeMatchText(value.venueName).includes(
                normalizeMatchText(acceptance.venue),
              )
            : false);
        return titleMatches && dateMatches && venueMatches;
      });
    });
    const event = matches.length === 1 ? matches[0] : undefined;
    const fallbackLive = event?.sourceContributions
      .map((entry) => entry.liveValues)
      .find((value) => value.title || value.startDate || value.venueName);
    return {
      acceptanceCase: acceptance.label,
      found: matches.length > 0,
      matchCount: matches.length,
      title: event?.canonicalPreview?.title ?? fallbackLive?.title,
      date: event?.canonicalPreview?.startDate ?? fallbackLive?.startDate,
      venue: event?.canonicalPreview?.venueName ?? fallbackLive?.venueName,
      officialUrl:
        event?.canonicalPreview?.websiteUrl ??
        event?.sourceContributions.find((entry) => entry.liveValues.websiteUrl)?.liveValues
          .websiteUrl,
      ticketUrl:
        event?.canonicalPreview?.ticketUrl ??
        event?.sourceContributions.find((entry) => entry.liveValues.ticketUrl)?.liveValues
          .ticketUrl,
      price:
        event?.canonicalPreview?.priceText ??
        event?.sourceContributions.find((entry) => entry.liveValues.priceText)?.liveValues
          .priceText,
      ticketStatus:
        event?.canonicalPreview?.ticketStatus ??
        event?.sourceContributions.find((entry) => entry.liveValues.ticketStatus)?.liveValues
          .ticketStatus,
      decision:
        matches.length > 1 ? 'duplicate_candidate' : event?.decision ?? 'review',
      sourceIds: event?.sourceIds ?? [],
      conflicts:
        matches.length > 1
          ? [`multiple_live_identity_matches:${matches.length}`]
          : event
            ? event.reviewReasons
            : ['live_acceptance_case_not_found'],
    };
  });
  const historicalReferenceMatrix = HISTORICAL_REFERENCES.map((reference) => {
    const needle = normalizeMatchText(reference).replace(/\s+/g, '');
    const matches = historicalStagingEvents.filter((event) => {
      const title = event.historicalSnapshot?.title ?? event.existingComparison?.title;
      return title
        ? normalizeMatchText(title).replace(/\s+/g, '').includes(needle)
        : false;
    });
    return {
      reference,
      found: matches.length > 0,
      decision: matches.length > 0 ? 'historical_preserve' : 'review',
      consumerRepresentation: matches.map((event) => event.historicalSnapshot),
      existingEventIds: matches
        .map((event) => event.existingEventId)
        .filter((eventId): eventId is string => Boolean(eventId)),
      conflicts:
        matches.length === 0 ? ['historical_reference_not_found_in_existing_events'] : [],
    };
  });
  const removedFalseMappings = contributions
    .filter((contribution) => contribution.ignoredMappedEventId)
    .map((contribution) => ({
      ignoredMappedEventId: contribution.ignoredMappedEventId,
      sourceId: contribution.sourceId,
      externalId: contribution.externalId,
      sourceNativeIdentity: connectorIdentity(contribution.output),
      reason: 'stale_source_mapping_identity_conflict',
    }));
  const familyGaps = Object.fromEntries(
    (['official_website', 'ticket_io', 'ticket_kings', 'unsupported'] as const).map((family) => {
      const familySourceIds = new Set(
        fetchResults.filter((result) => result.family === family).map((result) => result.sourceId),
      );
      const familyEvents = stagingEvents.filter((event) =>
        event.stagingCategory === 'active_live' &&
        event.sourceIds.some((sourceId) => familySourceIds.has(sourceId)),
      );
      const missingCounts: Record<string, number> = {};
      for (const event of familyEvents) {
        for (const field of event.missingFields) {
          missingCounts[field] = (missingCounts[field] ?? 0) + 1;
        }
      }
      return [
        family,
        {
          sources: familySourceIds.size,
          events: familyEvents.length,
          failedFetches: fetchResults.filter(
            (result) => result.family === family && result.status === 'failed',
          ).length,
          recurringMissingFields: Object.entries(missingCounts)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 8)
            .map(([field, count]) => ({ field, count })),
        },
      ];
    }),
  );
  const finishedAtMs = Date.now();
  const previousMetrics = previousSummary?.metrics as JsonRecord | undefined;
  const summary = {
    phase: '4.8.6.8.3',
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    runtimeMs: finishedAtMs - startedAtMs,
    timedOut:
      finishedAtMs >= deadline ||
      fetchResults.some((result) => /time_limit/.test(result.error ?? '')),
    limits: {
      totalRunMs: RUN_LIMIT_MS,
      httpTimeoutMs: HTTP_TIMEOUT_MS,
      maxRetriesPerUrl: 1,
      fetchConcurrency: FETCH_CONCURRENCY,
    },
    activeSources: sources.length,
    sourceFetches: {
      successful: fetchResults.filter((result) => result.status === 'success').length,
      failed: fetchResults.filter((result) => result.status === 'failed').length,
      results: fetchResults.sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
    },
    metrics: {
      rawContributions: fetchResults.reduce((sum, result) => sum + result.rawEventCount, 0),
      cleanCoreContributions: contributions.length,
      uniqueStagingEvents: stagingEvents.length,
      activeLiveEvents: activeStagingEvents.length,
      historicalPreserveEvents: historicalStagingEvents.length,
      existingEvents: activeStagingEvents.filter((event) => event.existingEventId).length,
      newEvents: activeStagingEvents.filter((event) => !event.existingEventId).length,
      ...decisionCounts,
      coverage,
      beforeCoverage: previousMetrics?.coverage,
      wrongOfficialTicketUrlRoleEvents: activeStagingEvents.filter(classifyWrongUrlRole).length,
      redirectPlaceholderContentEvents:
        activeStagingEvents.filter(hasRedirectPlaceholderContent).length,
      beforeRedirectPlaceholderContentEvents:
        previousStagingEvents.filter(hasRedirectPlaceholderContent).length,
      unverifiedZeroPriceEvents: activeStagingEvents.filter(
        (event) =>
          event.canonicalPreview?.priceText?.match(/(?:^|\D)0[,.]00\s*€/i) &&
          !event.canonicalPreview.ticketPhases?.some(
            (phase) =>
              phase &&
              typeof phase === 'object' &&
              (phase as { isFree?: boolean }).isFree === true,
          ),
      ).length,
      optionalAddOnsExcluded: contributions.reduce(
        (sum, contribution) =>
          sum +
          (contribution.output.diagnostics ?? []).filter((entry) =>
            entry.startsWith('excluded_add_on:'),
          ).length,
        0,
      ),
      eventsWithCompetingSources: stagingEvents.filter((event) => event.sourceIds.length > 1)
        .length,
      eventsWithoutDbFallback: activeStagingEvents.length,
      normalizedDuplicateEndpoints: [...endpointSources.values()].filter(
        (group) => group.length > 1,
      ).length,
      unassignedOwnershipContributions: contributions.filter(
        (contribution) => !contribution.ownershipConfirmed,
      ).length,
      staleMappingsBlocked: removedFalseMappings.length,
    },
    references: referenceMatrix,
    activeAcceptanceMatrix: acceptanceMatrix,
    historicalReferenceMatrix,
    removedFalseMappings,
    recurringDataGapsBySourceFamily: familyGaps,
    cleanCoreAssessment: {
      ranWithoutProductionCodeChanges: false,
      registryExecutableWithoutOpsAdapter: false,
      notes: [
        'The existing core accepted live ConnectorOutput values without DB field fallback.',
        'The ops adapter was required for registry reads, bounded connector execution, clustering, and serialization.',
        'Verified ticket-only partial identities are surfaced as review in staging while preserving coreDecision.',
        'Source-native identity now guards mappedEventId before clustering.',
        'Historical canonical snapshots are reported separately and excluded from active coverage.',
      ],
    },
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
  };

  writeFileSync(EVENTS_PATH, `${JSON.stringify(stagingEvents, null, 2)}\n`, 'utf8');
  writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify(
      {
        summaryPath: SUMMARY_PATH,
        eventsPath: EVENTS_PATH,
        runtimeMs: summary.runtimeMs,
        activeSources: summary.activeSources,
        sourceFetches: summary.sourceFetches,
        metrics: summary.metrics,
        productionMutationsInThisRun: 0,
        rolloutActivated: false,
      },
      null,
      2,
    ),
  );
}

const execution = process.argv.includes('--smoke-test')
  ? runSmokeTest(readOnlyOpsRestConfig())
  : process.argv.includes('--evidence-probes')
    ? runEvidenceProbes(readOnlyOpsRestConfig())
    : main();

execution.catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
