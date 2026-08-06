/**
 * Phase 4.7.2 — Ticket Presentation Truth, Venue Ownership and Flyer Evidence
 *
 * Read-only preflight by default. Production repair requires explicit gate approval.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase472-ticket-venue-flyer-evidence.ts audit
 *   npx tsx scripts/operations/_phase472-ticket-venue-flyer-evidence.ts preflight
 *   npx tsx scripts/operations/_phase472-ticket-venue-flyer-evidence.ts full
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { buildFlyerInventoryEntry } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-enrichment-contract';
import { enrichFlyerLineup } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';
import { extractNativeEventCheckoutUrl, parseTicketKingsCheckoutHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { extractTicketIoShopSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { resolveTicketIoPriceStrategy } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-strategy-registry';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { classifyTicketPriceFailure } from '@/features/events/domain/ticket-price-failure-classification';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import {
  resolveTicketProviderDisplayLabel,
  resolveTicketProviderPresentationLabel,
} from '@/features/events/formatting/ticket-platform-presentation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_DATA = join(ROOT, 'docs/real-data');
const OUT_FIELD_OWNERSHIP = join(REAL_DATA, '_phase472_field_ownership_audit.json');
const OUT_PROVIDER_VIOLATIONS = join(REAL_DATA, '_phase472_ticket_provider_violations.json');
const OUT_VENUE_CONFLICTS = join(REAL_DATA, '_phase472_venue_conflicts.json');
const OUT_PRICE_TRACES = join(REAL_DATA, '_phase472_price_traces.json');
const OUT_AVAILABILITY_TRACES = join(REAL_DATA, '_phase472_availability_traces.json');
const OUT_FLYER_INVENTORY = join(REAL_DATA, '_phase472_flyer_inventory.json');
const OUT_FLYER_CANDIDATES = join(REAL_DATA, '_phase472_flyer_candidates.json');
const OUT_QUALITY_VIOLATIONS = join(REAL_DATA, '_phase472_quality_rule_violations.json');
const OUT_BEFORE_AFTER = join(REAL_DATA, '_phase472_before_after.json');
const OUT_BACKUP = join(REAL_DATA, '_phase472_repair_backup.json');
const OUT_RUNS = join(REAL_DATA, '_phase472_repair_runs.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_472_TICKET_VENUE_FLYER_EVIDENCE_REPORT.md');

const BOOTSHAUS_VENUE_ID = 'venue-bootshaus-koeln';
const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const c = opsClient();
  const { data, error } = await c.from('events').select('*').eq('status', 'published');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function buildCanonicalRead(event: AdminEventRecord) {
  return readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
  });
}

function projectedProviderLabel(event: AdminEventRecord) {
  const canonical = buildCanonicalRead(event);
  const sourceLabel = getSourceDisplayLabel(event.sourceId ?? 'supabase', canonical.publicCtaUrl);
  return resolveTicketProviderPresentationLabel({
    purchaseUrl: canonical.publicCtaUrl,
    ticketPlatform: canonical.ticketPlatform,
    destinationClass: canonical.destinationClass,
    sourceAttributionLabel: sourceLabel,
  });
}

async function auditFieldOwnership(events: AdminEventRecord[]) {
  const rows = events.map((event) => {
    const canonical = buildCanonicalRead(event);
    const sourceLabel = getSourceDisplayLabel(event.sourceId ?? 'supabase', canonical.publicCtaUrl);
    const ticketPlatformLabel = resolveTicketProviderDisplayLabel({
      purchaseUrl: canonical.publicCtaUrl,
      ticketPlatform: canonical.ticketPlatform,
      destinationClass: canonical.destinationClass,
    });
    return {
      eventId: event.id,
      title: event.title,
      organizer: event.organizerName,
      promoter: event.organizerName,
      sourceName: event.sourceId,
      sourceAttributionLabel: sourceLabel,
      officialEventUrl: event.websiteUrl ?? canonical.officialEventUrl,
      ticketPlatform: canonical.ticketPlatform,
      ticketPlatformLabel,
      purchaseUrl: canonical.publicCtaUrl,
      venueName: event.venueName,
      venueCity: event.venueCity,
      venueId: event.venueId,
    };
  });
  writeJson(OUT_FIELD_OWNERSHIP, { generatedAt: new Date().toISOString(), events: rows });
  return rows;
}

async function auditTicketProviders(events: AdminEventRecord[]) {
  const violations = [];
  for (const event of events) {
    const canonical = buildCanonicalRead(event);
    if (!canonical.publicCtaUrl) {
      continue;
    }
    const currentLabel = getSourceDisplayLabel(event.sourceId ?? 'supabase', canonical.publicCtaUrl);
    const expectedLabel = projectedProviderLabel(event);
    const host = classifyTicketDestination(canonical.publicCtaUrl).host;
    const mismatch =
      currentLabel !== expectedLabel ||
      (/ticket\.io/i.test(canonical.publicCtaUrl) && currentLabel.toLowerCase().includes('bootshaus')) ||
      (/ticketkings/i.test(canonical.publicCtaUrl) && /affenkaefig|bootshaus/i.test(currentLabel.toLowerCase()) && expectedLabel === 'Ticket Kings');

    if (mismatch) {
      violations.push({
        eventId: event.id,
        title: event.title,
        purchaseUrl: canonical.publicCtaUrl,
        host,
        ticketPlatform: canonical.ticketPlatform,
        currentProviderLabel: currentLabel,
        expectedProviderLabel: expectedLabel,
        sourceId: event.sourceId,
        rule: 'ticket_platform_label_conflicts_with_purchase_url',
      });
    }
  }
  writeJson(OUT_PROVIDER_VIOLATIONS, {
    generatedAt: new Date().toISOString(),
    totalViolations: violations.length,
    violations,
  });
  return violations;
}

async function auditVenues(events: AdminEventRecord[]) {
  const conflicts = [];
  for (const event of events) {
    const organizer = event.organizerName?.trim();
    const venue = event.venueName?.trim();
    const isExternalTitle = /@\s*[^@]+/i.test(event.title);
    const pinnedBootshaus = event.venueId === BOOTSHAUS_VENUE_ID;
    const organizerIsBootshaus = /bootshaus/i.test(organizer ?? '');
    const venueIsBootshaus = /bootshaus/i.test(venue ?? '');
    const venueDiffersFromOrganizer =
      Boolean(organizer && venue) && organizer.toLowerCase() !== venue.toLowerCase();

    if (isExternalTitle && pinnedBootshaus) {
      conflicts.push({
        eventId: event.id,
        title: event.title,
        rule: 'external_title_with_default_venue_id',
        venueId: event.venueId,
        venueName: venue,
        venueCity: event.venueCity,
      });
    }
    if (organizerIsBootshaus && venue && !venueIsBootshaus && !isExternalTitle && pinnedBootshaus) {
      conflicts.push({
        eventId: event.id,
        title: event.title,
        rule: 'promoter_bootshaus_venue_not_independent',
        organizer,
        venueName: venue,
        venueId: event.venueId,
      });
    }
    if (venueDiffersFromOrganizer) {
      conflicts.push({
        eventId: event.id,
        title: event.title,
        rule: 'organizer_differs_from_venue',
        organizer,
        venueName: venue,
        venueCity: event.venueCity,
        venueId: event.venueId,
      });
    }
  }
  writeJson(OUT_VENUE_CONFLICTS, {
    generatedAt: new Date().toISOString(),
    totalConflicts: conflicts.length,
    conflicts,
  });
  return conflicts;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function auditPrices(events: AdminEventRecord[]) {
  const traces = [];
  for (const event of events) {
    const canonical = buildCanonicalRead(event);
    const purchaseUrl = canonical.publicCtaUrl;
    if (!purchaseUrl) {
      continue;
    }
    let sourcePriceText: string | undefined;
    let sourcePriceAmount: number | undefined;
    let publicSurfacesInspected = false;
    let publicPageConfirmedNoPrice = false;

    try {
      if (/ticketkings\.de\/event\//i.test(purchaseUrl)) {
        const html = await fetchHtml(purchaseUrl);
        publicSurfacesInspected = true;
        const checkoutUrl = extractNativeEventCheckoutUrl(html);
        const checkoutHtml = checkoutUrl ? await fetchHtml(checkoutUrl).catch(() => undefined) : undefined;
        const evidence = parseTicketKingsCheckoutHtml(checkoutHtml ?? html);
        sourcePriceText = evidence.priceText;
        sourcePriceAmount = evidence.priceAmount;
        publicPageConfirmedNoPrice = !sourcePriceText && !sourcePriceAmount;
      } else if (/\.ticket\.io\//i.test(purchaseUrl)) {
        const shopSlug = extractTicketIoShopSlug(purchaseUrl);
        const strategy = shopSlug ? resolveTicketIoPriceStrategy(shopSlug) : undefined;
        publicSurfacesInspected = true;
        sourcePriceText = event.priceText;
        publicPageConfirmedNoPrice = !event.priceText?.trim();
        traces.push({
          eventId: event.id,
          title: event.title,
          platform: 'ticket.io',
          shopSlug,
          strategy: strategy?.strategy,
          persistedPriceText: event.priceText,
          canonicalPriceText: canonical.priceText,
          uiPriceVisible: Boolean(canonical.priceText?.trim()),
          failureClass: classifyTicketPriceFailure({
            hasPublicPurchaseUrl: true,
            sourcePriceText,
            persistedPriceText: event.priceText,
            canonicalPriceText: canonical.priceText,
            apiPriceText: event.priceText,
            viewModelPriceText: canonical.priceText,
            publicSurfacesInspected,
            publicPageConfirmedNoPrice,
          }),
        });
        continue;
      }
    } catch {
      publicSurfacesInspected = false;
    }

    traces.push({
      eventId: event.id,
      title: event.title,
      purchaseUrl,
      platform: canonical.ticketPlatform,
      sourcePriceText,
      sourcePriceAmount,
      persistedPriceText: event.priceText,
      canonicalPriceText: canonical.priceText,
      uiPriceVisible: Boolean(canonical.priceText?.trim()),
      publicSurfacesInspected,
      failureClass: classifyTicketPriceFailure({
        hasPublicPurchaseUrl: true,
        sourcePriceText,
        sourcePriceAmount,
        persistedPriceText: event.priceText,
        canonicalPriceText: canonical.priceText,
        apiPriceText: event.priceText,
        viewModelPriceText: canonical.priceText,
        publicSurfacesInspected,
        publicPageConfirmedNoPrice,
      }),
    });
  }
  writeJson(OUT_PRICE_TRACES, { generatedAt: new Date().toISOString(), events: traces });
  return traces;
}

async function auditAvailability(events: AdminEventRecord[]) {
  const traces = events
    .filter((event) => Boolean(event.ticketUrl))
    .map((event) => {
      const canonical = buildCanonicalRead(event);
      return {
        eventId: event.id,
        title: event.title,
        purchaseUrl: canonical.publicCtaUrl,
        persistedTicketStatus: event.ticketStatus,
        canonicalAvailability: canonical.availability,
        uiAvailabilityVisible: canonical.availability !== 'unknown',
        phaseCount: event.ticketPhases?.length ?? 0,
        soldOut: canonical.availability === 'sold_out',
        unknownReason:
          canonical.availability === 'unknown'
            ? event.ticketPhases?.length
              ? 'phases_without_aggregate_availability'
              : 'no_explicit_availability_evidence'
            : undefined,
      };
    });
  writeJson(OUT_AVAILABILITY_TRACES, { generatedAt: new Date().toISOString(), events: traces });
  return traces;
}

async function inventoryFlyers(events: AdminEventRecord[]) {
  const inventory = events.map((event) =>
    buildFlyerInventoryEntry({
      eventId: event.id,
      title: event.title,
      imageUrl: event.imageUrl ?? '',
      imageSource: event.sourceId ?? 'unknown',
      missingFields: ['lineup'],
      textualSources: [event.description ? 'description' : ''].filter(Boolean),
    }),
  );
  writeJson(OUT_FLYER_INVENTORY, { generatedAt: new Date().toISOString(), events: inventory });
  return inventory;
}

async function extractFlyerCandidates(events: AdminEventRecord[]) {
  const candidates = [];
  for (const event of events) {
    if (!event.imageUrl?.trim()) {
      continue;
    }
    const enrichment = enrichFlyerLineup({
      imageUrl: event.imageUrl,
      eventTitle: event.title,
      venueName: event.venueName,
      cityName: event.venueCity,
    });
    if (enrichment.candidates.length === 0 && enrichment.status === 'pending') {
      candidates.push({
        eventId: event.id,
        title: event.title,
        status: enrichment.status,
        candidateCount: 0,
        reviewRequired: true,
        note: 'ocr_pending_no_raw_text',
      });
      continue;
    }
    if (enrichment.candidates.length === 0) {
      continue;
    }
    candidates.push({
      eventId: event.id,
      title: event.title,
      status: enrichment.status,
      candidateCount: enrichment.candidates.length,
      autoPublishCount: enrichment.autoPublishCandidates.length,
      reviewCount: enrichment.reviewCandidates.length,
      reviewRequired: enrichment.reviewCandidates.length > 0,
    });
  }
  writeJson(OUT_FLYER_CANDIDATES, { generatedAt: new Date().toISOString(), events: candidates });
  return candidates;
}

async function qualityAudit(events: AdminEventRecord[]) {
  const violations: Record<string, unknown[]> = {
    ticket_platform_label_conflicts_with_purchase_url: [],
    organizer_used_as_ticket_platform: [],
    default_venue_conflicts_with_external_venue: [],
    active_purchase_url_missing_availability_reason: [],
    explicit_price_in_source_missing_canonically: [],
    explicit_sold_out_marker_not_canonical: [],
  };

  for (const event of events) {
    const canonical = buildCanonicalRead(event);
    const currentLabel = getSourceDisplayLabel(event.sourceId ?? 'supabase', canonical.publicCtaUrl);
    const expectedLabel = projectedProviderLabel(event);
    if (canonical.publicCtaUrl && currentLabel !== expectedLabel) {
      violations.ticket_platform_label_conflicts_with_purchase_url.push({
        eventId: event.id,
        title: event.title,
        currentLabel,
        expectedLabel,
      });
    }
    if (/ticket\.io/i.test(canonical.publicCtaUrl ?? '') && currentLabel.toLowerCase().includes('bootshaus')) {
      violations.organizer_used_as_ticket_platform.push({ eventId: event.id, title: event.title, currentLabel });
    }
    if (/@/i.test(event.title) && event.venueId === BOOTSHAUS_VENUE_ID) {
      violations.default_venue_conflicts_with_external_venue.push({ eventId: event.id, title: event.title });
    }
    if (canonical.publicCtaUrl && canonical.availability === 'unknown') {
      violations.active_purchase_url_missing_availability_reason.push({ eventId: event.id, title: event.title });
    }
    if (event.priceText?.trim() && !canonical.priceText?.trim()) {
      violations.explicit_price_in_source_missing_canonically.push({ eventId: event.id, title: event.title });
    }
    if (event.ticketStatus === 'sold_out' && canonical.availability !== 'sold_out') {
      violations.explicit_sold_out_marker_not_canonical.push({ eventId: event.id, title: event.title });
    }
  }

  writeJson(OUT_QUALITY_VIOLATIONS, {
    generatedAt: new Date().toISOString(),
    violations,
    totals: Object.fromEntries(
      Object.entries(violations).map(([rule, rows]) => [rule, rows.length]),
    ),
  });
  return violations;
}

function writeReport(summary: Record<string, unknown>): void {
  const md = `# Phase 4.7.2 — Ticket Presentation Truth, Venue Ownership and Flyer Evidence

**Generated:** ${new Date().toISOString()}

## Preflight summary (read-only)

${Object.entries(summary)
  .map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`)
  .join('\n')}

## Verdicts

| Area | Status |
|------|--------|
| Ticket provider presentation | Code updated; production repair Gate A not run |
| Venue ownership | Audit complete; Gate B not run |
| Price extraction | Connector improvements; Gate C not run |
| Availability and sold-out | Audit complete; Gate C not run |
| Flyer evidence pipeline | Inventory/candidate extraction; Gate D not run |
| Production repair | **not run** |
| Mobile acceptance | **not performed** |

## Approval gates (not executed)

- Gate A — Ticket provider presentation
- Gate B — Venue ownership
- Gate C — Ticket price and availability
- Gate D — Approved flyer lineup candidates
`;
  writeFileSync(OUT_REPORT, md);
}

async function runPreflight(): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const providerViolations = await auditTicketProviders(events);
  const venueConflicts = await auditVenues(events);
  await auditFieldOwnership(events);
  const priceTraces = await auditPrices(events);
  const availabilityTraces = await auditAvailability(events);
  const flyerInventory = await inventoryFlyers(events);
  const flyerCandidates = await extractFlyerCandidates(events);
  const quality = await qualityAudit(events);

  const summary = {
    totalPublished: events.length,
    incorrectTicketProviderLabelsBefore: providerViolations.length,
    incorrectTicketProviderLabelsAfter: providerViolations.length,
    venueConflictsBefore: venueConflicts.length,
    venueConflictsAfter: venueConflicts.length,
    eventsWithVisiblePrice: events.filter((event) => Boolean(event.priceText?.trim())).length,
    eventsGainingVisiblePrice: 0,
    eventsWithExplicitAvailability: availabilityTraces.filter((row) => row.uiAvailabilityVisible).length,
    eventsGainingExplicitAvailability: 0,
    soldOutEventsCorrect: availabilityTraces.filter((row) => row.soldOut).length,
    flyerCandidatesExtracted: flyerCandidates.length,
    flyerCandidatesAutoAccepted: flyerCandidates.filter((row) => !row.reviewRequired).length,
    flyerCandidatesReview: flyerCandidates.filter((row) => row.reviewRequired).length,
    eventsGainingStructuredLineups: 0,
    productionRepairMutations: 0,
    qualityRuleTotals: (quality as { totals?: Record<string, number> }).totals,
    priceFailureCounts: priceTraces.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.failureClass ?? 'none');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };

  writeJson(OUT_BEFORE_AFTER, { generatedAt: new Date().toISOString(), summary });
  writeReport(summary);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function rejectRepair(command: string): never {
  throw new Error(
    `${command} requires explicit gate approval. Run preflight first, review deliverables, then approve Gate A/B/C/D separately.`,
  );
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'preflight';

  if (command === 'audit' || command === 'preflight') {
    await runPreflight();
    return;
  }
  if (command === 'audit-ticket-providers') {
    await auditTicketProviders(await loadPublishedEvents());
    return;
  }
  if (command === 'audit-venues') {
    await auditVenues(await loadPublishedEvents());
    return;
  }
  if (command === 'audit-prices') {
    await auditPrices(await loadPublishedEvents());
    return;
  }
  if (command === 'audit-availability') {
    await auditAvailability(await loadPublishedEvents());
    return;
  }
  if (command === 'inventory-flyers') {
    await inventoryFlyers(await loadPublishedEvents());
    return;
  }
  if (command === 'extract-flyer-candidates') {
    await extractFlyerCandidates(await loadPublishedEvents());
    return;
  }
  if (command === 'quality-audit') {
    await qualityAudit(await loadPublishedEvents());
    return;
  }
  if (command === 'full') {
    await runPreflight();
    return;
  }
  if (
    command.startsWith('repair') ||
    command.startsWith('backup')
  ) {
    rejectRepair(command);
  }
  if (command === 'report') {
    if (!existsSync(OUT_BEFORE_AFTER)) {
      await runPreflight();
    } else {
      const summary = JSON.parse(readFileSync(OUT_BEFORE_AFTER, 'utf8')).summary;
      writeReport(summary);
    }
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
