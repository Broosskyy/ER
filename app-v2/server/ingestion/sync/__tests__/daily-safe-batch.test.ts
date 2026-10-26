import {describe,expect,it} from 'vitest';
import {selectDailySafeBatch} from '../daily-safe-batch';
import {createEmptySyncRunCounters,type SyncRunResult,type SyncEventProcessingResult} from '../types';

function candidate(i:number,overrides:Partial<SyncEventProcessingResult>={}):SyncEventProcessingResult {
  return {sourceEventKey:'source:'+i,officialUrl:'https://example.com/e/'+i,
    outcome:'planned_only',identityDecision:'no_match',...overrides};
}
function preview(events:SyncEventProcessingResult[]):SyncRunResult {
  return {
    run:{runId:'run-1',connectorId:'bootshaus-official',
      mode:'dry_run',triggerType:'scheduled',status:'partially_succeeded',
      startedAt:'2026-10-20T08:00:00Z',
      counters:{...createEmptySyncRunCounters(),discovered:events.length,
        fetched:events.length,parsed:events.length,
        candidates:events.length,planned:events.length},
      errorCategories:[],retryCount:0},
    eventResults:events,
    health:{connectorId:'bootshaus-official',enabled:true,
      consecutiveFailures:0,lastDiscoveredCount:events.length,lastParsedCount:events.length,
      lastAppliedCount:0,healthStatus:'healthy'},
  };
}
describe('daily safe public event selection',()=>{
  it('keeps new Rausgegangen discoveries in review and only permits verified existing bindings',()=>{
    const events=[
      candidate(1),
      candidate(2,{matchedEventId:'real-2',verifiedExistingSourceBinding:true}),
      candidate(3,{matchedEventId:'real-3',verifiedExistingSourceBinding:false}),
      candidate(4,{matchedEventId:'real-4',verifiedExistingSourceBinding:true,outcome:'noop'}),
    ];
    const selection=selectDailySafeBatch(preview(events),
      {newEvents:0,existingUpdates:12},{existingOnly:true});
    expect(selection.selectedNewEvents).toBe(0);
    expect(selection.deferredNewEvents).toBe(1);
    expect(selection.selectedExistingUpdates).toBe(1);
    expect(selection.selectedExistingNoops).toBe(1);
    expect(selection.quarantinedReview).toBe(1);
    expect([...selection.bindings.keys()]).toEqual(['source:2','source:4']);
  });
  it('prefers verified ticket price, sale status and checkout over source-only fallback',()=>{
    const batch=preview([
      candidate(1,{ticketEvidencePriority:0,newEventSourceReady:true}),
      candidate(2,{ticketEvidencePriority:3,newEventSourceReady:true}),
      candidate(3,{ticketEvidencePriority:2,newEventSourceReady:true}),
      candidate(4,{ticketEvidencePriority:1,newEventSourceReady:false}),
    ]);
    batch.run.connectorId='rausgegangen-discovery';
    const selected=selectDailySafeBatch(batch,{newEvents:2,existingUpdates:12});
    expect([...selected.bindings.keys()]).toEqual(['source:2','source:3']);
    expect(selected.deferredNewEvents).toBe(1);
    expect(selected.quarantinedReview).toBe(1);
  });
  it('allows source-only as last resort without inventing ticket values',()=>{
    const batch=preview([candidate(1,{ticketEvidencePriority:0,newEventSourceReady:true})]);
    batch.run.connectorId='rausgegangen-discovery';
    const selected=selectDailySafeBatch(batch,{newEvents:8,existingUpdates:12});
    expect(selected.selectedNewEvents).toBe(1);
    expect(selected.bindings.get('source:1')).toBe('https://example.com/e/1');
  });
  it('admits sixteen independently verified Rausgegangen events and defers the rest',()=>{
    const batch=preview(Array.from({length:19},(_,i)=>
      candidate(i,{newEventSourceReady:true,ticketEvidencePriority:i%4})));
    batch.run.connectorId='rausgegangen-discovery';
    const selection=selectDailySafeBatch(batch,{newEvents:16,existingUpdates:12});
    expect(selection.selectedNewEvents).toBe(16);
    expect(selection.deferredNewEvents).toBe(3);
    expect(selection.quarantinedReview).toBe(0);
    expect(selection.bindings.size).toBe(16);
  });
  it('caps verified inserts but retains safe matched updates and ticket-only noops',()=>{
    const events=[
      ...Array.from({length:16},(_,i)=>candidate(i)),
      candidate(30,{matchedEventId:'existing-1'}),
      candidate(31,{matchedEventId:'existing-2',outcome:'noop'}),
      candidate(32,{outcome:'rejected'}),
      candidate(33,{outcome:'review_required',identityDecision:'possible_match'}),
    ];
    const result=selectDailySafeBatch(preview(events));
    expect(result.selectedNewEvents).toBe(8);
    expect(result.deferredNewEvents).toBe(8);
    expect(result.selectedExistingUpdates).toBe(1);
    expect(result.selectedExistingNoops).toBe(1);
    expect(result.quarantinedRejected).toBe(1);
    expect(result.quarantinedReview).toBe(1);
    expect(result.bindings.size).toBe(10);
    expect(result.bindings.has('source:32')).toBe(false);
  });
  it('quarantines duplicated keys even when URLs differ',()=>{
    const first=candidate(1);
    const dup=candidate(1,{officialUrl:'https://example.com/e/other'});
    const result=selectDailySafeBatch(preview([first,dup]));
    expect(result.bindings.size).toBe(0);
    expect(result.duplicateBindingKeys).toBe(2);
  });
  it('rejects a partial/non-scheduled preflight instead of guessing',()=>{
    const partial=preview([candidate(1)]);
    partial.run.counters.planned=2;
    expect(()=>selectDailySafeBatch(partial)).toThrow('daily_batch_not_a_complete_scheduled_preflight');
  });
  it('never accepts an unverified HTTP or unknown identity source',()=>{
    const result=selectDailySafeBatch(preview([
      candidate(1,{officialUrl:'http://example.com/events'}),
      candidate(2,{identityDecision:'review_required'}),
    ]));
    expect(result.bindings.size).toBe(0);
    expect(result.quarantinedReview).toBe(2);
  });
});
