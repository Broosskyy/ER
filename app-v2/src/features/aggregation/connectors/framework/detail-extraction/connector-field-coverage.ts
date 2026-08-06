import type { SourceRecord } from '@/data/types/records';
import type { SourceRegistryEntry } from '@/features/sources/domain/source-registry';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type { TicketPlatformConnectorConfig } from '@/features/aggregation/connectors/ticket-platform/types';

import {
  type DetailExtractionCapability,
  resolveDetailExtractionCapability,
} from './detail-extraction-lifecycle';

export type FieldCoverageRating = 1 | 2 | 3 | 4 | 5;

export interface ConnectorFieldCoverage {
  field: string;
  rating: FieldCoverageRating;
  source: 'list' | 'detail' | 'structured' | 'api' | 'none';
  notes?: string;
}

export interface ConnectorCapabilityProfile {
  sourceId: string;
  displayName: string;
  connectorKey: string;
  sourceType: string;
  detailCapability: DetailExtractionCapability;
  fieldCoverage: ConnectorFieldCoverage[];
  listFields: string[];
  detailFields: string[];
  importedFields: string[];
  lostFields: string[];
}

function rating(level: FieldCoverageRating): FieldCoverageRating {
  return level;
}

function websiteProfile(sourceId: string, displayName: string, config: WebsiteConnectorConfig): ConnectorCapabilityProfile {
  const maxDetailPages = config.limits?.maxDetailPages ?? 0;
  const detailCapability = resolveDetailExtractionCapability({
    connectorKey: 'club_website',
    sourceType: 'website',
    maxDetailPages,
    preferredStrategy: config.preferredStrategy,
    detailStrategy: config.eventDetailPage?.detailStrategy,
  });

  const listFields = ['title', 'startDate', 'image', 'detailUrl'];
  const detailFields =
    maxDetailPages > 0
      ? ['description', 'genres', 'ticketLinks', 'organizer', 'artists']
      : [];
  const importedFields = [...listFields, ...detailFields.filter((field) => detailFields.includes(field))];
  const lostFields =
    maxDetailPages > 0
      ? []
      : ['description', 'genres', 'lineup', 'extendedVenue', 'socialLinks'];

  const detailSource = maxDetailPages > 0 ? 'detail' : 'none';
  const fieldCoverage: ConnectorFieldCoverage[] = [
    { field: 'title', rating: rating(5), source: 'list' },
    { field: 'startDate', rating: rating(5), source: 'list' },
    { field: 'venue', rating: rating(maxDetailPages > 0 ? 4 : 3), source: 'list', notes: 'Source defaults when missing on list' },
    { field: 'description', rating: rating(maxDetailPages > 0 ? 4 : 1), source: detailSource },
    { field: 'artists', rating: rating(maxDetailPages > 0 ? 3 : 1), source: detailSource },
    { field: 'genres', rating: rating(maxDetailPages > 0 ? 2 : 1), source: detailSource },
    { field: 'ticketUrl', rating: rating(3), source: detailSource, notes: 'Often from detail ticket links' },
    { field: 'image', rating: rating(5), source: 'list' },
    { field: 'organizer', rating: rating(4), source: 'list', notes: 'Source defaults' },
    { field: 'address', rating: rating(maxDetailPages > 0 ? 3 : 2), source: detailSource },
  ];

  return {
    sourceId,
    displayName,
    connectorKey: 'club_website',
    sourceType: 'website',
    detailCapability,
    fieldCoverage,
    listFields,
    detailFields,
    importedFields,
    lostFields,
  };
}

function ticketIoProfile(
  sourceId: string,
  displayName: string,
  config: TicketPlatformConnectorConfig | undefined,
  enrichment: boolean,
): ConnectorCapabilityProfile {
  const maxDetailPages = config?.limits?.maxDetailPages ?? 0;
  const detailCapability = resolveDetailExtractionCapability({
    connectorKey: 'ticket_platform',
    sourceType: 'ticket_platform',
    maxDetailPages,
    preferredStrategy: 'json_ld',
    detailStrategy: 'json_ld',
  });

  const listFields = ['title', 'startDate', 'venue', 'priceText', 'ticketUrl', 'image'];
  const detailFields = ['description', 'lineup', 'ticketPhases', 'availability'];
  const importedFields = enrichment
    ? ['ticketUrl', 'priceText', 'description', 'lineup']
    : [...listFields, ...(maxDetailPages > 0 ? ['description', 'lineup'] : [])];
  const lostFields = maxDetailPages > 0 ? ['genres'] : ['description', 'lineup', 'ticketPhases'];

  const fieldCoverage: ConnectorFieldCoverage[] = [
    { field: 'title', rating: rating(5), source: 'structured' },
    { field: 'startDate', rating: rating(5), source: 'structured' },
    { field: 'venue', rating: rating(4), source: 'structured' },
    { field: 'description', rating: rating(maxDetailPages > 0 ? 4 : 2), source: maxDetailPages > 0 ? 'detail' : 'list' },
    { field: 'artists', rating: rating(maxDetailPages > 0 ? 4 : 2), source: maxDetailPages > 0 ? 'detail' : 'list' },
    { field: 'genres', rating: rating(2), source: 'list', notes: 'Overview text only' },
    { field: 'ticketUrl', rating: rating(5), source: 'structured' },
    { field: 'priceText', rating: rating(5), source: 'list' },
    { field: 'image', rating: rating(3), source: 'list' },
    { field: 'organizer', rating: rating(2), source: 'none' },
    { field: 'address', rating: rating(3), source: 'structured' },
  ];

  return {
    sourceId,
    displayName,
    connectorKey: 'ticket_platform',
    sourceType: 'ticket_platform',
    detailCapability,
    fieldCoverage,
    listFields,
    detailFields,
    importedFields,
    lostFields,
  };
}

export function buildConnectorCapabilityProfile(
  source: SourceRecord | SourceRegistryEntry,
): ConnectorCapabilityProfile {
  const sourceConfig =
    'sourceConfig' in source ? source.sourceConfig : undefined;
  const connectorConfig =
    'connectorConfig' in source ? source.connectorConfig : (sourceConfig as Record<string, unknown> | undefined);
  const configRoot = (sourceConfig ?? connectorConfig) as Record<string, unknown> | undefined;
  const website = configRoot?.website as WebsiteConnectorConfig | undefined;
  const ticketPlatform = configRoot?.ticketPlatform as TicketPlatformConnectorConfig | undefined;
  const publishBehavior = (configRoot?.publishPolicy as { behavior?: string } | undefined)?.behavior;
  const connectorKey =
    ('connectorKey' in source && source.connectorKey) ||
    (sourceConfig?.reference as { connectorKey?: string } | undefined)?.connectorKey ||
    ('sourceType' in source ? source.sourceType : 'club_website');
  const sourceType =
    ('sourceType' in source && typeof source.sourceType === 'string' ? source.sourceType : undefined) ??
    (website ? 'website' : ticketPlatform ? 'ticket_platform' : 'manual');

  if (connectorKey === 'ticket_platform' || sourceType === 'ticket_platform') {
    return ticketIoProfile(
      source.id,
      source.displayName,
      ticketPlatform,
      publishBehavior === 'enrichment',
    );
  }

  return websiteProfile(source.id, source.displayName, website ?? {});
}

export const PRODUCTION_CONNECTOR_SOURCE_IDS = [
  'source-bootshaus-koeln',
  'source-bootshaus-ticket-io',
  'source-affenkaefig',
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
] as const;
