import { describe, expect, it } from 'vitest';
import { extractZakkPublishedTechnoBilling } from '../explicit-techno-lineup';

describe('verified zakk electronic floor billing',()=>{
  it('retains only names explicitly billed on the techno floor',()=>{
    expect(extractZakkPublishedTechnoBilling(
      'Im Club gibt’s Techno mit Addctd & Luuk de Keizer: Dunkel, treibend.'
    ).map(x=>x.displayName)).toEqual(['Addctd','Luuk de Keizer']);
  });
  it('omits unknown lineups and nonspecific marketing descriptions',()=>{
    expect(extractZakkPublishedTechnoBilling('Line-up folgt in Kürze.')).toEqual([]);
    expect(extractZakkPublishedTechnoBilling('Feiert Techno mit viel guter Stimmung.')).toEqual([]);
  });
});
