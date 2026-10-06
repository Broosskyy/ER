#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'node:fs';

import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import { createSupabaseCliLinkedQueryExecutor } from '../server/ingestion/sync/linked-db';
import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { isPlanIdempotent, planOfficialEventWrite } from '../server/ingestion/planning/event-write-planner';
import { BootshausOfficialConnector } from '../server/official-connectors/bootshaus/bootshaus-official-connector';
import { canonicalizeOfficialSourceUrl } from '../server/ingestion/identity/source-identity';

async function main() {
  const runQuery = createSupabaseCliLinkedQueryExecutor();
  const context = loadPlannerContextFromLinkedDb(runQuery);
  const connector = new BootshausOfficialConnector();
  const preview = await connector.runPreview();
  const summaries = preview.previews.map((evidence) => {
    const candidate = officialEvidenceToEventCandidate(evidence);
    const plan = planOfficialEventWrite(candidate, context);
    const url =
      candidate.origin.kind === 'official_connector' ? candidate.origin.officialUrl : '';
    const existing = context.existingSources.find(
      (source) => canonicalizeOfficialSourceUrl(source.sourceUrl) === canonicalizeOfficialSourceUrl(url),
    );
    const fingerprint =
      candidate.origin.kind === 'official_connector' ? candidate.origin.pageFingerprint : null;
    const acceptedFields =
      plan.reconciliation?.fieldDecisions
        .filter((decision) => decision.decision === 'accept')
        .map((decision) => decision.field) ?? [];

    return {
      sourceEventKey:
        candidate.origin.kind === 'official_connector' ? candidate.origin.sourceEventKey : null,
      sameFingerprint: existing?.contentHash === fingerprint,
      classification: plan.reconciliation?.classification,
      idempotent: isPlanIdempotent(plan),
      eventAction: plan.eventAction,
      sourceAction: plan.sourceAction,
      acceptedFields,
      reasons: plan.reasons.slice(-3),
    };
  });

  mkdirSync('.tmp/m8-5-staging-e2e', { recursive: true });
  writeFileSync('.tmp/m8-5-staging-e2e/all-plans-debug.json', JSON.stringify(summaries, null, 2));
  console.log(
    JSON.stringify(
      {
        total: summaries.length,
        idempotent: summaries.filter((entry) => entry.idempotent).length,
        sameFingerprint: summaries.filter((entry) => entry.sameFingerprint).length,
        classifications: summaries.reduce<Record<string, number>>((acc, entry) => {
          const key = entry.classification ?? 'unknown';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
