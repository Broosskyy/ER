import {describe,expect,it} from 'vitest';
import {isNonPerformanceEventFormat} from '../format-exclusions';
describe('electronic music event format',()=>{
  it('excludes a production lesson rather than counting electronic music training as a rave',()=>{
    expect(isNonPerformanceEventFormat('Electronic Adventure//Musikproduktion',
      'Komponiert eure eigenen Beats und Melodien mit Synthesizern und Musikproduktions-Software')).toBe(true);
  });
  it('excludes a clothes-swap market with DJs but retains ordinary DJ nights',()=>{
    expect(isNonPerformanceEventFormat('Techno & Tauschen',
      'Ausgesuchte Secondhand-Sachen treffen auf DJ-Sets und Kleiderstapel')).toBe(true);
    expect(isNonPerformanceEventFormat('Hard Techno Rave',
      'Eine Nacht mit DJs, satten Kicks, Club Dancefloor und einem Flohmarkt am Eingang')).toBe(false);
  });
  it('does not block a rave just for mentioning a workshop or travel information',()=>{
    expect(isNonPerformanceEventFormat('Hard Techno Nacht',
      'DJ-Workshop am Vortag, heute rave mit drei Live-Acts')).toBe(false);
  });
});
