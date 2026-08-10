import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import type {
  AdminEventTicketStatus,
  CanonicalTicketPhase,
} from '@/features/import/domain/canonical-ticket-phase';

export type CleanSourceFamily = 'official_website' | 'ticket_io' | 'ticket_kings';
export type CleanImportDecision =
  | 'publish'
  | 'publish_partial'
  | 'review'
  | 'duplicate_candidate'
  | 'reject';

export type LineupEvidenceState = 'explicit_artists' | 'tba' | 'empty';

export interface EvidencedValue<T> {
  value: T;
  sourceUrl: string;
  verifiedAt: string;
}

export interface TicketExcludedProductEvidence {
  name: string;
  reason: string;
  priceAmount?: number;
  priceCurrency?: string;
}

export interface ConnectorOutput {
  sourceId: string;
  sourceFamily: CleanSourceFamily;
  sourceUrl: string;
  requestedSourceUrl?: string;
  finalSourceUrl?: string;
  verifiedAt?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  locationText?: string;
  officialWebsiteUrl?: string;
  outboundTicketUrls?: string[];
  description?: string;
  genres?: string[];
  lineup?: LineupEvidenceEntry[];
  lineupState?: LineupEvidenceState;
  lineupReason?: string;
  minimumAge?: string;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
  publicTicketUrl?: string;
  checkoutEvidenceUrl?: string;
  admissionPrice?: {
    amount: number;
    currency: string;
    text?: string;
  };
  ticketPhases?: CanonicalTicketPhase[];
  admissionProducts?: CanonicalTicketPhase[];
  excludedProducts?: TicketExcludedProductEvidence[];
  ticketStatus?: AdminEventTicketStatus;
  duplicateCandidate?: boolean;
  diagnostics?: string[];
}

export interface EventEvidence {
  sourceId: string;
  sourceFamily: CleanSourceFamily;
  sourceUrl: string;
  requestedSourceUrl?: string;
  finalSourceUrl?: string;
  verifiedAt?: string;
  identity: {
    title?: EvidencedValue<string>;
    startDate?: EvidencedValue<string>;
    endDate?: EvidencedValue<string>;
    venueName?: EvidencedValue<string>;
    locationText?: EvidencedValue<string>;
    officialWebsiteUrl?: EvidencedValue<string>;
    outboundTicketUrls: string[];
  };
  content: {
    description?: EvidencedValue<string>;
    genres?: EvidencedValue<string[]>;
    lineup?: EvidencedValue<LineupEvidenceEntry[]>;
    lineupState?: EvidencedValue<LineupEvidenceState>;
    lineupReason?: EvidencedValue<string>;
    minimumAge?: EvidencedValue<string>;
    venueEnvironment?: EvidencedValue<'indoor' | 'outdoor' | 'hybrid'>;
  };
  tickets: {
    publicTicketUrl?: EvidencedValue<string>;
    checkoutEvidenceUrl?: EvidencedValue<string>;
    admissionPrice?: EvidencedValue<{
      amount: number;
      currency: string;
      text?: string;
    }>;
    ticketPhases?: EvidencedValue<CanonicalTicketPhase[]>;
    admissionProducts?: EvidencedValue<CanonicalTicketPhase[]>;
    excludedProducts?: EvidencedValue<TicketExcludedProductEvidence[]>;
    ticketStatus?: EvidencedValue<AdminEventTicketStatus>;
  };
  duplicateCandidate: boolean;
  diagnostics: string[];
}

export interface CanonicalEvent {
  title: string;
  startDate: string;
  endDate?: string;
  venueName?: string;
  locationText?: string;
  websiteUrl: string;
  description?: string;
  genres?: string[];
  lineup?: LineupEvidenceEntry[];
  lineupState?: LineupEvidenceState;
  lineupReason?: string;
  minimumAge?: string;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
  ticketUrl?: string;
  checkoutEvidenceUrl?: string;
  admissionPrice?: {
    amount: number;
    currency: string;
    text?: string;
  };
  ticketPhases?: CanonicalTicketPhase[];
  ticketStatus?: AdminEventTicketStatus;
}

export interface CleanImportResult {
  canonicalEvent?: CanonicalEvent;
  decision: CleanImportDecision;
  evidence: EventEvidence[];
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  reviewReasons: string[];
}
