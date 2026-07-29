import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type { WebsiteStrategyKey } from '@/features/aggregation/connectors/website/types';
import type { WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import type { WebsiteExtractionStrategy } from '@/features/aggregation/connectors/website/strategy-types';
import {
  customWebsiteAdapterStrategy,
  eventDetailPageWebsiteStrategy,
  htmlSelectorWebsiteStrategy,
} from '@/features/aggregation/connectors/website/html-strategies';
import {
  embeddedJsonWebsiteStrategy,
  jsonLdWebsiteStrategy,
} from '@/features/aggregation/connectors/website/strategies';

export const WEBSITE_STRATEGIES: WebsiteExtractionStrategy[] = [
  jsonLdWebsiteStrategy,
  embeddedJsonWebsiteStrategy,
  htmlSelectorWebsiteStrategy,
  eventDetailPageWebsiteStrategy,
  customWebsiteAdapterStrategy,
];

const DEFAULT_PRIORITY: WebsiteStrategyKey[] = [
  'json_ld',
  'embedded_json',
  'html_selector',
  'event_detail_page',
  'custom_adapter',
];

export function selectWebsiteStrategy(
  document: WebsiteDocument,
  config: WebsiteConnectorConfig,
): WebsiteExtractionStrategy {
  if (config.preferredStrategy) {
    const preferred = WEBSITE_STRATEGIES.find((strategy) => strategy.key === config.preferredStrategy);
    if (preferred) {
      return preferred;
    }
  }

  if (config.autoSelectStrategy === false && config.preferredStrategy) {
    const forced = WEBSITE_STRATEGIES.find((strategy) => strategy.key === config.preferredStrategy);
    if (forced) {
      return forced;
    }
  }

  const ranked = WEBSITE_STRATEGIES
    .map((strategy) => ({
      strategy,
      detect: strategy.detect(document, config),
    }))
    .filter((entry) => entry.detect.confidence > 0)
    .sort((left, right) => {
      const leftPriority = DEFAULT_PRIORITY.indexOf(left.strategy.key);
      const rightPriority = DEFAULT_PRIORITY.indexOf(right.strategy.key);
      if (right.detect.confidence !== left.detect.confidence) {
        return right.detect.confidence - left.detect.confidence;
      }
      return leftPriority - rightPriority;
    });

  return ranked[0]?.strategy ?? jsonLdWebsiteStrategy;
}

export function getWebsiteStrategy(key: WebsiteStrategyKey): WebsiteExtractionStrategy | undefined {
  return WEBSITE_STRATEGIES.find((strategy) => strategy.key === key);
}
