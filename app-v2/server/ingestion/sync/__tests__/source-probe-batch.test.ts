import { describe, expect, it } from 'vitest';
import { planSourceProbeWaves } from '../source-probe-batch';

const urls = [
  { url: 'https://rausgegangen.de/koeln/' },
  { url: 'https://rausgegangen.de/bonn/' },
  { url: 'https://bootshaus-club.ticket.io/' },
  { url: 'https://stadtgarten.ticket.io/' },
  { url: 'https://zakk.de/events' },
  { url: 'https://rausgegangen.de/essen/' },
  { url: 'https://nachtresidenz.de/events/' },
];

describe('bounded source probe waves', () => {
  it('checks different hosts in parallel and serializes each provider host', () => {
    const waves = planSourceProbeWaves(urls, 3);
    expect(waves.every((w) => w.length <= 3)).toBe(true);
    for (const wave of waves) {
      const hosts = wave.map(({target}) => new URL(target.url).hostname);
      expect(new Set(hosts).size).toBe(hosts.length);
    }
    expect(waves.flat().map((item) => item.index).sort((a, b) => a - b))
      .toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(waves.length).toBeLessThan(urls.length);
  });
  it('returns empty waves for empty input and refuses unbounded concurrency', () => {
    expect(planSourceProbeWaves([])).toEqual([]);
    expect(() => planSourceProbeWaves(urls, 0)).toThrow('invalid_probe_concurrency');
  });
});
