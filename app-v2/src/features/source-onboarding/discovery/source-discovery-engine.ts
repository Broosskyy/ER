import { detectWebsiteDocument } from '@/features/aggregation/connectors/website/detection';
import type { WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';

import type { DiscoveryEvidence } from '@/features/source-onboarding/domain/types';
import { detectPlatformFromHostname } from '@/features/source-onboarding/registry/platform-registry';
import { SOURCE_DISCOVERY_MAX_REDIRECTS } from '@/features/source-onboarding/security/url-normalizer';

export interface SourceDiscoveryInput {
  url: string;
  hostname: string;
}

export interface SourceDiscoveryResult {
  steps: DiscoveryEvidence[];
  warnings: string[];
  detectedPlatform?: string;
  detectedFramework?: string;
  detectedSourceType?: string;
  confidence: number;
  document?: WebsiteDocument;
}

function pushStep(
  steps: DiscoveryEvidence[],
  step: DiscoveryEvidence,
): void {
  steps.push(step);
}

export async function fetchDiscoveryDocument(url: string): Promise<WebsiteDocument> {
  let currentUrl = url;
  const redirectChain: string[] = [];

  for (let attempt = 0; attempt <= SOURCE_DISCOVERY_MAX_REDIRECTS; attempt += 1) {
    const response = await defaultHttpClient.fetch(currentUrl, {
      headers: {
        'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; source-discovery)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || attempt >= SOURCE_DISCOVERY_MAX_REDIRECTS) {
        throw new Error(`Too many redirects while probing ${url}.`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      redirectChain.push(currentUrl);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Discovery fetch failed (${response.status}) for ${currentUrl}`);
    }

    const html = await response.text();
    return {
      requestedUrl: url,
      finalUrl: currentUrl,
      statusCode: response.status,
      contentType: response.headers.get('content-type') ?? 'text/html',
      html,
      responseSize: html.length,
      fetchedAt: new Date().toISOString(),
      redirectChain,
    };
  }

  throw new Error(`Discovery fetch exhausted redirects for ${url}.`);
}

export async function runSourceDiscovery(input: SourceDiscoveryInput): Promise<SourceDiscoveryResult> {
  const steps: DiscoveryEvidence[] = [];
  const warnings: string[] = [];

  const knownPlatform = detectPlatformFromHostname(input.hostname);
  if (knownPlatform) {
    pushStep(steps, {
      step: 'known_platform',
      result: knownPlatform.id,
      confidence: 0.95,
      evidence: `Hostname matched platform registry entry ${knownPlatform.id}.`,
    });
  }

  const document = await fetchDiscoveryDocument(input.url);
  pushStep(steps, {
    step: 'fetch',
    result: 'success',
    confidence: 1,
    evidence: `Fetched ${document.responseSize} bytes from ${document.finalUrl}.`,
    warnings: document.redirectChain.length > 0 ? ['Redirects followed during discovery.'] : undefined,
  });

  const report = detectWebsiteDocument(document);
  for (const signal of report.detectedFormats) {
    pushStep(steps, {
      step: `signal:${signal.format}`,
      result: 'detected',
      confidence: signal.confidence,
      evidence: `Detected ${signal.format} (${signal.count ?? 1} matches).`,
    });
  }

  if (report.recommendedStrategy) {
    pushStep(steps, {
      step: 'recommended_strategy',
      result: report.recommendedStrategy,
      confidence:
        report.detectedStrategies.find((entry) => entry.key === report.recommendedStrategy)?.confidence ??
        0.5,
      evidence: `Recommended next action: ${report.recommendedNextAction}.`,
    });
  }
  const html = document.html.toLowerCase();
  let detectedFramework: string | undefined;
  if (/tribe-events|tec-events|the events calendar/i.test(document.html)) {
    detectedFramework = 'wordpress_tribe';
    pushStep(steps, {
      step: 'framework',
      result: 'wordpress_tribe',
      confidence: 0.9,
      evidence: 'Tribe Events markers found in HTML.',
    });
  } else if (/wp-content|wordpress/i.test(html)) {
    detectedFramework = 'wordpress';
    pushStep(steps, {
      step: 'framework',
      result: 'wordpress',
      confidence: 0.75,
      evidence: 'WordPress markers found in HTML.',
    });
  }

  if (/nacht-manager\.de\/ticketing/i.test(document.html)) {
    pushStep(steps, {
      step: 'ticket_embed',
      result: 'nacht_manager',
      confidence: 0.85,
      evidence: 'Night Manager ticketing embed detected.',
    });
  }

  if (/cloudflare|cf-chl|attention required/i.test(html)) {
    warnings.push('Possible bot protection detected.');
  }

  const detectedPlatform = knownPlatform?.id ?? (detectedFramework === 'wordpress_tribe' ? 'wordpress_tribe' : undefined);
  const detectedSourceType =
    knownPlatform?.id === 'ticket_io' || knownPlatform?.id === 'ticket_king'
      ? 'ticket_platform'
      : knownPlatform?.id === 'bootshaus_website'
        ? 'website'
        : report.recommendedStrategy === 'json_ld'
          ? 'website'
          : 'website';

  const confidence = Math.min(
    1,
    Math.max(
      knownPlatform ? 0.9 : 0,
      ...report.detectedStrategies.map((entry) => entry.confidence),
      ...steps.map((step) => step.confidence),
    ),
  );

  return {
    steps,
    warnings: [...warnings, ...report.warnings],
    detectedPlatform,
    detectedFramework,
    detectedSourceType,
    confidence,
    document,
  };
}
