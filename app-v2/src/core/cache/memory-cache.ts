/**
 * In-memory cache layer for repository read-through caching.
 * Cloud → Cache → UI
 */
export class MemoryCache<T> {
  private value: T | undefined;
  private expiresAt = 0;

  constructor(private readonly ttlMs: number = 5 * 60 * 1000) {}

  get(): T | undefined {
    if (this.value === undefined || Date.now() > this.expiresAt) {
      return undefined;
    }
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    this.expiresAt = Date.now() + this.ttlMs;
  }

  invalidate(): void {
    this.value = undefined;
    this.expiresAt = 0;
  }
}
