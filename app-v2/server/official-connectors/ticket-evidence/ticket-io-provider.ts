import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import type { EventTicketEvidence, TicketEventClassification } from './types';
import { parseTicketIoPage } from './parse-ticket-io-page';
import { safeFetchTicketPage } from './safe-fetch-ticket';
import { classificationForStatus } from './normalize-ticket-status';
import {
  canonicalizeTicketIoUrl,
  isTicketIoEventDetailUrl,
  isTicketIoShopRootUrl,
} from './url-policy';

const CACHE_DIR = '.tmp/m6-ticket-evidence-cache';

export interface TicketIoDiscoveryInput {
  sourceEventKey: string;
  officialUrl: string;
  linkedTicketUrl?: string;
}

export interface TicketIoEventResult {
  sourceEventKey: string;
  officialUrl: string;
  linkedTicketUrl?: string;
  canonicalTicketUrl?: string;
  classification: TicketEventClassification;
  blockReason?: string;
  evidence?: EventTicketEvidence;
  reviewReason?: string;
}

function cachePathForUrl(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex');
  return join(CACHE_DIR, `${hash}.json`);
}

function readCache(url: string): TicketIoEventResult['evidence'] | 'blocked' | undefined {
  const path = cachePathForUrl(url);
  if (!existsSync(path)) {
    return undefined;
  }
  const payload = JSON.parse(readFileSync(path, 'utf8')) as {
    blocked?: boolean;
    evidence?: EventTicketEvidence;
  };
  if (payload.blocked) {
    return 'blocked';
  }
  return payload.evidence;
}

function writeCache(url: string, payload: { blocked?: boolean; evidence?: EventTicketEvidence }): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePathForUrl(url), `${JSON.stringify(payload, null, 2)}\n`);
}

export async function fetchTicketIoEvidenceForUrl(
  linkedTicketUrl: string,
  options: { useCache?: boolean } = {},
): Promise<{ blocked: boolean; evidence?: EventTicketEvidence; blockReason?: string }> {
  const canonical = canonicalizeTicketIoUrl(linkedTicketUrl);
  if (!canonical) {
    return { blocked: false, blockReason: 'ticket_identity_unverifiable' };
  }
  if (isTicketIoShopRootUrl(canonical) || !isTicketIoEventDetailUrl(canonical)) {
    return { blocked: false, blockReason: 'ticket_identity_unverifiable' };
  }

  if (options.useCache !== false) {
    const cached = readCache(canonical);
    if (cached === 'blocked') {
      return { blocked: true, blockReason: 'bot_protection' };
    }
    if (cached) {
      return { blocked: false, evidence: cached };
    }
  }

  const fetched = await safeFetchTicketPage(canonical);
  if (fetched.blocked) {
    writeCache(canonical, { blocked: true });
    return { blocked: true, blockReason: fetched.blockReason ?? 'bot_protection' };
  }

  const evidence = parseTicketIoPage({
    sourceUrl: canonical,
    body: fetched.body,
    fingerprint: fetched.fingerprint,
    observedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
  });
  if (!evidence) {
    return { blocked: false, blockReason: 'ticket_status_ambiguous' };
  }
  writeCache(canonical, { evidence });
  return { blocked: false, evidence };
}

export async function runTicketIoLivePass(
  events: TicketIoDiscoveryInput[],
  options: { useCache?: boolean } = {},
): Promise<TicketIoEventResult[]> {
  const fetchedUrls = new Set<string>();
  const results: TicketIoEventResult[] = [];

  for (const event of events) {
    if (!event.linkedTicketUrl) {
      results.push({
        sourceEventKey: event.sourceEventKey,
        officialUrl: event.officialUrl,
        classification: 'ticket_not_offered',
      });
      continue;
    }

    const canonical = canonicalizeTicketIoUrl(event.linkedTicketUrl);
    if (!canonical || isTicketIoShopRootUrl(canonical) || !isTicketIoEventDetailUrl(canonical)) {
      results.push({
        sourceEventKey: event.sourceEventKey,
        officialUrl: event.officialUrl,
        linkedTicketUrl: event.linkedTicketUrl,
        classification: 'ticket_identity_unverifiable',
        reviewReason: 'invalid_ticket_url_role',
      });
      continue;
    }

    if (fetchedUrls.has(canonical)) {
      results.push({
        sourceEventKey: event.sourceEventKey,
        officialUrl: event.officialUrl,
        linkedTicketUrl: event.linkedTicketUrl,
        canonicalTicketUrl: canonical,
        classification: 'ticket_identity_unverifiable',
        reviewReason: 'duplicate_ticket_provider_assignment',
      });
      continue;
    }
    fetchedUrls.add(canonical);

    const fetched = await fetchTicketIoEvidenceForUrl(canonical, options);
    if (fetched.blocked) {
      results.push({
        sourceEventKey: event.sourceEventKey,
        officialUrl: event.officialUrl,
        linkedTicketUrl: event.linkedTicketUrl,
        canonicalTicketUrl: canonical,
        classification: 'ticket_provider_blocked',
        blockReason: fetched.blockReason,
      });
      continue;
    }

    if (!fetched.evidence) {
      results.push({
        sourceEventKey: event.sourceEventKey,
        officialUrl: event.officialUrl,
        linkedTicketUrl: event.linkedTicketUrl,
        canonicalTicketUrl: canonical,
        classification: 'ticket_status_ambiguous',
        reviewReason: fetched.blockReason,
      });
      continue;
    }

    results.push({
      sourceEventKey: event.sourceEventKey,
      officialUrl: event.officialUrl,
      linkedTicketUrl: event.linkedTicketUrl,
      canonicalTicketUrl: canonical,
      classification: classificationForStatus(fetched.evidence.normalizedStatus) as TicketEventClassification,
      evidence: fetched.evidence,
    });
  }

  return results;
}
