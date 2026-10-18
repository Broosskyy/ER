import { describe, expect, it } from 'vitest';
import type { EventWritePlan } from '../../types/event-candidate';
import type { VerifiedTicketCompleteResult } from '../../../official-connectors/ticket-evidence/ticket-audit-metrics';
import { filterTicketResultsForExistingOnlyConnector } from '../ticket-result-eligibility';

const url = 'https://rausgegangen.de/events/safe-party/';
const key = 'rausgegangen:safe-party';
const ticketResult = (overrides: Partial<VerifiedTicketCompleteResult> = {}) => ({
  sourceEventKey: key, officialUrl: url, title: 'Safe party', startsAt: '2026-12-01T20:00:00+01:00',
  discoveredLinks: [], rejectedCandidates: [], identityResult: 'ticket_identity_verified',
  identityReasons: [], classification: 'verified', verifiedTicketComplete: true, ...overrides,
}) as VerifiedTicketCompleteResult;

function plan(overrides: Partial<EventWritePlan> = {}): EventWritePlan {
  return {
    sourceIdentity: { sourceRole: 'official', sourceEventKey: key, sourceUrl: url,
      contentHash: 'fp', fetchedAt: '2026-10-18T15:00:00Z' },
    validation: { decision: 'persist_ready', reasons: [] },
    existingSource: { sourceId: 'src-1', eventId: 'evt-1', sourceUrl: url,
      sourceEventKey: key, contentHash: null },
    resolvedEventId: 'evt-1', eventAction: 'noop',
    ...overrides,
  } as unknown as EventWritePlan;
}

describe('existing-only sync ticket evidence safety', () => {
  it('allows a ticket-only update for a known, unchanged source binding', () => {
    const evidence = ticketResult();
    const result = filterTicketResultsForExistingOnlyConnector([evidence], [plan()], 'existing_only');
    expect(result.eligible).toEqual([evidence]);
    expect(result.blocked).toEqual([]);
  });

  it('rejects unbound evidence, even if the ticket provider verified its own target', () => {
    const result = filterTicketResultsForExistingOnlyConnector([ticketResult()], [], 'existing_only');
    expect(result.eligible).toEqual([]);
    expect(result.blocked[0]?.reason).toBe('missing_or_duplicate_event_plan');
  });

  it('rejects ambiguous and rejected event plans', () => {
    const result = filterTicketResultsForExistingOnlyConnector(
      [ticketResult(), ticketResult({ sourceEventKey: 'rausgegangen:other' })],
      [plan({ validation: {decision: 'rejected', reasons: ['bad_event']} })],
      'existing_only',
    );
    expect(result.eligible).toEqual([]);
    expect(result.blocked).toHaveLength(2);
    expect(result.blocked[0]?.reason).toBe('event_plan_needs_review');
  });

  it('rejects a canonical binding pointing to another event', () => {
    const result = filterTicketResultsForExistingOnlyConnector(
      [ticketResult()],
      [plan({ resolvedEventId: 'evt-other' })],
      'existing_only',
    );
    expect(result.blocked[0]?.reason).toBe('not_bound_to_existing_source');
  });

  it('rejects an event-plan apply error without applying its ticket result', () => {
    const result = filterTicketResultsForExistingOnlyConnector(
      [ticketResult()], [plan()], 'existing_only', new Set([key]),
    );
    expect(result.eligible).toEqual([]);
    expect(result.blocked[0]?.reason).toBe('event_apply_failed');
  });

  it('rejects duplicate plans and mismatched source URLs', () => {
    const duplicates = filterTicketResultsForExistingOnlyConnector(
      [ticketResult()], [plan(),plan()], 'existing_only',
    );
    const mismatched = filterTicketResultsForExistingOnlyConnector(
      [ticketResult({officialUrl:'https://rausgegangen.de/events/other/'})],
      [plan()], 'existing_only',
    );
    expect(duplicates.blocked[0]?.reason).toBe('missing_or_duplicate_event_plan');
    expect(mismatched.blocked[0]?.reason).toBe('missing_or_duplicate_event_plan');
  });

  it('keeps original behavior for regular upsert connectors', () => {
    const result = filterTicketResultsForExistingOnlyConnector(
      [ticketResult()], [], 'upsert',
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.blocked).toEqual([]);
  });
});
