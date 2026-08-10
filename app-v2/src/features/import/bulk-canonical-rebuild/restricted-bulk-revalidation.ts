import { createBulkDetailFetchFn } from './detail-fetch-http';
import type { ForensicAuditEntry } from './restricted-bulk-forensic';
import type { BulkRebuildEventRow } from './types';

export interface LiveRevalidationResult {
  eventId: string;
  passed: boolean;
  reasons: string[];
  verifiedAt?: string | null;
  detailFetchStatuses: string[];
}

export async function liveRevalidateRestrictedCandidates(
  selected: ForensicAuditEntry[],
  rows: BulkRebuildEventRow[],
): Promise<{
  results: LiveRevalidationResult[];
  removed: Array<{ eventId: string; reason: string }>;
  detailFetchFnUsed: true;
}> {
  const rowById = new Map(rows.map((r) => [r.eventIdBefore, r]));
  const detailFetchFn = createBulkDetailFetchFn();
  const results: LiveRevalidationResult[] = [];
  const removed: Array<{ eventId: string; reason: string }> = [];

  for (const audit of selected) {
    const row = rowById.get(audit.eventId);
    const reasons: string[] = [];
    const detailFetchStatuses: string[] = [];

    if (!row) {
      removed.push({ eventId: audit.eventId, reason: 'row_missing' });
      continue;
    }

    const urls = new Set<string>();
    for (const c of row.sourceContributions) {
      if (c.candidate.eventUrl) urls.add(c.candidate.eventUrl);
      if (c.candidate.ticketUrl) urls.add(c.candidate.ticketUrl);
    }

    const needsDetailContent = audit.proposedFieldGroups.some(
      (g) => g === 'content' || g === 'lineup' || g === 'genres',
    );
    const ticketOnlyPatch =
      audit.proposedFieldGroups.length > 0 &&
      audit.proposedFieldGroups.every((g) => g === 'tickets');

    for (const url of urls) {
      try {
        const result = await detailFetchFn(url);
        const status = result.html ? 'ok' : result.error ?? 'content_unusable';
        detailFetchStatuses.push(status);
        if (!result.html) {
          if (needsDetailContent) {
            reasons.push(`live_unavailable:${url}`);
          } else if (!ticketOnlyPatch) {
            reasons.push(`live_unavailable:${url}`);
          }
        }
      } catch {
        detailFetchStatuses.push('error');
        reasons.push(`fetch_error:${url}`);
      }
    }

    const fingerprintDrift =
      JSON.stringify(audit.currentEventFingerprint) !==
      JSON.stringify({
        title: row.existing?.title,
        startDate: row.existing?.startDate,
        endDate: row.existing?.endDate,
        venueName: row.existing?.venueName,
        organizerName: row.existing?.organizerName,
        websiteUrl: row.existing?.websiteUrl,
        ticketUrl: row.existing?.ticketUrl,
        priceText: row.existing?.priceText,
        ticketStatus: row.existing?.ticketStatus,
        genreLabels: row.existing?.genreLabels,
        descriptionLength: row.existing?.description?.length ?? 0,
      });
    if (fingerprintDrift) {
      reasons.push('db_fingerprint_drift');
    }

    const passed = reasons.length === 0;
    results.push({
      eventId: audit.eventId,
      passed,
      reasons,
      verifiedAt: row.rebuilt.verifiedAt,
      detailFetchStatuses,
    });

    if (!passed) {
      removed.push({ eventId: audit.eventId, reason: reasons.join(';') });
    }
  }

  return { results, removed, detailFetchFnUsed: true };
}
