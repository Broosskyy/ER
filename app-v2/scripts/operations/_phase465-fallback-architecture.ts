/**
 * Phase 4.6.5 — Fallback architecture audit, flyer inventory, quality gate report.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase465-fallback-architecture.ts [phase]
 *
 * Phases: audit | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { buildFlyerInventoryEntry } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-enrichment-contract';
import { assessEventBlockers } from '@/features/events/domain/event-data-blocker-classifier';
import {
  isDetailFetchBlocked,
  resolveDetailFetchBlockReason,
} from '@/features/events/domain/blocked-origin-guard';
import {
  FIELD_FALLBACK_CHAINS,
  resolveImportOriginChannel,
} from '@/features/events/domain/field-fallback-priority';
import { getSourceFieldOwnership } from '@/features/events/domain/source-field-ownership-matrix';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { evaluatePublishQualityGate } from '@/features/events/quality/publish-quality-gate';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_MATRIX = join(ROOT, 'docs/real-data/_phase465_fallback_matrix.json');
const OUT_FLYER = join(ROOT, 'docs/real-data/_phase465_flyer_inventory.json');
const OUT_GATE = join(ROOT, 'docs/real-data/_phase465_quality_gate.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_465_FALLBACK_ARCHITECTURE_REPORT.md');

const REPRESENTATIVE_PATTERNS = [
  { label: 'Bootshaus on a Ship', pattern: /bootshaus\s+on\s+a\s+ship/i, kind: 'ticket_io' },
  { label: 'Vision Ekstase', pattern: /vision\s+ekstase/i, kind: 'ticket_io' },
  { label: 'PURE TECHNO', pattern: /pure\s+techno/i, kind: 'ticket_io' },
  { label: 'Blacklist Festival', pattern: /blacklist\s+festival/i, kind: 'ticket_io' },
  { label: 'Sommerfest', pattern: /sommerfest/i, kind: 'ticket_io' },
  { label: 'MDMA', pattern: /\bmdma\b/i, kind: 'ticket_kings' },
  { label: 'LEVI', pattern: /\blevi\b/i, kind: 'ticket_io' },
  { label: 'Website-only sample', pattern: /play!\s+open\s+air/i, kind: 'website' },
];

function readDetailMeta(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  const meta = (payload?.sourceMetadata ?? {}) as Record<string, unknown>;
  return (meta.detailEnrichment ?? {}) as Record<string, unknown>;
}

async function buildRepresentativeMatrix(): Promise<unknown[]> {
  const c = opsClient();
  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));
  const traces: unknown[] = [];

  for (const rep of REPRESENTATIVE_PATTERNS) {
    const event = (events ?? []).find((e) => rep.pattern.test(e.title));
    if (!event) {
      traces.push({ label: rep.label, status: 'not_found' });
      continue;
    }

    const admin = mapEventRowToAdminRecord(event as EventRow);
    const { data: imports } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id')
      .eq('resulting_event_id', event.id);
    const { data: ea } = await c
      .from('event_artists')
      .select('artist_id,sort_order')
      .eq('event_id', event.id)
      .order('sort_order');
    const canonicalArtists = sanitizeLineupArtistNames(
      (ea ?? []).map((r) => artistsById.get(r.artist_id) ?? r.artist_id),
    );

    const importLayers = (imports ?? []).map((imp) => {
      const record = {
        id: imp.id,
        sourceId: imp.source_id,
        normalizedPayload: imp.normalized_payload,
        status: 'imported',
        externalId: imp.external_id,
      } as ImportRecord;
      const candidate = getEffectiveCandidate(record);
      const prioritized = extractPrioritizedArtistNames(record);
      const payload = imp.normalized_payload as Record<string, unknown>;
      const meta = (payload?.sourceMetadata ?? candidate.sourceMetadata ?? {}) as Record<string, unknown>;
      const detail = readDetailMeta(payload);
      const detailBlocked = isDetailFetchBlocked(meta);
      const detailFetched = Number(detail.detailUrlsFetched ?? detail.pagesFetched ?? 0) > 0;
      const originChannel = resolveImportOriginChannel({
        sourceType: imp.source_id.includes('ticket') ? 'ticket_platform' : 'website',
        connectorKey: imp.source_id.includes('bootshaus-koeln') ? 'club_website' : 'ticket_platform',
        platform: String(meta.platform ?? ''),
        detailFetched,
      });

      return {
        sourceId: imp.source_id,
        originChannel,
        detailBlocked,
        detailBlockReason: resolveDetailFetchBlockReason(meta),
        metadata: meta,
        fields: {
          description: candidate.description,
          lineup: prioritized.names,
          genreLabels: candidate.genreNames,
          ticketUrl: candidate.ticketUrl,
          priceText: candidate.priceText,
          imageUrl: candidate.imageUrl,
        },
      };
    });

    const fields = ['description', 'lineup', 'genreLabels', 'ticketUrl', 'priceText', 'imageUrl'] as const;
    const fieldMatrix: Record<string, unknown> = {};

    for (const field of fields) {
      const winning = importLayers.find((layer) => {
        const value = layer.fields[field as keyof typeof layer.fields];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      });
      const blocked = importLayers.filter((layer) => layer.detailBlocked);
      fieldMatrix[field] = {
        canonical:
          field === 'lineup'
            ? canonicalArtists
            : admin[field as keyof typeof admin] ?? null,
        winningSource: winning?.sourceId ?? 'canonical_or_none',
        winningOrigin: winning?.originChannel ?? 'existing_canonical',
        blockedSources: blocked.map((b) => ({
          sourceId: b.sourceId,
          reason: b.detailBlockReason,
        })),
        confidence: winning?.detailBlocked ? 'list_only' : winning ? 'structured' : 'missing',
      };
    }

    const blockerAssessment = assessEventBlockers({
      eventId: event.id,
      title: event.title,
      canonical: {
        description: admin.description,
        lineup: canonicalArtists,
        genreLabels: admin.genreLabels,
        ticketUrl: admin.ticketUrl,
        priceText: admin.priceText,
        imageUrl: admin.imageUrl,
      },
      importLayers: importLayers.map((layer) => ({
        sourceId: layer.sourceId,
        metadata: layer.metadata,
        fields: layer.fields,
      })),
    });

    traces.push({
      label: rep.label,
      eventId: event.id,
      title: event.title,
      fieldMatrix,
      primaryBlocker: blockerAssessment.primaryBlocker,
      gaps: blockerAssessment.gaps,
    });
  }

  return traces;
}

async function buildFlyerInventory(): Promise<unknown[]> {
  const c = opsClient();
  const { data: events } = await c
    .from('events')
    .select('id,title,description,image_url,source_id')
    .eq('status', 'published');
  const inventory: unknown[] = [];

  for (const event of events ?? []) {
    if (!event.image_url) {
      continue;
    }
    const { data: imports } = await c
      .from('import_records')
      .select('source_id,normalized_payload')
      .eq('resulting_event_id', event.id);
    const { data: ea } = await c.from('event_artists').select('artist_id').eq('event_id', event.id);
    const hasLineup = (ea?.length ?? 0) > 0;
    const hasDescription = Boolean(event.description?.trim() && event.description.length > 40);
    if (hasLineup && hasDescription) {
      continue;
    }

    const textualSources: string[] = [];
    let detailBlocked = false;
    for (const imp of imports ?? []) {
      const payload = imp.normalized_payload as Record<string, unknown>;
      const candidate = getEffectiveCandidate({
        normalizedPayload: payload,
        sourceId: imp.source_id,
      } as ImportRecord);
      if (candidate.description?.trim()) {
        textualSources.push(`${imp.source_id}:description`);
      }
      if ((candidate.artistNames?.length ?? 0) > 0) {
        textualSources.push(`${imp.source_id}:lineup`);
      }
      if (isDetailFetchBlocked(payload?.sourceMetadata as Record<string, unknown>)) {
        detailBlocked = true;
      }
    }

    const missingFields = [
      !hasLineup ? 'lineup' : null,
      !hasDescription ? 'description' : null,
    ].filter(Boolean) as string[];

    if (missingFields.length === 0) {
      continue;
    }

    inventory.push(
      buildFlyerInventoryEntry({
        eventId: event.id,
        title: event.title,
        imageUrl: event.image_url,
        imageSource: event.source_id ?? 'unknown',
        missingFields,
        textualSources,
      }),
    );
  }

  return inventory.sort((a, b) => {
    const aFeas = (a as { extractionFeasibility: string }).extractionFeasibility;
    const bFeas = (b as { extractionFeasibility: string }).extractionFeasibility;
    const rank = { high: 0, medium: 1, low: 2, blocked: 3 };
    return (rank[aFeas as keyof typeof rank] ?? 9) - (rank[bFeas as keyof typeof rank] ?? 9);
  });
}

function buildQualityGateSamples(): unknown {
  const samples = [
    evaluatePublishQualityGate({
      field: 'description',
      existingValue: 'Long official website description.',
      incomingValue: '',
      incomingTier: 'ticket_platform',
      existingTier: 'official_organizer',
      isEnrichment: true,
      sourceMetadata: { detailEnrichment: { skippedReason: 'pow_blocked' } },
    }),
    evaluatePublishQualityGate({
      field: 'ticketUrl',
      existingValue: 'https://proton-the-club.ticket.io/hyHJr2xd/',
      incomingValue: 'https://proton-the-club.ticket.io/',
      incomingTier: 'ticket_platform',
      existingTier: 'ticket_platform',
      isEnrichment: true,
    }),
    evaluatePublishQualityGate({
      field: 'genreLabels',
      existingValue: ['Techno', 'Trance'],
      incomingValue: ['Techno'],
      incomingTier: 'ticket_platform',
      existingTier: 'official_organizer',
      isEnrichment: true,
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    rules: [
      'empty_never_overwrites_populated',
      'shorter_description_requires_stronger_evidence',
      'fewer_genres_rejected',
      'worse_ticket_url_rejected',
      'blocked_origin_never_clears',
      'parser_failure_never_clears',
    ],
    samples,
    fieldOwnershipMatrix: FIELD_FALLBACK_CHAINS.map((chain) => ({
      field: chain.field,
      fallbackPriority: chain.priority,
      mergeRule: getSourceFieldOwnership(chain.field)?.mergeRule,
    })),
  };
}

async function runAudit(): Promise<void> {
  const matrix = await buildRepresentativeMatrix();
  const flyerInventory = await buildFlyerInventory();
  const qualityGate = buildQualityGateSamples();

  writeFileSync(OUT_MATRIX, JSON.stringify({ generatedAt: new Date().toISOString(), events: matrix }, null, 2));
  writeFileSync(OUT_FLYER, JSON.stringify({ generatedAt: new Date().toISOString(), inventory: flyerInventory }, null, 2));
  writeFileSync(OUT_GATE, JSON.stringify(qualityGate, null, 2));

  console.log(`Representative events: ${matrix.length}`);
  console.log(`Flyer inventory: ${flyerInventory.length}`);
}

function buildReport(): void {
  const lines = [
    '# Phase 4.6.5 — Detail Fallback Architecture & Flyer Enrichment',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Fallback architecture',
    '',
    'Each canonical field selects the strongest available evidence independently. Blocked Ticket.io detail origins (ALTCHA PoW) cannot clear or downgrade stronger website or list-level data.',
    '',
    'Modules:',
    '- `field-fallback-priority.ts` — per-field origin priority chains',
    '- `blocked-origin-guard.ts` — PoW/detail-block detection and overwrite rejection',
    '- `publish-quality-gate.ts` — pre-publish quality validator',
    '- `flyer-enrichment-contract.ts` — reusable flyer stage contract (inventory only this phase)',
    '- `event-data-blocker-classifier.ts` — exact blocker taxonomy',
    '',
    '## 2. Field priority matrix',
    '',
    'See `docs/real-data/_phase465_fallback_matrix.json` and `FIELD_FALLBACK_CHAINS` in code.',
    '',
    '## 3. Quality gate',
    '',
    'Integrated into `FieldTrustMergeService`. Rejects: empty→populated, shorter description, fewer genres, worse ticket URL, blocked-origin clears.',
    '',
    '## 4. Flyer inventory',
    '',
    'Events with missing lineup/description but official artwork are inventoried in `_phase465_flyer_inventory.json`. No OCR or auto-publish in this phase.',
    '',
    '## 5. Remaining blockers',
    '',
    '- `external_security_limitation` — Ticket.io ALTCHA blocks server-side detail HTML',
    '- `awaiting_flyer_enrichment` — lineup/description likely on artwork only',
    '- `source_has_no_data` — origin never supplied field',
    '',
    '## 6. Next implementation phase',
    '',
    '1. Wire flyer enrichment stage after textual fallback exhaustion (review-gated OCR)',
    '2. Enable `genericSourceFieldTrustMerge` in production after ops validation',
    '3. Persist flyer extraction provenance per event origin',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase465_fallback_matrix.json`',
    '- `docs/real-data/_phase465_flyer_inventory.json`',
    '- `docs/real-data/_phase465_quality_gate.json`',
  ];
  writeFileSync(OUT_REPORT, lines.join('\n'));
  console.log(`Report: ${OUT_REPORT}`);
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';
  if (phase === 'audit' || phase === 'full') {
    await runAudit();
  }
  if (phase === 'report' || phase === 'full') {
    buildReport();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
