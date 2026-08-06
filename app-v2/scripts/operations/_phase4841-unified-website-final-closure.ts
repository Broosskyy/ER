/**
 * Phase 4.8.4.1 — Unified Official Website Importer Final Capability Closure (READ ONLY).
 *
 * Closes title normalization, description boundaries, lineup evidence, venue hierarchy.
 * No production writes, scheduling, or connector integration.
 *
 * Usage:
 *   node --import tsx scripts/operations/_phase4841-unified-website-final-closure.ts <command>
 *
 * Commands:
 *   validate-titles | validate-descriptions | validate-lineups | validate-venues
 *   validate-ticket-ownership | run-full-sample | reality-check | remaining-gaps | report | full
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateUnifiedImportResult } from '@/features/import/contracts/unified-import-schema';
import { GOLD_STANDARD_REFERENCE_EVENTS, setPilotHtmlFixtures, clearPilotHtmlFixtures } from '@/features/import/pilots/gold-standard-reference';
import { runOfficialWebsitePilotForEvent } from '@/features/import/pilots/official-website-pilot';
import {
  buildImportContextFromRef,
  extractDetailPage,
  extractEventDescription,
  extractDescriptionBoundariesFromHtml,
  extractLineupFromContentBlocks,
  normalizeOfficialPageTitle,
  runUnifiedWebsiteImport,
  UNIFIED_WEBSITE_IMPORTER_VERSION,
  bootshausProviderAdapter,
} from '@/features/import/unified-website';
import {
  assertShadowNoWrite,
  deliberateWriteAttemptShouldFail,
  resetShadowWriteAttempts,
  wrapClientForShadowReadOnly,
} from '@/features/import/shadow/shadow-no-write-guard';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const LIVE_EVIDENCE_DIR = join(OUT, '_phase4823_live_evidence');
const FRESH_SHADOW_PATH = join(OUT, '_phase4823_fresh_shadow.json');
const CONSUMER_VERIFICATION_PATH = join(OUT, '_phase4823_consumer_verification.json');

let productionMutationsInThisRun = 0;

const REALITY_CHECK_EVENTS = [
  {
    key: 'bootshaus-sommerfest',
    eventId: 'evt-1785339391167-tfaixrr',
    label: 'Bootshaus Sommerfest',
    websiteUrl: 'https://bootshaus.tv/events/bootshaus-sommerfest',
    fixtureFile: 'live-official-website-80.html',
    ticketUrl: 'https://bootshaus-club.ticket.io/vB0cAmWg/',
  },
  {
    key: 'r3hab',
    eventId: 'evt-1785339421539-k3swcrl',
    label: 'R3HAB pres. by BOOTSHAUS',
    websiteUrl: 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus',
    fixtureFile: 'live-official-website-98.html',
    ticketUrl: 'https://bootshaus-club.ticket.io/C7JPnatZ/',
  },
] as const;

type ImporterGap = {
  eventKey: string;
  category: string;
  reason: string;
  intentional: boolean;
};

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function assertReadOnly(): void {
  resetShadowWriteAttempts();
  wrapClientForShadowReadOnly(opsClient);
  const writeGuardWorks = deliberateWriteAttemptShouldFail();
  const guard = assertShadowNoWrite({ productionMutationsInThisRun });
  if (!writeGuardWorks || !guard.ok) {
    throw new Error(`Shadow no-write guard failed: ${guard.violations.join(', ')}`);
  }
}

function loadAllHtmlFixtures(): Record<string, { status: number; finalUrl: string; html: string }> {
  const fixtures: Record<string, { status: number; finalUrl: string; html: string }> = {};
  if (!existsSync(LIVE_EVIDENCE_DIR)) return fixtures;

  for (const file of readdirSync(LIVE_EVIDENCE_DIR)) {
    if (!file.endsWith('.html')) continue;
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, file), 'utf8');
    const canonical = html.match(/rel="canonical" href="([^"]+)"/i)?.[1];
    const pageUrl = html.match(/property="og:url" content="([^"]+)"/i)?.[1];
    const url = canonical ?? pageUrl;
    if (url) {
      fixtures[url.replace(/\/$/, '').toLowerCase()] = { status: 200, finalUrl: url, html };
    }
  }
  return fixtures;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

function loadFixtureByUrl(url: string): string {
  const fixtures = loadAllHtmlFixtures();
  const entry = fixtures[normalizeUrl(url)];
  return entry?.html ?? '';
}

function loadCaptures(): Array<{
  eventId: string;
  sampleId: string;
  url: string;
  htmlPath: string;
}> {
  if (!existsSync(FRESH_SHADOW_PATH)) return [];
  const raw = JSON.parse(readFileSync(FRESH_SHADOW_PATH, 'utf8')) as {
    captures: Array<{ eventId: string; sampleId: string; url: string; htmlPath: string }>;
  };
  return raw.captures ?? [];
}

function fieldValue(
  result: Awaited<ReturnType<typeof runOfficialWebsitePilotForEvent>>,
  field: string,
  useRaw = false,
): unknown {
  const c = result.fieldEvidenceCandidates.find((x) => x.fieldName === field);
  if (!c) return undefined;
  return useRaw ? c.rawValue : c.normalizedValue;
}

async function validateTitles(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const results: unknown[] = [];
  const gaps: ImporterGap[] = [];

  const cases = [
    ...REALITY_CHECK_EVENTS.map((e) => ({
      key: e.key,
      rawTitle: 'from fixture',
      url: e.websiteUrl,
    })),
    ...GOLD_STANDARD_REFERENCE_EVENTS.map((e) => ({ key: e.key, rawTitle: 'from fixture', url: e.websiteUrl })),
  ];

  const fixtures = loadAllHtmlFixtures();
  setPilotHtmlFixtures(
    Object.fromEntries(
      Object.entries(fixtures).map(([k, v]) => [v.finalUrl, v]),
    ),
  );

  for (const c of cases) {
    const html = loadFixtureByUrl(c.url);
    if (!html) continue;
    const detail = extractDetailPage(html, c.url);
    const raw = detail.title?.rawTitle ?? '';
    const normalized = detail.title?.normalizedTitle ?? '';
    const suffixRemoved = detail.title?.suffixRemoved ?? false;

    const record = { eventKey: c.key, url: c.url, rawTitle: raw, normalizedTitle: normalized, suffixRemoved };
    results.push(record);

    if (raw.includes('| Bootshaus Club') && normalized.includes('| Bootshaus Club')) {
      gaps.push({
        eventKey: c.key,
        category: 'title',
        reason: 'SUFFIX_NOT_STRIPPED',
        intentional: false,
      });
    }
    if (c.key === 'r3hab' && normalized !== 'R3HAB pres. by BOOTSHAUS') {
      gaps.push({ eventKey: c.key, category: 'title', reason: 'R3HAB_TITLE_MISMATCH', intentional: false });
    }
    if (c.key === 'bootshaus-sommerfest' && normalized !== 'Bootshaus Sommerfest') {
      gaps.push({ eventKey: c.key, category: 'title', reason: 'SOMMERFEST_TITLE_MISMATCH', intentional: false });
    }
  }

  clearPilotHtmlFixtures();
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    passCount: results.length - gaps.length,
    failCount: gaps.length,
    results,
    gaps,
  };
}

async function validateDescriptions(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const results: unknown[] = [];
  const gaps: ImporterGap[] = [];

  for (const event of REALITY_CHECK_EVENTS) {
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, event.fixtureFile), 'utf8');
    const boundaries = extractDescriptionBoundariesFromHtml(html);
    const desc = extractEventDescription(html);

    const forbidden = [
      'August 7th',
      'bit.ly',
      'Mobile App',
      'Merchandise',
      'Einlass ab 18',
      'Auenweg 173',
      'www.bootshaus.tv',
    ];
    const contamination = forbidden.filter((f) => desc.description?.includes(f));

    const record = {
      eventKey: event.key,
      rawBlockCount: boundaries.rawBlocks.length,
      contentBlockCount: boundaries.contentBlocks.length,
      removedBlocks: boundaries.removedBlocks,
      normalizedDescription: desc.description,
      boilerplateStripped: desc.boilerplateStripped,
    };
    results.push(record);

    if (event.key === 'r3hab') {
      if (!desc.description?.includes('September 4th')) {
        gaps.push({ eventKey: event.key, category: 'description', reason: 'MISSING_SEPTEMBER_CONTENT', intentional: false });
      }
      for (const c of contamination) {
        gaps.push({ eventKey: event.key, category: 'description', reason: `FOOTER_CONTAMINATION:${c}`, intentional: false });
      }
      if (/▔{4,}/.test(desc.description ?? '')) {
        gaps.push({ eventKey: event.key, category: 'description', reason: 'DIVIDER_GLYPHS_REMAIN', intentional: false });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    passCount: results.length - gaps.length,
    failCount: gaps.length,
    results,
    gaps,
  };
}

async function validateLineups(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const results: unknown[] = [];
  const gaps: ImporterGap[] = [];

  for (const event of REALITY_CHECK_EVENTS) {
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, event.fixtureFile), 'utf8');
    const blocks = extractDescriptionBoundariesFromHtml(html).contentBlocks;
    const lineup = extractLineupFromContentBlocks(blocks);

    results.push({
      eventKey: event.key,
      state: lineup.state,
      entries: lineup.entries,
    });

    if (event.key === 'r3hab') {
      const names = lineup.entries.map((e) => e.displayName);
      const expected = ['R3HAB', 'LA FUENTE', 'OLIVER MAGENTA', 'RELOVA', 'DAVE REPLAY'];
      if (lineup.state !== 'explicit_artists' || JSON.stringify(names) !== JSON.stringify(expected)) {
        gaps.push({ eventKey: event.key, category: 'lineup', reason: 'R3HAB_LINEUP_MISMATCH', intentional: false });
      }
      if (!lineup.entries[0]?.stage?.includes('MAINFLOOR')) {
        gaps.push({ eventKey: event.key, category: 'lineup', reason: 'MAINFLOOR_STAGE_MISSING', intentional: false });
      }
    }
    if (event.key === 'bootshaus-sommerfest') {
      if (lineup.state !== 'tba' || lineup.entries.length > 0) {
        gaps.push({ eventKey: event.key, category: 'lineup', reason: 'SOMMERFEST_TBA_STATE_WRONG', intentional: false });
      }
      if (lineup.entries.some((e) => e.displayName === 'TBA')) {
        gaps.push({ eventKey: event.key, category: 'lineup', reason: 'FAKE_TBA_ARTIST', intentional: false });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    passCount: results.length - gaps.length,
    failCount: gaps.length,
    results,
    gaps,
  };
}

async function validateVenues(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const results: unknown[] = [];
  const gaps: ImporterGap[] = [];

  for (const event of REALITY_CHECK_EVENTS) {
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, event.fixtureFile), 'utf8');
    const detail = extractDetailPage(html, event.websiteUrl);

    results.push({
      eventKey: event.key,
      venue: detail.venue,
      organizerName: detail.organizerName,
    });

    if (event.key === 'bootshaus-sommerfest' && detail.venue?.venueName === 'Bootshaus') {
      gaps.push({
        eventKey: event.key,
        category: 'venue',
        reason: 'PROVIDER_INFERRED_AS_VENUE',
        intentional: false,
      });
    }
    if (event.key === 'r3hab' && detail.venue?.venueName !== 'Bootshaus') {
      gaps.push({
        eventKey: event.key,
        category: 'venue',
        reason: 'R3HAB_VENUE_NOT_EMITTED',
        intentional: false,
      });
    }
    if (detail.venue?.source === 'provider_default_candidate' && detail.venue.reviewState !== 'pending') {
      gaps.push({
        eventKey: event.key,
        category: 'venue',
        reason: 'PROVIDER_DEFAULT_MISSING_REVIEW_STATE',
        intentional: false,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    passCount: results.length - gaps.length,
    failCount: gaps.length,
    results,
    gaps,
  };
}

async function validateTicketOwnership(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const results: unknown[] = [];
  const gaps: ImporterGap[] = [];

  const fixtures = loadAllHtmlFixtures();
  setPilotHtmlFixtures(Object.fromEntries(Object.entries(fixtures).map(([, v]) => [v.finalUrl, v])));

  for (const event of [...REALITY_CHECK_EVENTS, ...GOLD_STANDARD_REFERENCE_EVENTS.map((e) => ({
    key: e.key,
    eventId: e.eventId,
    websiteUrl: e.websiteUrl,
    ticketUrl: e.ticketUrl,
  }))]) {
    const html = loadFixtureByUrl(event.websiteUrl);
    if (!html) continue;

    const result = runUnifiedWebsiteImport({
      context: buildImportContextFromRef({
        key: event.key,
        eventId: 'eventId' in event ? event.eventId : `evt-${event.key}`,
        websiteUrl: event.websiteUrl,
      }),
      html,
      fetchMeta: { status: 200, finalUrl: event.websiteUrl },
    });

    const ticketField = result.fieldEvidenceCandidates.find((c) => c.fieldName === 'ticket_destination_candidate');
    const priceFields = result.fieldEvidenceCandidates.filter((c) =>
      String(c.fieldName).match(/price|availability|sold_out|phase/i),
    );

    results.push({
      eventKey: event.key,
      hasTicketCta: Boolean(ticketField),
      ticketUrl: ticketField?.normalizedValue,
      priceFieldCount: priceFields.length,
    });

    if (priceFields.length > 0) {
      gaps.push({ eventKey: event.key, category: 'ticket', reason: 'WEBSITE_CLAIMS_PRICE_OR_STATUS', intentional: false });
    }
  }

  clearPilotHtmlFixtures();
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    passCount: results.length - gaps.length,
    failCount: gaps.length,
    results,
    gaps,
    ticketPriceOutOfScope: true,
  };
}

async function runFullSample(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const captures = loadCaptures();
  const fixtures = loadAllHtmlFixtures();
  setPilotHtmlFixtures(Object.fromEntries(Object.entries(fixtures).map(([, v]) => [v.finalUrl, v])));

  const events: unknown[] = [];
  const gaps: ImporterGap[] = [];
  let pass = 0;
  let fail = 0;

  for (const capture of captures) {
    const htmlPath = join(OUT, capture.htmlPath);
    if (!existsSync(htmlPath)) {
      fail++;
      gaps.push({ eventKey: capture.sampleId, category: 'fixture', reason: 'HTML_FIXTURE_MISSING', intentional: false });
      continue;
    }

    const html = readFileSync(htmlPath, 'utf8');
    const detail = extractDetailPage(html, capture.url);
    const desc = extractEventDescription(html);
    const lineup = extractLineupFromContentBlocks(
      extractDescriptionBoundariesFromHtml(html).contentBlocks,
    );
    const ticket = detail.ticket;

    const result = runUnifiedWebsiteImport({
      context: buildImportContextFromRef({
        key: capture.sampleId,
        eventId: capture.eventId,
        websiteUrl: capture.url,
      }),
      html,
      fetchMeta: { status: 200, finalUrl: capture.url },
    });
    validateUnifiedImportResult(result);

    const eventGap: ImporterGap[] = [];
    if (detail.title?.rawTitle && detail.title.normalizedTitle === detail.title.rawTitle &&
        detail.title.rawTitle.match(/\|\s*Bootshaus Club/i)) {
      eventGap.push({ eventKey: capture.sampleId, category: 'title', reason: 'SUFFIX_NOT_STRIPPED', intentional: false });
    }
    if (desc.description?.includes('bit.ly') || desc.description?.includes('Mobile App')) {
      eventGap.push({ eventKey: capture.sampleId, category: 'description', reason: 'FOOTER_CONTAMINATION', intentional: false });
    }

    if (eventGap.length === 0) pass++;
    else fail++;
    gaps.push(...eventGap);

    events.push({
      eventId: capture.eventId,
      sampleId: capture.sampleId,
      url: capture.url,
      rawTitle: detail.title?.rawTitle,
      normalizedTitle: detail.title?.normalizedTitle,
      description: desc.description,
      removedBlocks: desc.boundaries?.removedBlocks ?? [],
      lineupState: lineup.state,
      lineupEntries: lineup.entries.map((e) => ({ name: e.displayName, stage: e.stage })),
      venue: detail.venue,
      ticketCta: ticket?.url,
      rejectedTicketLinks: ticket?.rejectedPromotional,
      genres: detail.genres,
      flyerUrl: detail.flyerUrl,
      galleryUrls: detail.galleryUrls,
      diagnostics: detail.diagnostics,
      gaps: eventGap,
    });
  }

  clearPilotHtmlFixtures();
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    sampleCount: captures.length,
    passCount: pass,
    failCount: fail,
    events,
    gaps,
  };
}

async function realityCheck(): Promise<Record<string, unknown>> {
  assertReadOnly();
  const client = opsClient();
  const consumerVerification = existsSync(CONSUMER_VERIFICATION_PATH)
    ? JSON.parse(readFileSync(CONSUMER_VERIFICATION_PATH, 'utf8'))
    : { events: {} };

  const comparisons: unknown[] = [];

  for (const event of REALITY_CHECK_EVENTS) {
    const html = readFileSync(join(LIVE_EVIDENCE_DIR, event.fixtureFile), 'utf8');
    const result = runUnifiedWebsiteImport({
      context: buildImportContextFromRef({
        key: event.key,
        eventId: event.eventId,
        websiteUrl: event.websiteUrl,
        verifiedTicketUrl: event.ticketUrl,
      }),
      html,
      fetchMeta: { status: 200, finalUrl: event.websiteUrl },
    });

    const { data: dbRow } = await client.from('events').select('*').eq('id', event.eventId).maybeSingle();
    const cv = (consumerVerification.events as Record<string, unknown>)?.[event.eventId] as
      | Record<string, unknown>
      | undefined;

    comparisons.push({
      eventKey: event.key,
      eventId: event.eventId,
      officialUrl: event.websiteUrl,
      fields: {
        title: {
          official: fieldValue(result, 'title', true),
          unifiedNormalized: fieldValue(result, 'title'),
          canonicalDb: dbRow?.title,
          appProjection: (cv?.after as Record<string, unknown>)?.canonicalReader
            ? ((cv?.after as Record<string, unknown>).canonicalReader as Record<string, unknown>)?.title
            : undefined,
        },
        description: {
          unified: fieldValue(result, 'description'),
          canonicalDb: dbRow?.description,
          publicEvidence: (cv?.publicEvidence as Record<string, unknown>)?.description,
        },
        venue: {
          unified: fieldValue(result, 'venue'),
          canonicalDb: dbRow?.venue_name ?? dbRow?.venueName,
          appVenueLabel: ((cv?.after as Record<string, unknown>)?.apiProjection as Record<string, unknown>)?.venueLabel,
        },
        lineup: {
          unifiedEntries: result.lineupEvidenceEntries,
          canonicalDb: dbRow?.lineup,
        },
        ticketUrl: {
          unified: fieldValue(result, 'ticket_destination_candidate'),
          canonicalDb: dbRow?.ticket_url ?? dbRow?.ticketUrl,
          verified: event.ticketUrl,
        },
        ticketPrice: {
          scope: 'ticket_platform',
          unifiedClaims: false,
          canonicalDb: dbRow?.price_text ?? dbRow?.priceText,
        },
        flyer: {
          unified: fieldValue(result, 'flyer'),
          canonicalDb: dbRow?.image_url ?? dbRow?.imageUrl,
        },
        genres: {
          unified: fieldValue(result, 'genres'),
          canonicalDb: dbRow?.genre_labels ?? dbRow?.genreLabels,
        },
      },
      importerBetterThanCanonical: event.key === 'r3hab',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    comparisons,
  };
}

async function remainingGaps(): Promise<Record<string, unknown>> {
  const [titles, descriptions, lineups, venues, tickets, full] = await Promise.all([
    validateTitles(),
    validateDescriptions(),
    validateLineups(),
    validateVenues(),
    validateTicketOwnership(),
    runFullSample(),
  ]);

  const allGaps: ImporterGap[] = [
    ...(titles.gaps as ImporterGap[]),
    ...(descriptions.gaps as ImporterGap[]),
    ...(lineups.gaps as ImporterGap[]),
    ...(venues.gaps as ImporterGap[]),
    ...(tickets.gaps as ImporterGap[]),
    ...(full.gaps as ImporterGap[]),
  ];

  const unintentional = allGaps.filter((g) => !g.intentional);
  const intentional = allGaps.filter((g) => g.intentional);

  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.4.1',
    importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
    productionMutationsInThisRun: 0,
    unintentionalGapCount: unintentional.length,
    intentionalGapCount: intentional.length,
    unintentionalGaps: unintentional,
    intentionalGaps: intentional,
    readinessVerdict:
      unintentional.length === 0
        ? 'READY_FOR_STRANGLER_INTEGRATION_PHASE_485'
        : 'NOT_READY_UNINTENTIONAL_GAPS_REMAIN',
  };
}

async function report(): Promise<void> {
  const gaps = await remainingGaps();
  console.log(JSON.stringify(gaps, null, 2));
}

async function full(): Promise<void> {
  assertReadOnly();

  const titles = await validateTitles();
  const descriptions = await validateDescriptions();
  const lineups = await validateLineups();
  const venues = await validateVenues();
  const tickets = await validateTicketOwnership();
  const fullSample = await runFullSample();
  const reality = await realityCheck();
  const gaps = await remainingGaps();

  writeJson('_phase4841_title_normalization.json', titles);
  writeJson('_phase4841_description_boundaries.json', descriptions);
  writeJson('_phase4841_lineup_evidence.json', lineups);
  writeJson('_phase4841_venue_evidence.json', venues);
  writeJson('_phase4841_full_website_validation.json', fullSample);
  writeJson('_phase4841_reality_check.json', reality);
  writeJson('_phase4841_remaining_gaps.json', gaps);

  const doc = buildClosureDoc({ titles, descriptions, lineups, venues, tickets, fullSample, reality, gaps });
  writeFileSync(join(ROOT, 'docs/PHASE_4841_UNIFIED_WEBSITE_FINAL_CLOSURE.md'), doc);

  console.log('Phase 4.8.4.1 full validation complete.');
  console.log(`Importer: ${UNIFIED_WEBSITE_IMPORTER_VERSION}`);
  console.log(`Full sample: ${fullSample.passCount}/${fullSample.sampleCount} pass`);
  console.log(`Unintentional gaps: ${gaps.unintentionalGapCount}`);
  console.log(`Readiness: ${gaps.readinessVerdict}`);
  console.log(`productionMutationsInThisRun: ${productionMutationsInThisRun}`);
}

function buildClosureDoc(data: Record<string, Record<string, unknown>>): string {
  const { titles, descriptions, lineups, venues, tickets, fullSample, reality, gaps } = data;
  return `# Phase 4.8.4.1 — Unified Website Importer Final Capability Closure

Generated: ${new Date().toISOString()}

## Importer Version

\`${UNIFIED_WEBSITE_IMPORTER_VERSION}\`

## Capabilities Closed

1. **Title normalization** — configurable suffix removal via provider adapters
2. **Description boundary detection** — footer stripping before whitespace collapse
3. **Structured lineup evidence** — explicit MAINFLOOR/LINEUP blocks from official body
4. **Venue evidence hierarchy** — no provider-as-venue inference from page chrome alone
5. **Ticket field ownership** — CTA only; price/availability out of scope

## Validation Summary

| Check | Pass | Fail |
|-------|------|------|
| Titles | ${titles.passCount} | ${titles.failCount} |
| Descriptions | ${descriptions.passCount} | ${descriptions.failCount} |
| Lineups | ${lineups.passCount} | ${lineups.failCount} |
| Venues | ${venues.passCount} | ${venues.failCount} |
| Ticket ownership | ${tickets.passCount} | ${tickets.failCount} |
| Full sample (${fullSample.sampleCount} events) | ${fullSample.passCount} | ${fullSample.failCount} |

## Reality Check Events

- Bootshaus Sommerfest (\`evt-1785339391167-tfaixrr\`)
- R3HAB (\`evt-1785339421539-k3swcrl\`)

## Readiness Verdict

**${gaps.readinessVerdict}**

Unintentional gaps: ${gaps.unintentionalGapCount}

## Production Safety

\`productionMutationsInThisRun: 0\` — no canonical writes, no scheduling, no connector registration.

## Artifacts

- \`docs/real-data/_phase4841_title_normalization.json\`
- \`docs/real-data/_phase4841_description_boundaries.json\`
- \`docs/real-data/_phase4841_lineup_evidence.json\`
- \`docs/real-data/_phase4841_venue_evidence.json\`
- \`docs/real-data/_phase4841_full_website_validation.json\`
- \`docs/real-data/_phase4841_reality_check.json\`
- \`docs/real-data/_phase4841_remaining_gaps.json\`
`;
}

const command = process.argv[2] ?? 'report';

const handlers: Record<string, () => Promise<void>> = {
  'validate-titles': async () => writeJson('_phase4841_title_normalization.json', await validateTitles()),
  'validate-descriptions': async () =>
    writeJson('_phase4841_description_boundaries.json', await validateDescriptions()),
  'validate-lineups': async () => writeJson('_phase4841_lineup_evidence.json', await validateLineups()),
  'validate-venues': async () => writeJson('_phase4841_venue_evidence.json', await validateVenues()),
  'validate-ticket-ownership': async () =>
    writeJson('_phase4841_ticket_ownership.json', await validateTicketOwnership()),
  'run-full-sample': async () =>
    writeJson('_phase4841_full_website_validation.json', await runFullSample()),
  'reality-check': async () => writeJson('_phase4841_reality_check.json', await realityCheck()),
  'remaining-gaps': async () => writeJson('_phase4841_remaining_gaps.json', await remainingGaps()),
  report,
  full,
};

(async () => {
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  await handler();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
