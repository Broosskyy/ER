/**
 * Read-only source probes may run in parallel across different providers.
 * Keep requests to the SAME hostname sequential to avoid bursts and blocks.
 * A wave finishes before the next starts, bounding concurrent requests.
 */
export function planSourceProbeWaves<T extends { url: string }>(
  targets: readonly T[],
  maxConcurrency = 4,
): Array<Array<{ index: number; target: T }>> {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error('invalid_probe_concurrency');
  }
  const pending = targets.map((target, index) => ({ target, index }));
  const waves: Array<Array<{ index: number; target: T }>> = [];
  while (pending.length > 0) {
    const wave: Array<{ index: number; target: T }> = [];
    const hosts = new Set<string>();
    for (let i = 0; i < pending.length && wave.length < maxConcurrency;) {
      const item = pending[i]!; // i is bounded by pending.length
      // Keep invalid configured URLs isolated; fetchProbe reports their error.
      let host: string;
      try {
        host = new URL(item.target.url).hostname.toLowerCase();
      } catch {
        host = 'invalid-url';
      }
      if (hosts.has(host)) {
        i += 1;
        continue;
      }
      hosts.add(host);
      wave.push(item);
      pending.splice(i, 1);
    }
    waves.push(wave);
  }
  return waves;
}
