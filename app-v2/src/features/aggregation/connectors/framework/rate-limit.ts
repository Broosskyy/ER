import type { SourceConnectorRateLimitConfig } from '@/features/aggregation/connectors/framework/config';

export interface RateLimitAcquisitionResult {
  waitedMs: number;
  rateLimited: boolean;
}

export class SourceConnectorRateLimiter {
  private readonly requestTimestamps = new Map<string, number[]>();
  private readonly activeRequests = new Map<string, number>();
  private readonly cooldownUntil = new Map<string, number>();

  async acquire(connectorKey: string, config: SourceConnectorRateLimitConfig): Promise<RateLimitAcquisitionResult> {
    const now = Date.now();
    const cooldownUntil = this.cooldownUntil.get(connectorKey) ?? 0;
    let waitedMs = 0;

    if (cooldownUntil > now) {
      waitedMs = cooldownUntil - now;
      await delay(waitedMs);
    }

    await this.waitForConcurrencySlot(connectorKey, config.concurrentRequests);

    const timestamps = this.requestTimestamps.get(connectorKey) ?? [];
    const windowStart = Date.now() - 60_000;
    const recent = timestamps.filter((timestamp) => timestamp >= windowStart);

    if (recent.length >= config.burstLimit) {
      const waitMs = config.cooldownMs;
      this.cooldownUntil.set(connectorKey, Date.now() + waitMs);
      await delay(waitMs);
      waitedMs += waitMs;
    } else if (recent.length >= config.requestsPerMinute) {
      const oldest = recent[0] ?? Date.now();
      const waitMs = Math.max(config.cooldownMs, oldest + 60_000 - Date.now());
      this.cooldownUntil.set(connectorKey, Date.now() + waitMs);
      await delay(waitMs);
      waitedMs += waitMs;
    }

    const refreshed = (this.requestTimestamps.get(connectorKey) ?? []).filter(
      (timestamp) => timestamp >= Date.now() - 60_000,
    );
    refreshed.push(Date.now());
    this.requestTimestamps.set(connectorKey, refreshed);
    this.incrementActive(connectorKey);

    return {
      waitedMs,
      rateLimited: waitedMs > 0,
    };
  }

  release(connectorKey: string): void {
    const current = this.activeRequests.get(connectorKey) ?? 0;
    if (current <= 1) {
      this.activeRequests.delete(connectorKey);
      return;
    }
    this.activeRequests.set(connectorKey, current - 1);
  }

  reset(connectorKey?: string): void {
    if (connectorKey) {
      this.requestTimestamps.delete(connectorKey);
      this.activeRequests.delete(connectorKey);
      this.cooldownUntil.delete(connectorKey);
      return;
    }
    this.requestTimestamps.clear();
    this.activeRequests.clear();
    this.cooldownUntil.clear();
  }

  private async waitForConcurrencySlot(connectorKey: string, concurrentRequests: number): Promise<void> {
    while ((this.activeRequests.get(connectorKey) ?? 0) >= concurrentRequests) {
      await delay(25);
    }
  }

  private incrementActive(connectorKey: string): void {
    this.activeRequests.set(connectorKey, (this.activeRequests.get(connectorKey) ?? 0) + 1);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const sourceConnectorRateLimiter = new SourceConnectorRateLimiter();
