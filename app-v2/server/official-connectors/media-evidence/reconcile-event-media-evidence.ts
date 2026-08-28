import type { OfficialEventEvidence } from '../types';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import {
  applyEventMediaSelectionToEvidence,
  selectBestVerifiedEventMedia,
} from './select-best-verified-event-media';

export function reconcileEventMediaEvidence(
  evidence: OfficialEventEvidence,
  ticketResult?: VerifiedTicketCompleteResult,
  existingImageUrl?: string,
): OfficialEventEvidence {
  const selection = selectBestVerifiedEventMedia(evidence, ticketResult, existingImageUrl ?? evidence.officialImageUrl);
  return applyEventMediaSelectionToEvidence(evidence, selection);
}
