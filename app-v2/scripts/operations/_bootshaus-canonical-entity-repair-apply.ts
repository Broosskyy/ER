/**
 * Apply Sprint 26.8 P0 Bootshaus canonical entity repair via service role.
 * Mirrors supabase/migrations/20260758000000_sprint268_bootshaus_canonical_entity_repair.sql
 */
import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_bootshaus-canonical-entity-repair-apply.ts');

import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS_SOURCE_ID = 'source-bootshaus-koeln';
const PRODUCTION_VENUE_ID = 'venue-bootshaus-koeln';
const STAGING_CITY_ID = 'staging-seed-city-koeln';
const STAGING_VENUE_ID = 'staging-seed-venue-bootshaus';

async function assertPreconditions(): Promise<void> {
  const client = getSupabaseServiceClient();

  const { data: city } = await client
    .from('cities')
    .select('id')
    .eq('id', STAGING_CITY_ID)
    .maybeSingle();
  if (!city) throw new Error(`STOP: ${STAGING_CITY_ID} missing`);

  const { data: stagingVenue } = await client
    .from('venues')
    .select('id')
    .eq('id', STAGING_VENUE_ID)
    .maybeSingle();
  if (!stagingVenue) throw new Error(`STOP: ${STAGING_VENUE_ID} missing`);

  const { data: organizer } = await client
    .from('organizers')
    .select('id')
    .eq('id', 'organizer-bootshaus')
    .maybeSingle();
  if (!organizer) throw new Error('STOP: organizer-bootshaus missing');

  const { data: prodVenue } = await client
    .from('venues')
    .select('id')
    .eq('id', PRODUCTION_VENUE_ID)
    .maybeSingle();
  if (prodVenue) throw new Error(`STOP: ${PRODUCTION_VENUE_ID} already exists`);

  const { data: prodSlug } = await client
    .from('venues')
    .select('id')
    .eq('slug', 'bootshaus-koeln')
    .maybeSingle();
  if (prodSlug) throw new Error('STOP: slug bootshaus-koeln already exists');

  const { data: source } = await client
    .from('sources')
    .select('source_config')
    .eq('id', BOOTSHAUS_SOURCE_ID)
    .maybeSingle();
  if (!source) throw new Error(`STOP: ${BOOTSHAUS_SOURCE_ID} missing`);

  const defaults = (source.source_config as { defaults?: Record<string, string> } | null)?.defaults;
  if (defaults?.venueId !== STAGING_VENUE_ID) {
    throw new Error(
      `STOP: source defaults.venueId expected ${STAGING_VENUE_ID}, got ${defaults?.venueId ?? 'null'}`,
    );
  }
}

async function applyRepair(): Promise<void> {
  const client = getSupabaseServiceClient();

  const { data: stagingVenue } = await client
    .from('venues')
    .select('latitude, longitude')
    .eq('id', STAGING_VENUE_ID)
    .maybeSingle();

  const { data: existingProd } = await client
    .from('venues')
    .select('id')
    .or(`id.eq.${PRODUCTION_VENUE_ID},slug.eq.bootshaus-koeln`)
    .maybeSingle();

  if (!existingProd) {
    const { error: insertError } = await client.from('venues').insert({
      id: PRODUCTION_VENUE_ID,
      name: 'Bootshaus',
      slug: 'bootshaus-koeln',
      address: 'Auenweg 173, 51063 Köln',
      street: 'Auenweg 173',
      postal_code: '51063',
      city_id: STAGING_CITY_ID,
      city: 'Köln',
      country: 'Germany',
      latitude: stagingVenue?.latitude ?? null,
      longitude: stagingVenue?.longitude ?? null,
      website: 'https://bootshaus.tv',
      venue_type: 'club',
    });
    if (insertError) throw new Error(`Venue insert failed: ${insertError.message}`);
    console.log(`✅ Inserted ${PRODUCTION_VENUE_ID}`);
  } else {
    console.log(`ℹ️  ${PRODUCTION_VENUE_ID} already present — skip insert`);
  }

  const { data: source } = await client
    .from('sources')
    .select('source_config')
    .eq('id', BOOTSHAUS_SOURCE_ID)
    .single();

  const sourceConfig = (source.source_config ?? {}) as Record<string, unknown>;
  const defaults = {
    ...((sourceConfig.defaults as Record<string, unknown> | undefined) ?? {}),
    venueId: PRODUCTION_VENUE_ID,
    venueName: 'Bootshaus',
  };

  const { error: updateError } = await client
    .from('sources')
    .update({
      source_config: { ...sourceConfig, defaults },
      updated_at: new Date().toISOString(),
    })
    .eq('id', BOOTSHAUS_SOURCE_ID);

  if (updateError) throw new Error(`Source update failed: ${updateError.message}`);
  console.log(`✅ Updated ${BOOTSHAUS_SOURCE_ID} defaults.venueId → ${PRODUCTION_VENUE_ID}`);
}

async function verify(): Promise<void> {
  const client = getSupabaseServiceClient();

  const { count: prodCount } = await client
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .eq('id', PRODUCTION_VENUE_ID);
  if (prodCount !== 1) throw new Error(`Verify failed: production venue count = ${prodCount}`);

  const { count: slugCount } = await client
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .eq('slug', 'bootshaus-koeln');
  if (slugCount !== 1) throw new Error(`Verify failed: bootshaus-koeln slug count = ${slugCount}`);

  const { count: stagingCount } = await client
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .eq('id', STAGING_VENUE_ID);
  if (stagingCount !== 1) throw new Error(`Verify failed: staging venue missing`);

  const { data: source } = await client
    .from('sources')
    .select('source_config')
    .eq('id', BOOTSHAUS_SOURCE_ID)
    .single();

  const venueId = (source.source_config as { defaults?: { venueId?: string } })?.defaults?.venueId;
  if (venueId !== PRODUCTION_VENUE_ID) {
    throw new Error(`Verify failed: defaults.venueId = ${venueId ?? 'null'}`);
  }

  console.log('✅ Post-repair verification passed');
}

async function main(): Promise<void> {
  console.log('==> Phase 1: Preconditions');
  await assertPreconditions();
  console.log('✅ Preconditions OK');

  console.log('==> Phase 2-4: Apply canonical entity repair');
  await applyRepair();

  console.log('==> Phase 5: Verification');
  await verify();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${message}`);
  process.exit(1);
});
