/**
 * Phase 4.6.4 — Lineup completion preflight (READ-ONLY).
 *
 * Usage: npx tsx scripts/operations/_phase464-lineup-completion.ts
 *
 * Writes deliverable JSON + report. No production mutations.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  enrichFlyerLineup,
  pickHighestResolutionOfficialImage,
} from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';
import { resolveLineupRootCause } from '@/features/aggregation/domain/lineup-root-cause';
import {
  isLineupPlaceholderArtist,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_ROOT_CAUSES = join(ROOT, 'docs/real-data/_phase464_lineup_root_causes.json');
const OUT_PREFLIGHT = join(ROOT, 'docs/real-data/_phase464_lineup_preflight.json');
const OUT_AFTER = join(ROOT, 'docs/real-data/_phase464_lineup_after.json');
const OUT_FLYER = join(ROOT, 'docs/real-data/_phase464_flyer_extraction_review.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_464_LINEUP_COMPLETION_REPORT.md');

const REPRESENTATIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest\s+elektroküche/i },
  { label: 'MDMA', pattern: /\bmdma\b.*musik die mich antreibt/i },
  { label: 'Bootshaus on a Ship Vol. III', pattern: /bootshaus\s+on\s+a\s+ship/i },
  { label: 'Vision Ekstase Open Air', pattern: /vision\s+ekstase/i },
  { label: '100% SCHRANZ', pattern: /100%\s*schr?anz/i },
  { label: 'Blacklist Festival 2026', pattern: /blacklist\s+festival/i },
  { label: 'PURE TECHNO', pattern: /pure\s+techno/i },
  { label: 'Lehmann Event', pattern: /lehmann/i },
  { label: 'Single-DJ title inferred', pattern: /techno\s+dampfer.*w\//i },
  { label: 'Flyer-only candidate', pattern: /blacklist|pure\s+techno|bootshaus\s+on\s+a\s+ship/i },
  { label: 'Truly unavailable', pattern: /gestört aber geil/i },
];

function toImportRecord(row: {
  id: string;
  source_id: string;
  normalized_payload: unknown;
  external_id?: string;
}): ImportRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    normalizedPayload: row.normalized_payload,
    status: 'imported',
    externalId: row.external_id,
  } as ImportRecord;
}

function readImportTrace(row: {
  id: string;
  source_id: string;
  normalized_payload: unknown;
  external_id?: string;
}) {
  const record = toImportRecord(row);
  const prioritized = extractPrioritizedArtistNames(record);
  const payload = row.normalized_payload as Record<string, unknown> | null;
  const candidate = getEffectiveCandidate(record);
  const metadata = (payload?.sourceMetadata ?? candidate.sourceMetadata ?? {}) as Record<string, unknown>;
  const detail = (metadata.detailEnrichment ?? metadata.detailSnapshot ?? {}) as Record<string, unknown>;
  return {
    importRecordId: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    artistNames: prioritized.names,
    lineupEntryCount: Array.isArray(metadata.lineupEntries)
      ? (metadata.lineupEntries as unknown[]).length
      : 0,
    prioritizedNames: prioritized.names,
    prioritizedSource: prioritized.source,
    detailPagesFetched:
      typeof detail.pagesFetched === 'number'
        ? detail.pagesFetched
        : typeof (metadata.detailEnrichment as Record<string, unknown> | undefined)?.pagesFetched ===
            'number'
          ? Number((metadata.detailEnrichment as Record<string, unknown>).pagesFetched)
          : undefined,
    detailBlockedByPow: detail.blockedByPow === true,
    detailUrl:
      typeof metadata.eventUrl === 'string'
        ? metadata.eventUrl
        : typeof row.external_id === 'string' && row.external_id.startsWith('http')
          ? row.external_id
          : undefined,
    imageUrl: candidate.imageUrl,
    posterMetadata: metadata.posterMetadata as { status?: string; artistNames?: string[]; rawText?: string },
  };
}

async function main(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const { data: allArtists } = await c.from('artists').select('id,name');
  const artistsById = new Map((allArtists ?? []).map((a) => [a.id, a] as const));

  const rootCauseRows: unknown[] = [];
  const flyerReviews: unknown[] = [];
  const representativeTraces: unknown[] = [];

  const metrics = {
    publishedTotal: 0,
    complete: 0,
    partial: 0,
    titleInferredOnly: 0,
    singleArtistComplete: 0,
    missing: 0,
    invalid: 0,
    unavailable: 0,
    detailFetchRequired: 0,
    flyerCandidates: 0,
    highConfidenceFlyer: 0,
    reviewRequiredFlyer: 0,
    parserOrMergeUnknown: 0,
  };

  const stageCounts: Record<string, number> = {};
  const rootCauseClassCounts: Record<string, number> = {};

  for (const event of events ?? []) {
    metrics.publishedTotal += 1;
    const { data: eventArtists } = await c
      .from('event_artists')
      .select('artist_id,sort_order')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true });
    const { data: imports } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id,updated_at')
      .eq('resulting_event_id', event.id)
      .order('updated_at', { ascending: false });
    const { data: refs } = await c
      .from('event_source_references')
      .select('source_id,metadata')
      .eq('canonical_event_id', event.id)
      .eq('active', true);

    const canonicalArtistNames = (eventArtists ?? []).map(
      (r) => artistsById.get(r.artist_id)?.name ?? r.artist_id,
    );
    const invalidCanonicalNames = canonicalArtistNames.filter((n) => isLineupPlaceholderArtist(n));
    const validCanonicalCount = canonicalArtistNames.filter(
      (n) => !isLineupPlaceholderArtist(n),
    ).length;
    const importTraces = (imports ?? []).map(readImportTrace);

    const resolved = resolveLineupRootCause({
      eventId: event.id,
      title: event.title,
      description: event.description ?? undefined,
      validCanonicalCount,
      invalidCanonicalNames,
      canonicalArtistNames: sanitizeLineupArtistNames(canonicalArtistNames) ?? [],
      importTraces,
      imageUrl: event.image_url ?? undefined,
      flyerUrl: event.flyer_url ?? undefined,
    });

    if (resolved.rootCauseClass === 'parser_or_merge_unknown') {
      metrics.parserOrMergeUnknown += 1;
    }
    if (resolved.firstFailureStage) {
      const key = String(resolved.firstFailureStage);
      stageCounts[key] = (stageCounts[key] ?? 0) + 1;
    }
    rootCauseClassCounts[resolved.rootCauseClass] =
      (rootCauseClassCounts[resolved.rootCauseClass] ?? 0) + 1;

    switch (resolved.completenessState) {
      case 'complete':
        metrics.complete += 1;
        if (validCanonicalCount === 1) metrics.singleArtistComplete += 1;
        break;
      case 'partial':
        metrics.partial += 1;
        break;
      case 'title_inferred_only':
        metrics.titleInferredOnly += 1;
        metrics.partial += 1;
        break;
      case 'flyer_extracted_review_required':
        metrics.partial += 1;
        break;
      case 'blocked_detail_fetch':
        metrics.missing += 1;
        break;
      case 'unavailable':
        metrics.unavailable += 1;
        break;
      default:
        break;
    }
    if (resolved.classification === 'missing') metrics.missing += 1;
    if (resolved.classification === 'invalid') metrics.invalid += 1;
    if (resolved.requiresReimport && resolved.firstFailureStage === 3) {
      metrics.detailFetchRequired += 1;
    }

    const heroImage = pickHighestResolutionOfficialImage([
      event.flyer_url,
      event.image_url,
      ...importTraces.map((t) => t.imageUrl),
    ]);
    const posterRawText =
      importTraces.find((t) => t.posterMetadata?.rawText)?.posterMetadata?.rawText ??
      importTraces.find((t) => t.posterMetadata?.artistNames?.length)?.posterMetadata?.artistNames?.join('\n');
    const flyerExtraction = heroImage
      ? enrichFlyerLineup({
          imageUrl: heroImage,
          rawText: posterRawText,
          eventTitle: event.title,
          venueName: event.venue,
          cityName: event.city,
          knownCanonicalNames: canonicalArtistNames,
          corroboratingTextNames: importTraces.flatMap((t) => t.prioritizedNames),
        })
      : undefined;

    if (flyerExtraction) {
      metrics.flyerCandidates += flyerExtraction.candidates.length;
      metrics.highConfidenceFlyer += flyerExtraction.autoPublishCandidates.length;
      metrics.reviewRequiredFlyer += flyerExtraction.reviewCandidates.length;
      if (flyerExtraction.reviewCandidates.length > 0 || flyerExtraction.autoPublishCandidates.length > 0) {
        flyerReviews.push({
          eventId: event.id,
          title: event.title,
          imageUrl: heroImage,
          extraction: flyerExtraction,
        });
      }
    }

    rootCauseRows.push({
      eventId: event.id,
      title: event.title,
      origins: [...new Set((refs ?? []).map((r) => r.source_id))],
      firstFailureStage: resolved.firstFailureStage,
      rootCauseClass: resolved.rootCauseClass,
      genericFixClass: resolved.genericFixClass,
      completenessState: resolved.completenessState,
      classification: resolved.classification,
      failureEvidence: resolved.failureEvidence,
      canonicalArtistCount: validCanonicalCount,
      importArtistCount: resolved.bestImportNameCount,
      artistProvenance: resolved.artistProvenance,
      requiresReimport: resolved.requiresReimport,
      requiresManualReview: resolved.requiresManualReview,
      heroImage,
      flyerExtractionStatus: flyerExtraction?.status,
    });

    const rep = REPRESENTATIVE_PATTERNS.find((p) => p.pattern.test(event.title));
    if (rep) {
      representativeTraces.push({
        label: rep.label,
        eventId: event.id,
        title: event.title,
        textualEvidence: importTraces.map((t) => ({
          sourceId: t.sourceId,
          names: t.prioritizedNames,
          source: t.prioritizedSource,
          detailFetched: t.detailPagesFetched ?? 0,
        })),
        imageEvidence: heroImage,
        flyerCandidates: flyerExtraction?.candidates ?? [],
        canonicalResult: sanitizeLineupArtistNames(canonicalArtistNames),
        completenessState: resolved.completenessState,
        artistCount: validCanonicalCount,
        unresolvedReview: resolved.requiresManualReview,
      });
    }
  }

  const preflight = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    metrics,
    stageCounts,
    rootCauseClassCounts,
    parserOrMergeUnknown: metrics.parserOrMergeUnknown,
    affectedSources: [
      ...new Set(
        rootCauseRows
          .filter((r) => (r as { requiresReimport: boolean }).requiresReimport)
          .flatMap((r) => (r as { origins: string[] }).origins),
      ),
    ],
    duplicateRisk: 'low — union dedupes by normalized name',
    artistEntityCreationRisk: 'medium for flyer review queue only; auto-publish requires >=0.9 confidence',
    expectedRelationshipChanges: rootCauseRows.filter(
      (r) => (r as { requiresReimport: boolean }).requiresReimport,
    ).length,
  };

  const afterSnapshot = {
    generatedAt: new Date().toISOString(),
    note: 'Preflight baseline — production re-import not executed per phase scope',
    metrics,
    stageCounts,
    rootCauseClassCounts,
    parserOrMergeUnknown: metrics.parserOrMergeUnknown,
  };

  writeFileSync(
    OUT_ROOT_CAUSES,
    JSON.stringify({ generatedAt: new Date().toISOString(), events: rootCauseRows }, null, 2),
  );
  writeFileSync(OUT_PREFLIGHT, JSON.stringify(preflight, null, 2));
  writeFileSync(OUT_AFTER, JSON.stringify(afterSnapshot, null, 2));
  writeFileSync(
    OUT_FLYER,
    JSON.stringify({ generatedAt: new Date().toISOString(), reviews: flyerReviews }, null, 2),
  );

  const report = `# Phase 4.6.4 — Lineup Completion Report

Generated: ${new Date().toISOString()}

## Status

- **parser_or_merge_unknown:** ${metrics.parserOrMergeUnknown} (target: 0)
- **Published events:** ${metrics.publishedTotal}
- **Read-only preflight:** yes — no production writes in this run

## Before metrics (preflight baseline)

| Metric | Count |
|--------|------:|
| Complete lineups | ${metrics.complete} |
| Partial lineups | ${metrics.partial} |
| Title-inferred only | ${metrics.titleInferredOnly} |
| Legitimate single-artist complete | ${metrics.singleArtistComplete} |
| Missing | ${metrics.missing} |
| Invalid | ${metrics.invalid} |
| Unavailable | ${metrics.unavailable} |
| Detail fetch required | ${metrics.detailFetchRequired} |
| Flyer candidates | ${metrics.flyerCandidates} |
| High-confidence flyer | ${metrics.highConfidenceFlyer} |
| Review-required flyer | ${metrics.reviewRequiredFlyer} |

## Root-cause stage distribution

${Object.entries(stageCounts)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([stage, count]) => `- Stage ${stage}: ${count}`)
  .join('\n')}

## Root-cause class distribution

${Object.entries(rootCauseClassCounts)
  .sort(([, a], [, b]) => b - a)
  .map(([cls, count]) => `- \`${cls}\`: ${count}`)
  .join('\n')}

## Single-artist policy

- One explicit structured artist → **complete**, neutral presentation (no false Headliner)
- Title-inferred single artist → **title_inferred_only**, partial; detail fetch recommended when URL exists
- No artificial padding or second-artist invention

## Flyer extraction architecture

- Controlled fallback stage after structured/text sources
- Engine: \`phase464-flyer-lineup-v1\`
- Auto-publish only at confidence ≥ 0.9 (canonical/alias match)
- Medium confidence → Admin review queue
- Low confidence → evidence only, never published
- Unchanged image hash → skipped (idempotent)

## Controlled re-import

**Not executed** — awaiting approval after unknown-case closure and flyer strategy review.

Pass 1/2 protocol documented in phase spec; run via \`_phase464-global-lineup-integrity.ts full\` after approval.

## Representative regression traces

See \`docs/real-data/_phase464_lineup_root_causes.json\` and representative section in preflight artifacts.

## Recommendation — next data field

After lineup closure: **ticket phases / floor timetable** — same provenance pattern as lineup (detail fetch + structured extraction + review queue).

## Artifacts

- \`docs/real-data/_phase464_lineup_root_causes.json\`
- \`docs/real-data/_phase464_lineup_preflight.json\`
- \`docs/real-data/_phase464_lineup_after.json\`
- \`docs/real-data/_phase464_flyer_extraction_review.json\`
`;

  writeFileSync(OUT_REPORT, report);
  console.log(JSON.stringify({ preflight, parserOrMergeUnknown: metrics.parserOrMergeUnknown }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
