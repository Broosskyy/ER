import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { InventoryDelta } from './detail-types';
import type { TicketIoEventDiscoveryCandidate } from './types';
import { inventoryFingerprint } from './field-evidence';

export function loadPreviousDiscoveryEvents(repoRoot: string): TicketIoEventDiscoveryCandidate[] {
  const path = join(repoRoot, 'artifacts', 'm9-3b-1-ticketio-network-discovery', 'events.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TicketIoEventDiscoveryCandidate[];
  } catch {
    return [];
  }
}

export function computeInventoryDelta(
  previous: TicketIoEventDiscoveryCandidate[],
  current: TicketIoEventDiscoveryCandidate[],
): InventoryDelta {
  const previousUpcoming = previous.filter((event) => event.lifecycle !== 'ENDED');
  const currentUpcoming = current.filter((event) => event.lifecycle !== 'ENDED');

  const previousByKey = new Map(previousUpcoming.map((event) => [event.identityKey, event]));
  const currentByKey = new Map(currentUpcoming.map((event) => [event.identityKey, event]));

  const newSincePrevious = currentUpcoming
    .filter((event) => !previousByKey.has(event.identityKey))
    .map((event) => event.identityKey);
  const disappearedSincePrevious = previousUpcoming
    .filter((event) => !currentByKey.has(event.identityKey))
    .map((event) => event.identityKey);
  const changedSincePrevious = currentUpcoming
    .filter((event) => {
      const prior = previousByKey.get(event.identityKey);
      return prior && inventoryFingerprint(prior) !== inventoryFingerprint(event);
    })
    .map((event) => event.identityKey);

  return {
    previousCandidateCount: previousUpcoming.length,
    currentCandidateCount: currentUpcoming.length,
    newSincePrevious,
    disappearedSincePrevious,
    changedSincePrevious,
  };
}
