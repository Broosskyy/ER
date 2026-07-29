import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import {
  createBootshausKoelnLiveSourceRecord,
} from '@/features/sources/production/bootshaus-source';

async function main(): Promise<void> {
  const record = createBootshausKoelnLiveSourceRecord();
  const importSource = mapSourceRecordToImportSource(record);

  console.log('=== Bootshaus Live Smoke Test ===');
  console.log('Source:', record.displayName);
  console.log('URL:', record.baseUrl);
  console.log('Strategy:', record.sourceConfig?.website?.preferredStrategy);
  console.log('Limits:', record.sourceConfig?.website?.limits);
  console.log('');

  const detection = await websiteProcessor.detect({
    url: record.baseUrl ?? '',
    importSource,
    connectorKey: 'club_website',
  });

  console.log('--- Detection Report ---');
  console.log(
    JSON.stringify(
      {
        finalUrl: detection.finalUrl,
        recommendedStrategy: detection.recommendedStrategy,
        recommendedNextAction: detection.recommendedNextAction,
        eventContainerCount: detection.eventContainerCount,
        detectedStrategies: detection.detectedStrategies,
        detectedFormats: detection.detectedFormats.map((signal) => signal.format),
        javascriptRenderingSuspected: detection.javascriptRenderingSuspected,
        blockers: detection.blockers,
        warnings: detection.warnings,
      },
      null,
      2,
    ),
  );

  const output = await websiteProcessor.process({
    url: record.baseUrl ?? '',
    importSource,
    connectorKey: 'club_website',
  });

  console.log('\n--- Extraction ---');
  console.log('Strategy:', output.result.diagnostics.strategy);
  console.log('Candidates:', output.result.diagnostics.candidateCount);
  console.log('Valid:', output.result.diagnostics.validEventCount);
  console.log('Skipped:', output.result.diagnostics.skippedCount);
  console.log('Fetch ms:', output.result.diagnostics.fetchDurationMs);
  console.log('Sample events:');
  for (const event of output.events.slice(0, 5)) {
    console.log(' -', event.title, '|', event.startDate, '|', event.sourceUrl);
  }

  console.log('\nSmoke test complete. No publish performed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
