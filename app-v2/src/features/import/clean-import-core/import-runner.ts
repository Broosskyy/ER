import { CanonicalEventBuilder } from './canonical-event-builder';
import type { CleanImportResult, ConnectorOutput } from './event-evidence';
import { IdentityResolver } from './identity-resolver';
import { ReviewDecision } from './review-decision';
import { SourceAdapter } from './source-adapter';

export class ImportRunner {
  constructor(
    private readonly sourceAdapter = new SourceAdapter(),
    private readonly identityResolver = new IdentityResolver(),
    private readonly canonicalEventBuilder = new CanonicalEventBuilder(),
    private readonly reviewDecision = new ReviewDecision(),
  ) {}

  run(outputs: ConnectorOutput[]): CleanImportResult {
    const evidence = outputs.map((output) => this.sourceAdapter.adapt(output));
    const identity = this.identityResolver.resolve(evidence);
    const canonicalEvent = this.canonicalEventBuilder.build(identity);
    const decision = this.reviewDecision.decide(canonicalEvent, identity);

    return {
      canonicalEvent,
      decision: decision.decision,
      evidence,
      missingRequiredFields: decision.missingRequiredFields,
      missingOptionalFields: decision.missingOptionalFields,
      reviewReasons: decision.reviewReasons,
    };
  }
}
