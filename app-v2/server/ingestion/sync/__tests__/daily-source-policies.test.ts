import {describe,expect,it} from 'vitest';
import {getDailySourcePolicy,DAILY_SOURCE_POLICIES} from '../daily-source-policies';
import {isStagingScheduledConnectorId} from '../scheduler-boundary';

describe('daily source onboarding contract',()=>{
  it('permits bounded new Rausgegangen events after source + identity validation',()=>{
    const policy=getDailySourcePolicy('rausgegangen-discovery');
    expect(policy).toMatchObject({
      writeScope:'upsert',maxNewEvents:8,minimumParsed:1,
    });
    expect(isStagingScheduledConnectorId('rausgegangen-discovery')).toBe(true);
  });
  it('certifies zakk electronic-only official source with bounded new inserts',()=>{
    expect(getDailySourcePolicy('zakk-official')).toMatchObject({
      writeScope:'upsert',maxNewEvents:6,minimumParsed:1,
    });
    expect(isStagingScheduledConnectorId('zakk-official')).toBe(true);
  });
  it('certifies electronic-only Stadtgarten in bounded batches',()=>{
    expect(getDailySourcePolicy('stadtgarten-official')).toMatchObject({
      writeScope:'upsert',maxNewEvents:8,minimumParsed:1,
    });
    expect(isStagingScheduledConnectorId('stadtgarten-official')).toBe(true);
  });
  it('does not auto-enable newly registered but uncertified connectors',()=>{
    expect(getDailySourcePolicy('some-future-ticket-provider')).toBeUndefined();
    expect(isStagingScheduledConnectorId('some-future-ticket-provider')).toBe(false);
  });
  it('ensures every whitelisted connector has limited writes',()=>{
    for(const policy of Object.values(DAILY_SOURCE_POLICIES)){
      expect(policy.maxNewEvents).toBeLessThanOrEqual(8);
      expect(policy.maxExistingUpdates).toBeLessThanOrEqual(25);
      expect(policy.maxTicketChanges).toBeLessThanOrEqual(25);
      expect(policy.minimumParsed).toBeGreaterThan(0);
      expect(policy.maxDetailPages).toBeLessThanOrEqual(40);
    }
  });
});
