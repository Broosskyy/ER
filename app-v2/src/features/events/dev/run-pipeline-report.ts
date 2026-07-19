#!/usr/bin/env node
 

import { runDefaultEventPipeline, logRejectedOrUnpublishedEvents } from '../pipeline/run-pipeline';

function main(): void {
  const report = runDefaultEventPipeline();

  console.log('Eternal Rave — Event Pipeline Report');
  console.log('====================================');
  console.log(`Raw events:            ${report.rawEventCount}`);
  console.log(`Normalized events:     ${report.normalizedEventCount}`);
  console.log(`Valid events:          ${report.validEventCount}`);
  console.log(`Warnings:              ${report.warningCount}`);
  console.log(`Rejected events:       ${report.rejectedEventCount}`);
  console.log(`Possible duplicates:   ${report.possibleDuplicateCount}`);
  console.log(`Published events:      ${report.publishedEventCount}`);
  console.log('');

  console.log('Published event IDs:');
  for (const event of report.publishedEvents) {
    console.log(`  - ${event.id} (${event.title})`);
  }

  console.log('');
  console.log('Non-published decisions:');
  logRejectedOrUnpublishedEvents(report);
}

main();
