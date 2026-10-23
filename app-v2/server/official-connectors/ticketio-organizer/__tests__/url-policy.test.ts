import { describe, expect, it } from 'vitest';
import { isApprovedTicketIoEventUrl,listApprovedTicketIoShopEvents } from '../url-policy';

describe('verified ticket.io organizer discovery',()=>{
  it('returns only event-specific targets from an approved organizer shop',()=>{
    const html=[
      '<a href="/aLr3YQLG/">AREA51 TECHNO — Hart an der Grenze</a>',
      '<a href="https://area51events.ticket.io/pK21qzGB/?lang=de">Old Techno</a>',
      '<a href="https://not-area51.ticket.io/abc12345/">Foreign</a>',
      '<a href="/">Shop</a>',
      '<a href="/checkout/">Checkout</a>',
      '<a href="/aLr3YQLG/">Duplicate</a>',
    ].join('');
    expect(listApprovedTicketIoShopEvents(html,'area51events.ticket.io')).toEqual([
      'https://area51events.ticket.io/aLr3YQLG/',
      'https://area51events.ticket.io/pK21qzGB/',
    ]);
  });
  it('blocks unapproved shops, non-HTTPS and roots',()=>{
    expect(isApprovedTicketIoEventUrl('https://area51events.ticket.io/aLr3YQLG/')).toBe(true);
    expect(isApprovedTicketIoEventUrl('https://area51events.ticket.io/')).toBe(false);
    expect(isApprovedTicketIoEventUrl('http://area51events.ticket.io/aLr3YQLG/')).toBe(false);
    expect(isApprovedTicketIoEventUrl('https://random.ticket.io/aLr3YQLG/')).toBe(false);
    expect(listApprovedTicketIoShopEvents('<a href="/aLr3YQLG/">a</a>','random.ticket.io')).toEqual([]);
  });
});
