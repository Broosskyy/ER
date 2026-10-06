import { writeFileSync } from 'node:fs';

import { loadPlannerContextFromLinkedDb } from '../server/ingestion/sync/load-planner-context';
import { createSupabaseCliLinkedQueryExecutor } from '../server/ingestion/sync/linked-db';
import { officialEvidenceToEventCandidate } from '../server/ingestion/adapters/official-evidence-adapter';
import { planOfficialEventWrite } from '../server/ingestion/planning/event-write-planner';
import { BootshausOfficialConnector } from '../server/official-connectors/bootshaus/bootshaus-official-connector';
import { canonicalizeOfficialSourceUrl } from '../server/ingestion/identity/source-identity';

async function main() {
  const runQuery = createSupabaseCliLinkedQueryExecutor();
  const context = loadPlannerContextFromLinkedDb(runQuery);
  const connector = new BootshausOfficialConnector();
  const preview = await connector.runPreview({ maxDetailPages: 1 });
  const candidate = officialEvidenceToEventCandidate(preview.previews[0]!);
  const plan = planOfficialEventWrite(candidate, context);
  const url = canonicalizeOfficialSourceUrl(
    candidate.origin.kind === 'official_connector' ? candidate.origin.officialUrl : '',
  );
  const existing = context.existingSources.find(
    (source) => canonicalizeOfficialSourceUrl(source.sourceUrl) === url,
  );

  writeFileSync(
    '.tmp/m8-5-staging-e2e/plan-debug.json',
    JSON.stringify(
      {
        url,
        liveFingerprint:
          candidate.origin.kind === 'official_connector' ? candidate.origin.pageFingerprint : null,
        dbHash: existing?.contentHash ?? null,
        sameFingerprint: existing?.contentHash === (candidate.origin.kind === 'official_connector' ? candidate.origin.pageFingerprint : null),
        planActions: {
          event: plan.eventAction,
          source: plan.sourceAction,
          lineup: plan.lineupAction,
          genres: plan.genresAction,
        },
        reconciliation: plan.reconciliation?.classification,
        idempotent: plan.eventAction === 'noop' && plan.sourceAction === 'noop',
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
