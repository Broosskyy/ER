import type { TicketFetchResult } from './types';

export interface OfficialPageCaptureResult {
  html: string;
  finalUrl?: string;
  contentFingerprint: string;
  ctaProbe?: {
    attempted: boolean;
    producedTicketUrl?: string;
    ctaObserved: boolean;
    ctaText?: string;
    ctaVisible?: boolean;
    ctaDisabled?: boolean;
    rawHref?: string;
  };
}

export interface TicketBrowserOps {
  captureOfficialEventPage(url: string): Promise<OfficialPageCaptureResult>;
  fetchTicketPage(url: string): Promise<TicketFetchResult>;
  close(): Promise<void>;
}
