/**
 * Phase 4.8.6.5.6 — Bounded production apply.
 *
 * Plan generation (default):
 *   ER_OPS_ENV_FILE=C:\ER\app-v2\.env npx tsx scripts/operations/_phase48656-bounded-apply.ts
 *
 * Apply:
 *   ER_OPS_ENV_FILE=... CONFIRM_PRODUCTION_MUTATION=exact:phase48656-bounded-correction \
 *     npx tsx scripts/operations/_phase48656-bounded-apply.ts --apply
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import './bootstrap-ops-supabase';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient, updateEventRow } from './ops-supabase-rows';
import {
  createApplyWriteCounters,
  productionMutationsInThisRun as countProductionMutations,
  recordAttemptedWrite,
  recordRollbackWrite,
  recordSuccessfulWrite,
  stableHash,
  verifyApprovedManifestHash,
} from './phase48655-restricted-apply-security';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const PLAN_FILE = join(OUT, '_phase48656_bounded_restricted_plan.json');
const ROLLBACK_FILE = join(OUT, '_phase48656_bounded_restricted_rollback.json');
const APPLY_RESULT_FILE = join(OUT, '_phase48656_bounded_apply_result.json');

const APPLY_ENV = 'CONFIRM_PRODUCTION_MUTATION';
const APPLY_TOKEN = 'exact:phase48656-bounded-correction';

let applyWriteCounters = createApplyWriteCounters();

function writeJson(path: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function rowFingerprint(event: AdminEventRecord): string {
  return stableHash({
    id: event.id,
    title: event.title,
    venueName: event.venueName,
    venueId: event.venueId,
    venueAddress: event.venueAddress,
    venuePostalCode: event.venuePostalCode,
    latitude: event.latitude,
    longitude: event.longitude,
    priceText: event.priceText,
    ticketPhases: event.ticketPhases,
    ticketUrl: event.ticketUrl,
    ticketStatus: event.ticketStatus,
  });
}

async function loadEvent(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(`events read failed: ${error.message}`);
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

function patchToDbColumns(patch: Record<string, unknown>): Partial<EventRow> {
  const db: Record<string, unknown> = {};
  if (patch.venueId !== undefined) db.venue_id = patch.venueId;
  if (patch.venueAddress !== undefined) db.venue_address = patch.venueAddress;
  if (patch.venuePostalCode !== undefined) db.venue_postal_code = patch.venuePostalCode;
  if (patch.latitude !== undefined) db.latitude = patch.latitude;
  if (patch.longitude !== undefined) db.longitude = patch.longitude;
  if (patch.priceText !== undefined) db.price_text = patch.priceText;
  if (patch.ticketStatus !== undefined) db.ticket_status = patch.ticketStatus;
  if (patch.ticketPhases !== undefined) db.ticket_phases = patch.ticketPhases;
  return db as Partial<EventRow>;
}

function valuesEquivalent(field: string, expected: unknown, actual: unknown): boolean {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return true;
  if (expected == null && (actual == null || actual === undefined)) return true;
  if (field === 'ticketPhases') {
    const norm = (phases: unknown) =>
      Array.isArray(phases)
        ? phases.map((phase) => {
            const p = phase as Record<string, unknown>;
            return {
              name: p.name,
              priceAmount: p.priceAmount,
              priceCurrency: p.priceCurrency,
              priceLabel: p.priceLabel,
              kind: p.kind,
              sortOrder: p.sortOrder,
              soldOut: p.soldOut,
            };
          })
        : [];
    return JSON.stringify(norm(expected)) === JSON.stringify(norm(actual));
  }
  return false;
}

async function persistElektrokuecheProvenance(
  eventId: string,
  sourceId: string,
  patch: Record<string, unknown>,
  audit: Record<string, unknown>,
  verifiedAt: string,
): Promise<void> {
  const checkoutUrl =
    (audit.checkoutEvidenceUrl as string | undefined) ??
    'https://nacht-manager.de/ticketing/native_event.php?id=41';
  const publicCtaUrl =
    (audit.publicCtaUrl as string | undefined) ??
    'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/';
  const now = verifiedAt;

  const rows = [
    {
      id: `provenance-${eventId}-priceText`,
      canonical_event_id: eventId,
      field_path: 'priceText',
      selected_value: patch.priceText,
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'phase48656_elektrokueche_door_sale_checkout',
      alternatives: [
        {
          sourceId,
          value: patch.priceText,
          freshnessAt: now,
          originExternalId: checkoutUrl,
          mergeDecision: 'mandatory_admission_only',
          publicCtaUrl,
          checkoutEvidenceUrl: checkoutUrl,
          admissionProduct: audit.admissionProduct,
          excludedAddons: audit.excludedAddons,
          priceSource: audit.priceSource,
          identityDecision: audit.identityDecision,
        },
      ],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${eventId}-ticketPhases`,
      canonical_event_id: eventId,
      field_path: 'ticketPhases',
      selected_value: {
        phases: patch.ticketPhases ?? [],
        evidenceSource: 'nacht_manager_checkout',
        consumerCta: publicCtaUrl,
        checkoutUrl,
        verifiedAt: now,
        admissionProduct: audit.admissionProduct,
        excludedAddons: audit.excludedAddons,
        priceSource: audit.priceSource,
        identityDecision: audit.identityDecision,
      },
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'phase48656_elektrokueche_atomic_door_sale_replace',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
  ];

  for (const row of rows) {
    const { error } = await opsClient().from('event_field_provenance').upsert(row, {
      onConflict: 'canonical_event_id,field_path',
    });
    if (error) throw new Error(`provenance_upsert_failed:${error.message}`);
  }
}

async function rollbackEvent(
  snapshot: Record<string, unknown>,
  eventId: string,
): Promise<void> {
  const dbPatch = patchToDbColumns(snapshot);
  if (Object.keys(dbPatch).length > 0) {
    await updateEventRow(eventId, dbPatch);
  }
}

async function runPreflight(plan: Record<string, unknown>, onlyKeys?: string[]): Promise<Record<string, unknown>> {
  execSync('npm run typecheck:operations', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  try {
    execSync('git diff --check', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    throw new Error('git_diff_check_failed');
  }

  const expectedHash = plan.boundedManifestHash as string;
  const hashReport = verifyApprovedManifestHash(plan, expectedHash);
  if (!hashReport.ok) {
    throw new Error(
      `manifest_hash_mismatch:expected=${hashReport.expectedHash}:computed=${hashReport.computedHash}`,
    );
  }

  const events = Array.isArray(plan.events) ? plan.events : [];
  const eventChecks: Record<string, unknown> = {};

  for (const entry of events) {
    const e = entry as Record<string, unknown>;
    const eventId = e.eventId as string;
    const key = e.key as string;
    if (onlyKeys && !onlyKeys.includes(key)) {
      continue;
    }
    const event = await loadEvent(eventId);
    if (!event) {
      eventChecks[key] = { ok: false, reason: 'event_not_found' };
      continue;
    }
    const liveFingerprint = rowFingerprint(event);
    const plannedFingerprint = e.rowFingerprintAtPlanTime as string;
    eventChecks[key] = {
      eventId,
      liveFingerprint,
      plannedFingerprint,
      fingerprintDrift: liveFingerprint !== plannedFingerprint,
      ok: liveFingerprint === plannedFingerprint,
    };
    if (liveFingerprint !== plannedFingerprint) {
      throw new Error(`fingerprint_drift:${key}`);
    }
  }

  return { hashReport, eventChecks };
}

async function executeApply(
  plan: Record<string, unknown>,
  preflight: Record<string, unknown>,
  onlyKeys?: string[],
): Promise<void> {
  const events = Array.isArray(plan.events) ? plan.events : [];
  const appliedEvents: Array<Record<string, unknown>> = [];
  const rolledBackEvents: Array<Record<string, unknown>> = [];

  for (const entry of events) {
    const planEntry = entry as Record<string, unknown>;
    const key = planEntry.key as string;
    if (onlyKeys && !onlyKeys.includes(key)) {
      continue;
    }
    const eventId = planEntry.eventId as string;
    const restrictedPatch = planEntry.restrictedPatch as Record<string, unknown>;
    if (!eventId || Object.keys(restrictedPatch).length === 0) {
      continue;
    }

    const beforeEvent = await loadEvent(eventId);
    if (!beforeEvent) throw new Error(`event_missing:${key}`);

    const rollbackSnapshot = planEntry.rollbackSnapshot as Record<string, unknown>;
    const mutations: Array<Record<string, unknown>> = [];

    try {
      recordAttemptedWrite(applyWriteCounters, false);

      const dbPatch = patchToDbColumns(restrictedPatch);
      for (const [column, newValue] of Object.entries(dbPatch)) {
        const field =
          column === 'venue_id'
            ? 'venueId'
            : column === 'venue_address'
              ? 'venueAddress'
              : column === 'venue_postal_code'
                ? 'venuePostalCode'
                : column === 'price_text'
                  ? 'priceText'
                  : column === 'ticket_status'
                    ? 'ticketStatus'
                    : column === 'ticket_phases'
                      ? 'ticketPhases'
                      : column;
        const previousValue = (beforeEvent as Record<string, unknown>)[field];
        if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
          mutations.push({ field, previousValue, newValue, kind: 'event_field' });
        }
      }

      if (Object.keys(dbPatch).length > 0) {
        await updateEventRow(eventId, dbPatch);
      }

      const afterEvent = await loadEvent(eventId);
      if (!afterEvent) throw new Error('readback_missing');

      for (const mutation of mutations) {
        const field = mutation.field as string;
        if (!valuesEquivalent(field, mutation.newValue, (afterEvent as Record<string, unknown>)[field])) {
          throw new Error(`readback_mismatch:${field}`);
        }
      }

      if (key === 'sommerfest_elektrokueche' && planEntry.ticketProvenanceAudit && beforeEvent.sourceId) {
        await persistElektrokuecheProvenance(
          eventId,
          beforeEvent.sourceId,
          restrictedPatch,
          planEntry.ticketProvenanceAudit as Record<string, unknown>,
          (planEntry.ticketProvenanceAudit as { verifiedAt?: string }).verifiedAt ??
            new Date().toISOString(),
        );
      }

      if (key === 'bc173') {
        if (afterEvent.venueName !== beforeEvent.venueName) {
          throw new Error('bc173_forbidden_venue_name_change');
        }
        if (afterEvent.organizerId !== beforeEvent.organizerId) {
          throw new Error('bc173_forbidden_organizer_change');
        }
      }

      if (key === 'sommerfest_elektrokueche') {
        if (afterEvent.ticketUrl !== beforeEvent.ticketUrl) {
          throw new Error('elektrokueche_forbidden_ticket_url_change');
        }
        if (afterEvent.venueName !== beforeEvent.venueName) {
          throw new Error('elektrokueche_forbidden_venue_change');
        }
      }

      const fieldMutationCount = mutations.length;
      recordSuccessfulWrite(applyWriteCounters, fieldMutationCount, 0);

      appliedEvents.push({
        key,
        eventId,
        mutations,
        after: {
          venueId: afterEvent.venueId,
          venueName: afterEvent.venueName,
          venueAddress: afterEvent.venueAddress,
          venuePostalCode: afterEvent.venuePostalCode,
          latitude: afterEvent.latitude,
          longitude: afterEvent.longitude,
          organizerId: afterEvent.organizerId,
          priceText: afterEvent.priceText,
          ticketPhases: afterEvent.ticketPhases,
          ticketStatus: afterEvent.ticketStatus,
          ticketUrl: afterEvent.ticketUrl,
        },
      });
    } catch (error) {
      await rollbackEvent(rollbackSnapshot, eventId);
      recordRollbackWrite(applyWriteCounters, mutations.length);
      rolledBackEvents.push({
        key,
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const productionMutationsInThisRun = countProductionMutations(applyWriteCounters);

  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  await invalidateConsumerEventCaches(registry.eventRepository);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.6',
    boundedManifestHash: plan.boundedManifestHash,
    committedCodeSha: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    preflight,
    appliedEvents,
    rolledBackEvents,
    writeCounters: applyWriteCounters,
    productionMutationsInThisRun,
    rollbackAvailable: existsSync(ROLLBACK_FILE),
  };

  writeJson(APPLY_RESULT_FILE, result);
  console.log(JSON.stringify(result, null, 2));
  if (rolledBackEvents.length > 0) {
    process.exitCode = 1;
  }
}

async function run(): Promise<void> {
  applyWriteCounters = createApplyWriteCounters();
  const applyRequested = process.argv.includes('--apply');

  if (!applyRequested) {
    const { spawnSync } = await import('node:child_process');
    const planGen = spawnSync(
      'npx',
      ['tsx', 'scripts/operations/_phase48656-final-bounded-core.ts'],
      { cwd: ROOT, encoding: 'utf8', env: process.env, shell: true },
    );
    if (planGen.status !== 0) {
      console.error(planGen.stderr || planGen.stdout);
      process.exit(1);
    }
    console.log(planGen.stdout);
    return;
  }

  if (process.env[APPLY_ENV] !== APPLY_TOKEN) {
    throw new Error(`${APPLY_ENV} must equal ${APPLY_TOKEN}`);
  }

  if (!existsSync(PLAN_FILE)) {
    throw new Error(`missing_plan:${PLAN_FILE}`);
  }

  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8')) as Record<string, unknown>;
  const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
  const onlyKeys = onlyArg ? onlyArg.slice('--only='.length).split(',').map((k) => k.trim()) : undefined;
  const preflight = await runPreflight(plan, onlyKeys);
  await executeApply(plan, preflight, onlyKeys);
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
