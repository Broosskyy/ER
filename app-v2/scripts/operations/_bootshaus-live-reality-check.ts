/**
 * Bootshaus live reality check — read-only IST state.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/real-data/_bootshaus_live_reality_check.json');
const BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';

async function main() {
  const client = getSupabaseServiceClient();

  const { data: venuesByName } = await client
    .from('venues')
    .select('id, slug, name, city, city_id, website, venue_type, address, country')
    .ilike('name', '%bootshaus%');

  const { data: venuesBySlug } = await client
    .from('venues')
    .select('id, slug, name, city, city_id, website, venue_type, address, country')
    .ilike('slug', '%bootshaus%');

  const { data: venuesByWebsite } = await client
    .from('venues')
    .select('id, slug, name, city, city_id, website, venue_type, address, country')
    .ilike('website', '%bootshaus.tv%');

  const { data: venuesByAddress } = await client
    .from('venues')
    .select('id, slug, name, city, city_id, website, venue_type, address, country')
    .ilike('address', '%Auenweg%');

  const venueMap = new Map<string, Record<string, unknown>>();
  for (const row of [...(venuesByName ?? []), ...(venuesBySlug ?? []), ...(venuesByWebsite ?? []), ...(venuesByAddress ?? [])]) {
    venueMap.set(String(row.id), row);
  }
  const allVenues = [...venueMap.values()];

  const { data: organizersByName } = await client
    .from('organizers')
    .select('id, slug, name, city, country, website')
    .ilike('name', '%bootshaus%');

  const { data: organizersBySlug } = await client
    .from('organizers')
    .select('id, slug, name, city, country, website')
    .ilike('slug', '%bootshaus%');

  const { data: organizersByWebsite } = await client
    .from('organizers')
    .select('id, slug, name, city, country, website')
    .ilike('website', '%bootshaus.tv%');

  const organizerMap = new Map<string, Record<string, unknown>>();
  for (const row of [...(organizersByName ?? []), ...(organizersBySlug ?? []), ...(organizersByWebsite ?? [])]) {
    organizerMap.set(String(row.id), row);
  }
  const allOrganizers = [...organizerMap.values()];

  const { data: koelnCities } = await client
    .from('cities')
    .select('id, slug, name, country, active')
    .or('slug.eq.koeln,slug.eq.koln,slug.eq.cologne,id.eq.koeln')
    .limit(20);

  const { data: koelnByName } = await client
    .from('cities')
    .select('id, slug, name, country, active')
    .ilike('name', '%köln%');

  const cityMap = new Map<string, Record<string, unknown>>();
  for (const row of [...(koelnCities ?? []), ...(koelnByName ?? [])]) {
    cityMap.set(String(row.id), row);
  }
  const allCities = [...cityMap.values()];

  const { data: bootshausSource } = await client
    .from('sources')
    .select(
      'id, publish_mode, review_required, schedule_enabled, schedule_policy, schedule_interval_preset, schedule_timezone, next_scheduled_at, polling_interval_minutes, source_config',
    )
    .eq('id', BOOTSHAUS_SOURCE)
    .maybeSingle();

  const { data: reviewRows } = await client
    .from('import_review_queue')
    .select('id, external_event_id, status, import_record_id')
    .eq('source_id', BOOTSHAUS_SOURCE);

  const reviewExternalIds = (reviewRows ?? []).map((row) => row.external_event_id);
  const uniqueReviewIds = new Set(reviewExternalIds);

  const { data: importRows } = await client
    .from('import_records')
    .select('id, external_id, import_job_id, status')
    .eq('source_id', BOOTSHAUS_SOURCE);

  const importExternalIds = (importRows ?? []).map((row) => row.external_id);
  const uniqueImportIds = new Set(importExternalIds);

  const verificationStyleVenues = allVenues.filter((venue) => {
    const id = String(venue.id ?? '');
    const slug = String(venue.slug ?? '').toLowerCase();
    const name = String(venue.name ?? '').toLowerCase();
    const city = String(venue.city ?? '').toLowerCase();
    const website = String(venue.website ?? '').replace(/\/+$/, '').toLowerCase();
    return (
      id === 'venue-bootshaus-koeln' ||
      slug === 'bootshaus-koeln' ||
      (name === 'bootshaus' && ['köln', 'koeln', 'cologne'].includes(city)) ||
      website === 'https://bootshaus.tv'
    );
  });

  const report = {
    capturedAt: new Date().toISOString(),
    target: process.env.EXPO_PUBLIC_SUPABASE_URL ?? null,
    venues: {
      byName: venuesByName ?? [],
      bySlug: venuesBySlug ?? [],
      byWebsite: venuesByWebsite ?? [],
      byAddress: venuesByAddress ?? [],
      union: allVenues,
      verificationScriptStyleMatches: verificationStyleVenues,
      counts: {
        union: allVenues.length,
        verificationStyle: verificationStyleVenues.length,
        hasVenueBootshausKoeln: allVenues.some((v) => v.id === 'venue-bootshaus-koeln'),
        hasSlugBootshausKoeln: allVenues.some((v) => v.slug === 'bootshaus-koeln'),
        hasStagingSeedVenue: allVenues.some((v) => v.id === 'staging-seed-venue-bootshaus'),
      },
    },
    organizers: {
      union: allOrganizers,
      counts: {
        union: allOrganizers.length,
        hasOrganizerBootshaus: allOrganizers.some((o) => o.id === 'organizer-bootshaus'),
      },
    },
    cities: {
      union: allCities,
      counts: {
        union: allCities.length,
        hasIdKoeln: allCities.some((c) => c.id === 'koeln'),
        hasStagingSeedCity: allCities.some((c) => c.id === 'staging-seed-city-koeln'),
      },
    },
    bootshausSource: bootshausSource
      ? {
          id: bootshausSource.id,
          publish_mode: bootshausSource.publish_mode,
          review_required: bootshausSource.review_required,
          schedule: {
            schedule_enabled: bootshausSource.schedule_enabled,
            schedule_policy: bootshausSource.schedule_policy,
            schedule_interval_preset: bootshausSource.schedule_interval_preset,
            schedule_timezone: bootshausSource.schedule_timezone,
            next_scheduled_at: bootshausSource.next_scheduled_at,
            polling_interval_minutes: bootshausSource.polling_interval_minutes,
          },
          source_config_defaults: bootshausSource.source_config?.defaults ?? null,
          source_config_website_venueSelector:
            bootshausSource.source_config?.website?.htmlSelector?.venueSelector ?? null,
        }
      : null,
    reviewQueue: {
      total: reviewRows?.length ?? 0,
      uniqueExternalEventIds: uniqueReviewIds.size,
      duplicateSurplus: (reviewRows?.length ?? 0) - uniqueReviewIds.size,
      statusBreakdown: (reviewRows ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {}),
    },
    importRecords: {
      total: importRows?.length ?? 0,
      uniqueExternalIds: uniqueImportIds.size,
      duplicateSurplus: (importRows?.length ?? 0) - uniqueImportIds.size,
      statusBreakdown: (importRows ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {}),
    },
    uniqueConstraints: {
      note: 'Requires direct Postgres (SUPABASE_DB_URL not configured). Cannot query pg_indexes via PostgREST.',
      provable: false,
    },
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
