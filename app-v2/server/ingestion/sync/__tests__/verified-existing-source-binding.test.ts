import {describe,expect,it} from 'vitest';
import {hasVerifiedExistingSourceBinding} from '../verified-existing-source-binding';
import type {EventWritePlan} from '../../types/event-candidate';

const url='https://rausgegangen.de/events/test-event-0/';
const key='rausgegangen:test-event-0';
const base={
  resolvedEventId:'event-1',
  existingSource:{eventId:'event-1',sourceUrl:url,sourceEventKey:key,sourceId:'source-1'},
  candidate:{origin:{kind:'official_connector',sourceEventKey:key,officialUrl:url}},
} as unknown as EventWritePlan;

describe('public existing-only source-event update binding',()=>{
  it('accepts a proven existing exact source URL and event ID',()=>{
    expect(hasVerifiedExistingSourceBinding(base)).toBe(true);
  });
  it('blocks title/date matches without exact original source binding',()=>{
    expect(hasVerifiedExistingSourceBinding({...base,existingSource:undefined})).toBe(false);
    expect(hasVerifiedExistingSourceBinding({...base,resolvedEventId:'another-event'})).toBe(false);
    expect(hasVerifiedExistingSourceBinding({
      ...base, existingSource:{...base.existingSource!,sourceUrl:'https://rausgegangen.de/events/different-0/'},
    })).toBe(false);
    expect(hasVerifiedExistingSourceBinding({
      ...base,candidate:{...base.candidate,origin:{kind:'official_connector',sourceEventKey:'rausgegangen:another',officialUrl:url}},
    } as EventWritePlan['candidate']})).toBe(false);
  });
});
