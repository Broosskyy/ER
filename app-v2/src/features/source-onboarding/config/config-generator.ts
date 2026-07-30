import type { SourceDiscoveryResult } from '@/features/source-onboarding/discovery/source-discovery-engine';
import type { DeclarativeSourceConfig } from '@/features/source-onboarding/domain/types';

const CONFIG_VERSION = 1;

function mapStrategy(strategy: string | undefined): string {
  switch (strategy) {
    case 'json_ld':
      return 'json_ld';
    case 'event_detail_page':
      return 'html_cards';
    case 'embedded_json':
      return 'embedded_json';
    case 'html_selector':
      return 'html_cards';
    default:
      return 'html_cards';
  }
}

export function generateDeclarativeSourceConfig(input: {
  listUrl: string;
  discovery: SourceDiscoveryResult;
}): DeclarativeSourceConfig {
  const strategyStep = input.discovery.steps.find((step) => step.step === 'recommended_strategy');
  const strategy = mapStrategy(strategyStep?.result);
  const platform = input.discovery.detectedPlatform;
  const sourceType =
    input.discovery.detectedSourceType ??
    (platform === 'ticket_io' || platform === 'ticket_king' ? 'ticket_platform' : 'website');

  return {
    version: CONFIG_VERSION,
    sourceType,
    platform,
    acquisition: {
      listUrl: input.discovery.document?.finalUrl ?? input.listUrl,
      detailUrlPattern: '/event/{slug}/',
      strategy,
      pagination: input.discovery.document && /mehr laden|load more/i.test(input.discovery.document.html)
        ? 'load_more'
        : 'page_parameter',
    },
    selectors: {},
    normalization: {
      timezone: 'Europe/Berlin',
      country: 'DE',
    },
    scope: {
      mode: 'electronic_music',
      allowedVenues: [],
      allowedOrganizers: [],
    },
    schedule: {
      intervalMinutes: 360,
    },
  };
}

export function validateDeclarativeSourceConfig(config: DeclarativeSourceConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.acquisition.listUrl) {
    errors.push('acquisition.listUrl is required.');
  }
  if (!config.acquisition.strategy) {
    errors.push('acquisition.strategy is required.');
  }
  if (config.version < 1) {
    errors.push('config version must be >= 1.');
  }
  if (JSON.stringify(config).includes('function(') || JSON.stringify(config).includes('eval(')) {
    errors.push('Config must not contain executable code.');
  }
  if (config.scope.mode !== 'electronic_music') {
    warnings.push('Scope mode is not electronic_music.');
  }

  return { valid: errors.length === 0, errors, warnings };
}
