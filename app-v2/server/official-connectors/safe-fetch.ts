import type { ConnectorErrorCounters } from './types';
import { bootshausSafeFetchPolicy } from './bootshaus/fetch-policy';
import {
  safeFetchHtmlWithPolicy,
  type SafeFetchRequestContext,
  type SafeFetchRequestOptions,
  type SafeFetchResult,
} from './generic-safe-fetch';

export { SafeFetchError } from './generic-safe-fetch';
export type { SafeFetchRequestContext, SafeFetchRequestOptions, SafeFetchResult } from './generic-safe-fetch';

export interface SafeFetchOptions extends SafeFetchRequestOptions {
  counters: ConnectorErrorCounters;
  allowListOnly?: boolean;
  allowDetailOnly?: boolean;
}

export async function safeFetchHtml(initialUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const context: SafeFetchRequestContext = {
    allowListOnly: options.allowListOnly,
    allowDetailOnly: options.allowDetailOnly,
  };
  return safeFetchHtmlWithPolicy(initialUrl, bootshausSafeFetchPolicy, options, context);
}
