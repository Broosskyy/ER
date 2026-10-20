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
