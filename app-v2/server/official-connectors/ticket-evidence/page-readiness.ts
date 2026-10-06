export type ProviderPageReadiness =
  | 'loading'
  | 'public_event_page_ready'
  | 'security_challenge_only'
  | 'event_page_partial'
  | 'provider_error';

const CHALLENGE_PATTERN = /Nur einen Moment|Just a moment|Hang on a sec|cf-browser|Security check|altcha/i;
const EVENT_READY_PATTERN =
  /application\/ld\+json|MusicEvent|"@type"\s*:\s*"Event"|data-product|product-price|ticket-category|select-quantity/i;

export function classifyProviderPageReadiness(body: string, contentType = 'text/html'): ProviderPageReadiness {
  if (!body || body.length < 200) {
    return 'loading';
  }
  const hasChallenge = CHALLENGE_PATTERN.test(body);
  const hasEventEvidence = EVENT_READY_PATTERN.test(body);
  if (hasChallenge && !hasEventEvidence) {
    return 'security_challenge_only';
  }
  if (hasChallenge && hasEventEvidence) {
    return 'event_page_partial';
  }
  if (hasEventEvidence) {
    return 'public_event_page_ready';
  }
  if (contentType.includes('json')) {
    return 'public_event_page_ready';
  }
  return 'provider_error';
}

export function isProviderPageReady(readiness: ProviderPageReadiness): boolean {
  return readiness === 'public_event_page_ready' || readiness === 'event_page_partial';
}
