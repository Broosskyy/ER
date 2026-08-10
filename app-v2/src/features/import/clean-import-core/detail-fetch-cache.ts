export function normalizeDetailUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

export class DetailFetchCache<T> {
  private readonly entries = new Map<string, T>();
  private hits = 0;

  get(url: string): T | undefined {
    const value = this.entries.get(normalizeDetailUrl(url));
    if (value !== undefined) {
      this.hits += 1;
    }
    return value;
  }

  set(url: string, value: T): void {
    this.entries.set(normalizeDetailUrl(url), value);
  }

  getHitCount(): number {
    return this.hits;
  }
}
