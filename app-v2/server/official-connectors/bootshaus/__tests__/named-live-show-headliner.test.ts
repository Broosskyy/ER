import {describe,expect,it} from 'vitest';
import {parseBootshausDetailPage} from '../parse-detail';
import {createEmptyConnectorCounters} from '../../types';

function detail(title: string, url: string) {
  const html=`<div class="upcoming-title">${title}</div>
  <div class="event-details-container">
    <div><h4>Begin</h4>20.11.2026 23:00</div>
    <div><h4>End</h4>21.11.2026 04:00</div>
    <div><h4>Location</h4>Bootshaus, Auenweg 173, 51063 Köln</div>
  </div>
  <div class="event-description-content"><p>${title}</p></div>
  <div class="artists-container">
    <span>Fabiasco</span><span>Hans Glock</span><span>Teknoclash</span>
  </div>`;
  return parseBootshausDetailPage(html,url,'2026-10-21T07:00:00Z',
    createEmptyConnectorCounters());
}
describe('verified Bootshaus 360 live show support/headliner recovery',()=>{
  it('prevents a title-only description from replacing a verified editorial text',()=>{
    const event=detail('JEBROER 360 LIVE SHOW',
      'https://bootshaus.tv/events/201126-jebroer-360-live-show/');
    expect(event.descriptionClean).toBeUndefined();
    expect(event.enrichmentGaps).toContain('description_missing');
  });
  it('restores the principal named act for this exact verified official event',()=>{
    const event=detail('JEBROER 360 LIVE SHOW',
      'https://bootshaus.tv/events/201126-jebroer-360-live-show/');
    // The headliner is present even when the DOM contains only support acts.
    expect(event.lineupCandidates[0]).toMatchObject({
      displayName:'JEBROER', evidenceRole:'headliner',
      evidenceOrigin:'official_title', billingOrder:0,
    });
  });
  it('does not use matching event names from unrelated source URLs',()=>{
    const event=detail('JEBROER 360 LIVE SHOW',
      'https://bootshaus.tv/events/unrelated-live-show/');
    expect(event.lineupCandidates.some(act=>act.displayName==='JEBROER')).toBe(false);
  });
});
