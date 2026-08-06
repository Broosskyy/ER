import {
  classifyElectronicMusicRelevance,
  type ElectronicRelevance,
} from './electronic-music-relevance';
import type { ParsedTicketPlatformEvent, TicketPlatformScopeConfig, TicketPlatformScopeStats } from './types';

export { classifyElectronicMusicRelevance, type ElectronicRelevance } from './electronic-music-relevance';

export function createEmptyScopeStats(): TicketPlatformScopeStats {
  return { discovered: 0, accepted: 0, rejected: 0, uncertain: 0, rejectionReasons: {} };
}

function recordBucket(stats: TicketPlatformScopeStats, relevance: ElectronicRelevance, reason?: string): void {
  if (relevance === 'relevant') {
    stats.accepted += 1;
    return;
  }
  if (relevance === 'uncertain') {
    stats.uncertain = (stats.uncertain ?? 0) + 1;
    return;
  }
  stats.rejected += 1;
  const bucket = reason ?? 'irrelevant';
  stats.rejectionReasons[bucket] = (stats.rejectionReasons[bucket] ?? 0) + 1;
}

/** @deprecated Use classifyElectronicMusicRelevance — kept for backward-compatible tests. */
export function isElectronicMusicEvent(
  event: ParsedTicketPlatformEvent,
  config: TicketPlatformScopeConfig = {},
): { accepted: boolean; reason?: string } {
  const { relevance, reason } = classifyElectronicMusicRelevance(event, config);
  return { accepted: relevance === 'relevant' || relevance === 'uncertain', reason };
}

export function filterElectronicMusicEvents(
  events: ParsedTicketPlatformEvent[],
  config: TicketPlatformScopeConfig = {},
): { events: ParsedTicketPlatformEvent[]; stats: TicketPlatformScopeStats } {
  const stats = createEmptyScopeStats();
  stats.discovered = events.length;
  const importable: ParsedTicketPlatformEvent[] = [];

  for (const event of events) {
    const { relevance, reason } = classifyElectronicMusicRelevance(event, config);
    recordBucket(stats, relevance, reason);

    if (relevance === 'irrelevant') {
      continue;
    }

    importable.push({
      ...event,
      electronicRelevance: relevance,
    });
  }

  return { events: importable, stats };
}
