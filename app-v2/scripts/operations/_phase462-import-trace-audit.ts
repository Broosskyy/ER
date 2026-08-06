/**
 * Read-only import field trace audit (Phase 4.6.2 Part 1).
 * Compares source metadata vs canonical projection for published events.
 *
 * Usage: npx tsx scripts/operations/_phase462-import-trace-audit.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { eventRepository } from '@/data/repositories/registry';
import { importEventPublishService } from '@/features/import/services/import-event-publish-service';
import { toEventDisplayModel } from '@/features/events/formatting/display-event';

const VALIDATION_EVENT_TITLES = [
  'Sommerfest',
  'PLAY!',
  'Technodampfer',
  'SHOCKONE',
  'Musik die mich antreibt',
  'Affenkäfig',
  'Lehmann',
  'Proton',
  'Mallorca',
];

interface FieldTrace {
  field: string;
  sourceValue?: string;
  publicValue?: string;
  lossDetected: boolean;
}

async function main(): Promise<void> {
  await importEventPublishService.refreshConsumerFeed();

  const events = eventRepository.getPublishedEvents();
  const samples = events.filter((event) =>
    VALIDATION_EVENT_TITLES.some((needle) =>
      event.title.toLowerCase().includes(needle.toLowerCase()),
    ),
  );

  const report = samples.map((event) => {
    const display = toEventDisplayModel(event);
    const traces: FieldTrace[] = [
      {
        field: 'description',
        sourceValue: event.description?.slice(0, 120),
        publicValue: display.sanitizedDescription?.slice(0, 120),
        lossDetected:
          Boolean(event.description?.trim()) &&
          !display.sanitizedDescription?.trim(),
      },
      {
        field: 'lineup',
        sourceValue: event.artists?.join(', '),
        publicValue: display.knownArtistNames.join(', '),
        lossDetected:
          (event.artists?.length ?? 0) > 0 &&
          display.knownArtistNames.length < event.artists.length,
      },
      {
        field: 'price',
        sourceValue: event.priceText,
        publicValue: display.displayPriceText,
        lossDetected: Boolean(event.priceText?.trim()) && !display.displayPriceText,
      },
      {
        field: 'genres',
        sourceValue: event.genres?.join(', '),
        publicValue: display.genres.join(', '),
        lossDetected:
          (event.genres?.length ?? 0) > 0 && display.genres.length === 0,
      },
    ];

    return {
      eventId: event.id,
      title: event.title,
      source: event.source,
      traces,
      lossCount: traces.filter((trace) => trace.lossDetected).length,
    };
  });

  const outputPath = join(
    process.cwd(),
    'docs/real-data/_phase462_import_trace_audit.json',
  );
  writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
  console.log(`Wrote ${report.length} event traces to ${outputPath}`);
}

void main();
