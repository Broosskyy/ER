import { buildConnectorCapabilityProfile } from '@/features/aggregation/connectors/framework/detail-extraction';
import type { SourceRecord } from '@/data/types/records';
import {
  mapSourceTypeToOriginType,
  SOURCE_CAPABILITY_FIELDS,
  type SourceCapabilityField,
  type SourceOriginType,
} from '@/features/sources/domain/source-capability-fields';
import {
  ratingToReliabilityStatus,
  type SourceFieldReliability,
} from '@/features/sources/domain/source-field-reliability';

const FIELD_ALIASES: Record<string, SourceCapabilityField> = {
  artists: 'lineup',
  artistNames: 'lineup',
  genres: 'genres',
  genreNames: 'genres',
  genreLabels: 'genres',
  image: 'images',
  imageUrl: 'images',
  price: 'priceText',
  availability: 'ticketStatus',
  address: 'venueAddress',
  venue: 'venueName',
  ticketLinks: 'ticketUrl',
};

export interface SourceCapabilityDeclaration {
  sourceId: string;
  displayName: string;
  connectorKey: string;
  originType: SourceOriginType;
  detailLevel: number;
  detailBlockedDefault: boolean;
  expectedFields: SourceCapabilityField[];
  fieldReliability: SourceFieldReliability[];
  listFields: string[];
  detailFields: string[];
  lostFields: string[];
}

function normalizeFieldName(field: string): SourceCapabilityField | undefined {
  const alias = FIELD_ALIASES[field] ?? field;
  return SOURCE_CAPABILITY_FIELDS.includes(alias as SourceCapabilityField)
    ? (alias as SourceCapabilityField)
    : undefined;
}

export function resolveSourceCapabilityDeclaration(source: SourceRecord): SourceCapabilityDeclaration {
  const profile = buildConnectorCapabilityProfile(source);
  const originType = mapSourceTypeToOriginType(source.sourceType, profile.connectorKey);
  const detailBlockedDefault =
    profile.detailCapability.level <= 1 && profile.detailCapability.maxDetailPages === 0;

  const reliabilityByField = new Map<SourceCapabilityField, SourceFieldReliability>();
  for (const entry of profile.fieldCoverage) {
    const field = normalizeFieldName(entry.field);
    if (!field) {
      continue;
    }
    reliabilityByField.set(field, {
      field,
      status: ratingToReliabilityStatus(entry.rating, entry.source, detailBlockedDefault),
      confidence: entry.rating,
      sourceLayer: entry.source,
      notes: entry.notes,
    });
  }

  for (const field of SOURCE_CAPABILITY_FIELDS) {
    if (!reliabilityByField.has(field)) {
      reliabilityByField.set(field, {
        field,
        status: 'unsupported',
        confidence: 1,
        sourceLayer: 'none',
      });
    }
  }

  const expectedFields = [...reliabilityByField.values()]
    .filter((entry) => entry.status !== 'unsupported')
    .map((entry) => entry.field);

  return {
    sourceId: source.id,
    displayName: source.displayName,
    connectorKey: profile.connectorKey,
    originType,
    detailLevel: profile.detailCapability.level,
    detailBlockedDefault,
    expectedFields,
    fieldReliability: SOURCE_CAPABILITY_FIELDS.map((field) => reliabilityByField.get(field)!),
    listFields: profile.listFields,
    detailFields: profile.detailFields,
    lostFields: profile.lostFields,
  };
}

export function getFieldReliability(
  declaration: SourceCapabilityDeclaration,
  field: SourceCapabilityField,
): SourceFieldReliability {
  return (
    declaration.fieldReliability.find((entry) => entry.field === field) ?? {
      field,
      status: 'unsupported',
      confidence: 1,
      sourceLayer: 'none',
    }
  );
}
