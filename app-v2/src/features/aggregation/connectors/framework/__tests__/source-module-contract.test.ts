import { describe, expect, it } from 'vitest';

import { createDefaultSourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';

describe('SourceModule contract bridge', () => {
  it('adapts existing Website and Ticket Platform connectors without parser rewrites', async () => {
    const registry = createDefaultSourceConnectorRegistry();
    const modules = registry.listSourceModules();
    const website = modules.find((module) => module.id === 'club_website');
    const ticketPlatform = modules.find((module) => module.id === 'ticket_platform');

    expect(website?.connectorVersion).toBeTruthy();
    expect(ticketPlatform?.connectorVersion).toBeTruthy();
    expect(website?.detectUrl('https://bootshaus.tv/events')).toBe(true);
    expect(ticketPlatform?.deriveSourceIdentity('https://proton-the-club.ticket.io/')).toBe(
      'proton-the-club.ticket.io',
    );
    expect(
      website?.reportCompleteness({
        discovered: 4,
        fetched: 4,
        normalized: 4,
        skipped: 0,
      }).status,
    ).toBe('complete');
  });
});
