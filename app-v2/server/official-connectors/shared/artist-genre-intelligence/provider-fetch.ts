const USER_AGENT = 'EternalRave/0.2.0 (m9.3b.2e-artist-intelligence; contact@eternal-rave.local)';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_JSON_BYTES = 512_000;
const MAX_RETRIES = 2;

export type ProviderFetchStatus = 'success' | 'no_result' | 'rate_limited' | 'timeout' | 'failure';

export interface ProviderFetchResult<T> {
  status: ProviderFetchStatus;
  data?: T;
  httpStatus?: number;
  retries: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchProviderJson<T>(url: string): Promise<ProviderFetchResult<T>> {
  if (!url.startsWith('https://')) {
    return { status: 'failure', retries: 0 };
  }
  let retries = 0;
  while (retries <= MAX_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'follow',
      });
      if (response.status === 429) {
        retries += 1;
        if (retries > MAX_RETRIES) {
          return { status: 'rate_limited', httpStatus: 429, retries };
        }
        await sleep(1500 * retries);
        continue;
      }
      if (!response.ok) {
        return { status: 'failure', httpStatus: response.status, retries };
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return { status: 'failure', httpStatus: response.status, retries };
      }
      const text = await response.text();
      if (text.length > MAX_JSON_BYTES) {
        return { status: 'failure', retries };
      }
      return { status: 'success', data: JSON.parse(text) as T, httpStatus: response.status, retries };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      retries += 1;
      if (retries > MAX_RETRIES) {
        return { status: isTimeout ? 'timeout' : 'failure', retries };
      }
      await sleep(1200 * retries);
    } finally {
      clearTimeout(timeout);
    }
  }
  return { status: 'failure', retries };
}

export const PROVIDER_THROTTLE_MS = 1100;
