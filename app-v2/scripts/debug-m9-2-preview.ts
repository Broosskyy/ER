#!/usr/bin/env tsx
import { AffenkaefigOfficialConnector } from '../server/official-connectors/affenkaefig/affenkaefig-official-connector';

async function main() {
  const connector = new AffenkaefigOfficialConnector();
  const result = await connector.runPreview({ maxDetailPages: 40 });
  for (const preview of result.previews) {
    const ticket = result.ticketResults?.find((r) => r.sourceEventKey === preview.sourceEventKey);
    console.log('\n===', preview.sourceEventKey, '===');
    console.log('title', preview.title);
    console.log('startsAt', preview.startsAt);
    console.log('descLen', (preview.descriptionClean ?? '').length);
    console.log('lineup', preview.lineupCandidates.map((a) => a.displayName));
    console.log('gaps', preview.enrichmentGaps);
    console.log('identity', ticket?.identityResult, ticket?.classification);
    console.log('offer', ticket?.ticketEvidence?.offers?.map((o) => ({
      label: o.rawLabel,
      minor: o.amountMinor,
      role: o.role,
    })));
    console.log('supplemental lineup', ticket?.providerEvidence?.supplementalContent?.lineupCandidates?.map((a) => a.displayName));
  }
}

main().catch(console.error);
