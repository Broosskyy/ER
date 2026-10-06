import type { EventTicketEvidence } from './types';
import { parseTicketIoFromJsonLdOrDom, lowestAdmissionOffer } from './ticket-io-evidence-provider';

export function parseTicketIoPage(input: {
  sourceUrl: string;
  body: string;
  fingerprint: string;
  observedAt: string;
  extractedAt: string;
}): EventTicketEvidence | undefined {
  return parseTicketIoFromJsonLdOrDom(input);
}

export function lowestAvailableOffer(evidence: EventTicketEvidence) {
  return lowestAdmissionOffer(evidence);
}
