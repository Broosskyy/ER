import './bootstrap-ops-supabase';

import { inferLineupCompleteness } from '@/features/event-detail/utils/lineup-completeness';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { eventRepository } from '@/data/repositories/registry';
import type { EventArtistLineupRow } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

const SAMPLE_TITLES = [
  'DNB CONNECTION pres. SHOCKONE',
  'FATALITY pres. DEXPHASE',
  'TECHNO DAMPFER Köln w/ Saltysis',
  'WESTBAM - SAVE THE RAVE 2027',
];

async function main(): Promise<void> {
  await eventRepository.refresh();
  const events = eventRepository.getPublishedEvents();
  const client = opsClient();

  const samples = [];
  for (const needle of SAMPLE_TITLES) {
    const firstToken = needle.split(' ')[0] ?? needle;
    const lastToken = needle.split(' ').at(-1) ?? needle;
    const event = events.find((row) => row.title.includes(firstToken) && row.title.includes(lastToken));
    if (!event) {
      samples.push({ needle, found: false });
      continue;
    }

    const { data: lineupData } = await client
      .from('event_artists')
      .select('artist_id, artists(name)')
      .eq('event_id', event.id);

    const lineupRows = (lineupData ?? []) as EventArtistLineupRow[];
    const repoEvent = eventRepository.getEventById(event.id);
    const artistNames = repoEvent?.artists?.length
      ? repoEvent.artists
      : lineupRows.map((row) => row.artists?.name ?? row.artist_id);

    const displayPrice = formatDisplayPriceText(event.priceText);
    const completeness = inferLineupCompleteness(event, artistNames.length);

    samples.push({
      id: event.id,
      title: event.title,
      found: true,
      priceRaw: event.priceText,
      priceDisplay: displayPrice,
      ticketUrl: event.ticketUrl,
      providerLabel: event.source,
      description: event.description,
      descriptionState: event.description?.trim() ? 'present' : 'empty',
      artists: artistNames,
      lineupCompleteness: completeness,
      lineupSectionTitle: completeness === 'partial' ? 'BEKANNTE ARTISTS' : completeness === 'full' ? 'LINE-UP' : 'LINE-UP (empty)',
      image: Boolean(event.imageUrl?.trim()),
      venue: event.venue,
      city: event.city,
      status: event.status,
    });
  }

  const lehmann = events.find((row) => row.source === 'source-ticket-io-lehmannclub' && row.status === 'published');
  const area51 = events.find((row) => row.source === 'source-ticket-io-area51events' && row.status === 'published');

  for (const [label, event] of [
    ['lehmann', lehmann],
    ['area51', area51],
  ] as const) {
    if (!event) {
      samples.push({ label, found: false });
      continue;
    }
    const { data: lineupData } = await client
      .from('event_artists')
      .select('artist_id, artists(name)')
      .eq('event_id', event.id);
    const lineupRows = (lineupData ?? []) as EventArtistLineupRow[];
    const artistNames = lineupRows.map((row) => row.artists?.name ?? row.artist_id);
    samples.push({
      label,
      id: event.id,
      title: event.title,
      found: true,
      priceDisplay: formatDisplayPriceText(event.priceText),
      ticketUrl: event.ticketUrl,
      providerLabel: event.source,
      artists: artistNames,
      lineupCompleteness: inferLineupCompleteness(event, artistNames.length),
      venue: event.venue,
      status: event.status,
    });
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), samples }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
