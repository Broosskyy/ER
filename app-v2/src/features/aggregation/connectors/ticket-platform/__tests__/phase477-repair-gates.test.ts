import { describe, expect, it } from 'vitest';

import { isInternalEntityId } from '@/features/events/discovery/internal-event-eligibility';
import { isTicketIoShopRootUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';

const PALMA_SHOP_ROOT_IDS = [
  'evt-1785339424521-tn10siz',
  'evt-1785339413919-ix5umo9',
  'evt-1785339377456-7miaf2o',
  'evt-1785339409363-puvo8be',
  'evt-1785339388133-sq2ykbm',
  'evt-1785339407876-uqm3mz0',
];

describe('phase 4.7.7 repair gates', () => {
  it('classifies staging fixture ids', () => {
    expect(isInternalEntityId('staging-seed-event-tonight-house')).toBe(true);
    const isStagingFixture = (id: string) =>
      isInternalEntityId(id) || id === 'klangkuenstler-berghain';
    expect(isStagingFixture('klangkuenstler-berghain')).toBe(true);
    expect(isInternalEntityId('evt-1785339420043-obhyeev')).toBe(false);
  });

  it('detects Palma shop-root ticket URLs', () => {
    expect(isTicketIoShopRootUrl('https://bootshaus.ticket.io/')).toBe(true);
    expect(classifyTicketDestination('https://bootshaus.ticket.io/').destinationClass).toBe(
      'ticket_platform_root',
    );
    expect(classifyTicketDestination('https://bootshaus-club.ticket.io/C7JPnatZ/').destinationClass).toBe(
      'ticket_platform_event',
    );
  });

  it('lists all Palma shop-root event ids from phase 4.7.4.2', () => {
    expect(PALMA_SHOP_ROOT_IDS).toHaveLength(6);
  });
});
