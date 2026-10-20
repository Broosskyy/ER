import {describe,expect,it} from 'vitest';
import {pickScheduledRausgegangenSourceUrls} from '../daily-rausgegangen-scope';

describe('bounded rotating existing Rausgegangen source refresher',()=>{
  const urls=Array.from({length:35},(_,i)=>`https://rausgegangen.de/events/event-${i}/`);
  it('rotates saved event sources across days without exceeding 24 daily',()=>{
    const first=pickScheduledRausgegangenSourceUrls(urls,0);
    const next=pickScheduledRausgegangenSourceUrls(urls,1);
    expect(first).toHaveLength(24);
    expect(next).toHaveLength(24);
    expect(first[0]).not.toBe(next[0]);
    expect(new Set([...first,...next]).size).toBe(25);
  });
  it('ignores source impostors, credentials and malformed paths',()=>{
    expect(pickScheduledRausgegangenSourceUrls([
      'https://evil.example.com/events/something/',
      'https://user:pw@rausgegangen.de/events/something/',
      'https://rausgegangen.de/login/',
      'https://rausgegangen.de/events/valid/',
      'https://rausgegangen.de/events/valid/',
    ],3)).toEqual(['https://rausgegangen.de/events/valid/']);
  });
});
