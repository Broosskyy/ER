import { describe, expect, it } from 'vitest';

import { genericTicketPageHasRecoverableEvidence } from '../create-playwright-ticket-browser-ops';

describe('generic browser ticket evidence readiness', () => {
  it('accepts generic rendered event pages with JSON-LD or visible price evidence', () => {
    expect(
      genericTicketPageHasRecoverableEvidence(
        '<html><body><script type="application/ld+json">{"@type":"Event","offers":{"price":"19.90"}}</script></body></html>',
      ),
    ).toBe(true);

    expect(
      genericTicketPageHasRecoverableEvidence(
        '<html><body><div class="checkout-price">19,90 €</div></body></html>',
      ),
    ).toBe(true);
  });

  it('does not mark a security challenge without event evidence as recoverable', () => {
    expect(
      genericTicketPageHasRecoverableEvidence(
        '<html><body><h1>Just a moment</h1><p>Security check in progress</p></body></html>',
      ),
    ).toBe(false);
  });
});
