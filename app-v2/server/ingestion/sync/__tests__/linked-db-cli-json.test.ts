import { describe, expect, it } from 'vitest';
import { parseLinkedQueryOutput, parseSupabaseProjectsList } from '../linked-db';

describe('linked Supabase CLI contract', () => {
  it('parses JSON results explicitly rather than relying on a pretty table', () => {
    expect(parseSupabaseProjectsList(JSON.stringify([
      {id:'gnkjzinwvmrxcadwebhv',name:'Eternal-Rave',linked:true},
    ]))).toEqual([{ref:'gnkjzinwvmrxcadwebhv',name:'Eternal-Rave',linked:true}]);
    expect(parseSupabaseProjectsList(JSON.stringify({
      projects:[{ref:'gnkjzinwvmrxcadwebhv',name:'Eternal-Rave'}],
    }))[0]?.ref).toBe('gnkjzinwvmrxcadwebhv');
  });
  it('rejects HTML/table-like CLI output, never invents a linked DB ref', () => {
    expect(()=>parseSupabaseProjectsList('REF | NAME')).toThrow();
    expect(()=>parseSupabaseProjectsList('{}')).toThrow('supabase_projects_invalid_json_shape');
  });
  it('unwraps JSON rows returned by db query', () => {
    expect(parseLinkedQueryOutput('{"rows":[{"payload":{"ok":true}}]}'))
      .toEqual({ok:true});
  });
});
