import {describe,expect,it} from 'vitest';
import {isZakkElectronicEvent} from '../electronic-scope';

describe('zakk electronic-only discovery',()=>{
  it('includes a mixed-floor event with a verified techno floor',()=>{
    expect(isZakkElectronicEvent({title:'Schamlos Halloween',
      descriptionClean:'Three floors with Techno hosted by two DJs and other styles.'})).toBe(true);
  });
  it('excludes rock, pop, all-age and generic party items',()=>{
    for(const title of ['Rock History','Back to the 80s','Halloween Party','Nineties2000']){
      expect(isZakkElectronicEvent({title,descriptionClean:'Great rock, pop and classics'})).toBe(false);
    }
  });
});
