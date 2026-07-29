import { SOURCE_CONNECTOR_KEYS, type SourceConnectorKey } from '@/features/aggregation/connectors/types';
import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import type { SourceEntityRole } from '@/features/sources/domain/source-entity-roles';
import type { SourceRecord } from '@/data/types/records';

export interface SourceConnectorResolutionInput {
  connectorKey?: SourceConnectorKey;
  sourceType?: string;
  parserType?: string;
  adapterKey?: string;
  sourceRoles?: readonly SourceEntityRole[];
}

function isRegisteredConnectorKey(value: string): value is SourceConnectorKey {
  return (SOURCE_CONNECTOR_KEYS as readonly string[]).includes(value);
}

function resolveWebsiteConnectorKey(roles: readonly SourceEntityRole[]): SourceConnectorKey {
  const hasClubVenue = roles.some((role) => role === 'club' || role === 'venue');
  const hasOrganizerFestival = roles.some((role) => role === 'organizer' || role === 'festival');

  if (hasClubVenue && hasOrganizerFestival) {
    throw new SourceConnectorError({
      code: 'configuration_invalid',
      message:
        'Website source has ambiguous roles (club/venue and organizer/festival). Set sourceConfig.reference.connectorKey explicitly.',
      retryable: false,
    });
  }
  if (hasClubVenue) {
    return 'club_website';
  }
  if (hasOrganizerFestival) {
    return 'organizer_website';
  }

  throw new SourceConnectorError({
    code: 'configuration_invalid',
    message:
      'Website source requires source_roles (club/venue or organizer/festival) or sourceConfig.reference.connectorKey.',
    retryable: false,
  });
}

export function resolveSourceConnectorKey(input: SourceConnectorResolutionInput): SourceConnectorKey {
  if (input.connectorKey) {
    if (!isRegisteredConnectorKey(input.connectorKey)) {
      throw new SourceConnectorError({
        code: 'configuration_invalid',
        message: `Connector "${input.connectorKey}" is not registered.`,
        retryable: false,
      });
    }
    return input.connectorKey;
  }

  const parserType = input.parserType ?? input.adapterKey;
  const sourceType = input.sourceType;

  if (parserType === 'ical' || sourceType === 'ical') {
    return 'ical_feed';
  }
  if (parserType === 'api' || parserType === 'api_json' || sourceType === 'api') {
    return 'open_data_api';
  }
  if (parserType === 'rss' || sourceType === 'rss') {
    return 'rss_feed';
  }
  if (parserType === 'atom' || sourceType === 'atom') {
    return 'atom_feed';
  }
  if (parserType === 'csv' || sourceType === 'csv') {
    return 'csv_import';
  }
  if (sourceType === 'manual') {
    return 'manual_reference';
  }
  if (sourceType === 'website') {
    return resolveWebsiteConnectorKey(input.sourceRoles ?? []);
  }

  throw new SourceConnectorError({
    code: 'configuration_invalid',
    message: `Unable to resolve connector for sourceType="${sourceType ?? 'unknown'}" parserType="${parserType ?? 'unknown'}". Set sourceConfig.reference.connectorKey explicitly.`,
    retryable: false,
  });
}

export function resolveSourceConnectorKeyFromRecord(source: SourceRecord): SourceConnectorKey {
  return resolveSourceConnectorKey({
    connectorKey: source.sourceConfig?.reference?.connectorKey,
    sourceType: source.sourceType,
    parserType: source.parserType,
    adapterKey: source.parserType !== 'unknown' ? source.parserType : undefined,
    sourceRoles: source.sourceRoles,
  });
}

export function canResolveSourceConnector(source: SourceRecord | null | undefined): boolean {
  if (!source) {
    return false;
  }
  try {
    resolveSourceConnectorKeyFromRecord(source);
    return true;
  } catch {
    return false;
  }
}
