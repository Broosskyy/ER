function normalizeUrl(url: string): string {
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
    const key = normalizeUrl(url);
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.hits += 1;
    }
    return value;
  }

  set(url: string, value: T): void {
    this.entries.set(normalizeUrl(url), value);
  }

  has(url: string): boolean {
    return this.entries.has(normalizeUrl(url));
  }

  getCacheHits(): number {
    return this.hits;
  }

  getUniqueUrls(): number {
    return this.entries.size;
  }
}
