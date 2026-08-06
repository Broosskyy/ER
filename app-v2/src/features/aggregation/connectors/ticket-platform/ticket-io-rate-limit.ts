const DEFAULT_MIN_INTERVAL_MS = 4_000;

export class TicketIoRequestRateLimiter {
  private lastRequestAt = 0;

  constructor(private readonly minIntervalMs: number = DEFAULT_MIN_INTERVAL_MS) {}

  static fromRequestsPerMinute(requestsPerMinute?: number): TicketIoRequestRateLimiter {
    if (!requestsPerMinute || requestsPerMinute <= 0) {
      return new TicketIoRequestRateLimiter(DEFAULT_MIN_INTERVAL_MS);
    }
    return new TicketIoRequestRateLimiter(Math.ceil(60_000 / requestsPerMinute));
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}
