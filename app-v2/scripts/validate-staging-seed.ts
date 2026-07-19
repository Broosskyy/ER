#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import path from 'node:path';

const seedPath = path.resolve(__dirname, 'staging/seed-staging-app-data.sql');
const sql = readFileSync(seedPath, 'utf8');

const requiredPrefixes = [
  'staging-seed-city-koeln',
  'staging-seed-city-berlin',
  'staging-seed-venue-bootshaus',
  'staging-seed-genre-techno',
  'staging-seed-artist-daxson',
  'staging-seed-collection-highlights',
  'staging-seed-source-manual',
  'void-techno-saturday',
  'klangkuenstler-berghain',
  'staging-seed-event-draft-secret',
];

const requiredPatterns = [
  /ON CONFLICT \(id\) DO UPDATE/i,
  /'published'/,
  /'draft'/,
  /BEGIN;/,
  /COMMIT;/,
];

function countMatches(pattern: RegExp): number {
  return (sql.match(pattern) ?? []).length;
}

function main(): void {
  for (const id of requiredPrefixes) {
    if (!sql.includes(id)) {
      throw new Error(`Seed SQL missing required id: ${id}`);
    }
  }

  for (const pattern of requiredPatterns) {
    if (!pattern.test(sql)) {
      throw new Error(`Seed SQL missing required pattern: ${pattern}`);
    }
  }

  const publishedCount = countMatches(/'published'/g);
  const draftCount = countMatches(/'draft'/g);

  if (publishedCount < 16) {
    throw new Error(`Expected at least 16 published markers, found ${publishedCount}`);
  }

  if (draftCount < 2) {
    throw new Error(`Expected at least 2 draft markers, found ${draftCount}`);
  }

  console.log('Staging seed SQL validation passed.');
  console.log(`  File: ${seedPath}`);
  console.log(`  Published markers: ${publishedCount}`);
  console.log(`  Draft markers: ${draftCount}`);
}

main();
