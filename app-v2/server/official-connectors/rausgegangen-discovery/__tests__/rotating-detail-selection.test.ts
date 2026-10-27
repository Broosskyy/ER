import { describe, expect, it } from 'vitest';
import { selectRotatingRausgegangenDetails } from '../rotating-detail-selection';

const items = Array.from({length: 100},(_,i)=>({
  eventSlug: 'rave-'+i, regionSlug:i%2?'hamburg':'berlin',
  relevance:i%5===0?'HIGH_RELEVANCE':i%5===1?'LIKELY_RELEVANT':'AMBIGUOUS',
}));
describe('rotating Rausgegangen nationwide discovery',()=>{
  it('never excludes explicitly refreshed source bindings',()=>{
    const result=selectRotatingRausgegangenDetails(items,{
      preferredSlugs:new Set(['rave-90']),
      knownSlugs:new Set(['rave-90','rave-1','rave-2']),slot:100,limit:6,
    });
    expect(result[0]?.eventSlug).toBe('rave-90');
    expect(result.some(x=>x.eventSlug==='rave-1')).toBe(false);
  });
  it('changes discovery sample across six-hour slots while favoring genre signals',()=>{
    const a=selectRotatingRausgegangenDetails(items,{slot:100,limit:8});
    const b=selectRotatingRausgegangenDetails(items,{slot:101,limit:8});
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(8);
    expect(a.every(x=>x.relevance==='HIGH_RELEVANCE')).toBe(true);
  });
  it('is reproducible for identical listing and slot',()=>{
    const a=selectRotatingRausgegangenDetails(items,{slot:200,limit:12});
    expect(a).toEqual(selectRotatingRausgegangenDetails(items,{slot:200,limit:12}));
  });
  it('rejects uncontrolled detail batches',()=>{
    expect(()=>selectRotatingRausgegangenDetails(items,{slot:0,limit:501})).toThrow();
  });
});

describe('relevance/lifecycle gating before limited requests',()=>{
  it('skips expired and clearly irrelevant listings instead of spending the entire detail budget',()=>{
    const pool=[
      {eventSlug:'past',regionSlug:'berlin',relevance:'HIGH_RELEVANCE',lifecycle:'ENDED' as const},
      {eventSlug:'pop',regionSlug:'berlin',relevance:'IRRELEVANT',lifecycle:'UPCOMING' as const},
      {eventSlug:'rave',regionSlug:'hamburg',relevance:'HIGH_RELEVANCE',lifecycle:'UPCOMING' as const},
      {eventSlug:'new',regionSlug:'koeln',relevance:'LIKELY_RELEVANT',lifecycle:'UNKNOWN' as const},
    ];
    const result=selectRotatingRausgegangenDetails(pool,{slot:4,limit:10});
    expect(result.map(item=>item.eventSlug).sort()).toEqual(['new','rave']);
  });
});
