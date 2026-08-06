/**
 * Apply Sprint 26.9.1 production closure data repair (service role).
 * Mirrors supabase/migrations/20260759000000_sprint2691_production_closure.sql
 */
import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_bootshaus-production-closure-apply.ts');

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS = 'source-bootshaus-koeln';
const CANONICAL_VENUE = 'venue-bootshaus-koeln';
const STAGING_VENUE = 'staging-seed-venue-bootshaus';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_production_closure.json');

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();
  const capturedAt = new Date().toISOString();

  const { data: existingAlias } = await client
    .from('entity_identity_aliases')
    .select('id, canonical_id')
    .eq('entity_type', 'venue')
    .eq('alias_type', 'normalized_name')
    .eq('alias_value', 'bootshaus')
    .maybeSingle();

  if (!existingAlias) {
    const { error } = await client.from('entity_identity_aliases').insert({
      id: 'alias-venue-bootshaus-normalized-name',
      entity_type: 'venue',
      canonical_id: CANONICAL_VENUE,
      alias_type: 'normalized_name',
      alias_value: 'bootshaus',
      source_id: null,
      created_by: 'sprint2691-ops',
      metadata: {
        reason: 'canonical_venue_repair',
        replaces: STAGING_VENUE,
      },
    });
    if (error) throw new Error(`Alias insert failed: ${error.message}`);
  } else if (existingAlias.canonical_id !== CANONICAL_VENUE) {
    const { error } = await client
      .from('entity_identity_aliases')
      .update({
        canonical_id: CANONICAL_VENUE,
        metadata: {
          reason: 'canonical_venue_repair',
          updatedBy: 'sprint2691-ops',
        },
        updated_at: capturedAt,
      })
      .eq('id', existingAlias.id);
    if (error) throw new Error(`Alias update failed: ${error.message}`);
  }

  const { count: eventsBefore } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS)
    .eq('venue_id', STAGING_VENUE);

  const { error: eventsError } = await client
    .from('events')
    .update({ venue_id: CANONICAL_VENUE, updated_at: capturedAt })
    .eq('source_id', BOOTSHAUS)
    .eq('venue_id', STAGING_VENUE);
  if (eventsError) throw new Error(`Events venue repair failed: ${eventsError.message}`);

  const { error: recordsError } = await client
    .from('import_records')
    .update({ matched_venue_id: CANONICAL_VENUE, updated_at: capturedAt })
    .eq('source_id', BOOTSHAUS)
    .eq('matched_venue_id', STAGING_VENUE);
  if (recordsError) throw new Error(`Import records venue repair failed: ${recordsError.message}`);

  const { count: canonicalCount } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS)
    .eq('status', 'published')
    .eq('venue_id', CANONICAL_VENUE);

  const report = {
    capturedAt,
    phase: 'venue_repair_applied',
    eventsRepairedFromStaging: eventsBefore ?? 0,
    publishedOnCanonicalVenue: canonicalCount ?? 0,
  };

  const existing = JSON.parse(
    await import('node:fs').then((fs) =>
      fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '{}',
    ),
  );
  writeFileSync(OUT, JSON.stringify({ ...existing, venueRepair: report }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
