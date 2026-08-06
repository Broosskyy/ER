import type { ImportJobStatus } from '@/features/import/models/statuses';
import type { SourceRecord } from '@/data/types/records';
import {
  buildConnectorCapabilityProfile,
  formatConnectorQualityLabelDe,
  formatDetailLevelLabelDe,
  calculateConnectorQualityScore,
} from '@/features/aggregation/connectors/framework/detail-extraction';
import { mapSourceRecordToRegistryEntry } from '@/features/sources/domain/source-registry';
import { sourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import { buildSourceReliabilitySummary } from '@/features/sources/domain/source-reliability-service';
import type { SourceReliabilitySummary } from '@/features/sources/domain/source-reliability-types';

const JOB_STATUS_LABELS_DE: Record<string, string> = {
  completed: 'Erfolgreich',
  completed_with_warnings: 'Erfolgreich (mit Warnungen)',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
  pending: 'Ausstehend',
  running: 'Läuft',
};

export function formatImportJobStatusLabelDe(status?: ImportJobStatus | string | null): string | undefined {
  if (!status) {
    return undefined;
  }
  return JOB_STATUS_LABELS_DE[status] ?? String(status);
}

export function formatEventCountLabelDe(count?: number | null): string | undefined {
  if (count === undefined || count === null) {
    return undefined;
  }
  if (count === 0) {
    return '0 Events';
  }
  return count === 1 ? '1 Event' : `${count} Events`;
}

export function formatRelativeImportTimeDe(iso?: string | null, now = Date.now()): string {
  if (!iso) {
    return 'Noch kein Import';
  }
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'Noch kein Import';
  }
  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return 'vor wenigen Sekunden';
  }
  if (minutes < 60) {
    return `vor ${minutes} Minute${minutes === 1 ? '' : 'n'}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `vor ${hours} Stunde${hours === 1 ? '' : 'n'}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 14) {
    return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
  }
  return new Date(iso).toLocaleString('de-DE');
}

export function formatSourceImportSummaryDe(source: SourceRecord): {
  eventCountLabel: string;
  lastImportLabel: string;
  lastJobStatusLabel?: string;
  healthLabel?: string;
} {
  const eventCount = source.totalValidEventCount ?? 0;
  const eventCountLabel = formatEventCountLabelDe(eventCount) ?? '0 Events';
  const lastImportLabel = formatRelativeImportTimeDe(source.lastImportAt);
  const lastJobStatusLabel = formatImportJobStatusLabelDe(source.lastJobStatus);

  let healthLabel: string | undefined;
  if (source.lastJobStatus) {
    healthLabel = `Letzter Lauf: ${lastJobStatusLabel ?? source.lastJobStatus}`;
  } else if (!source.lastImportAt && eventCount === 0) {
    healthLabel = 'Noch nicht importiert';
  } else if (source.consecutiveFailureCount && source.consecutiveFailureCount > 0) {
    healthLabel = `${source.consecutiveFailureCount} Fehlversuche in Folge`;
  }

  return {
    eventCountLabel,
    lastImportLabel: source.lastImportAt
      ? `Letzter Import: ${lastImportLabel}`
      : lastImportLabel,
    lastJobStatusLabel,
    healthLabel,
  };
}

export function formatConnectorCapabilitySummaryDe(source: SourceRecord): {
  detailLevelLabel: string;
  qualityLabel: string;
  descriptionCoverage: string;
  lostFieldsLabel?: string;
} {
  const profile = buildConnectorCapabilityProfile(source);
  const registryEntry = mapSourceRecordToRegistryEntry(source);
  const health = sourceHealthResolver.resolve(registryEntry);
  const quality = calculateConnectorQualityScore({ source: registryEntry, health });

  const descriptionField = profile.fieldCoverage.find((field) => field.field === 'description');
  const stars = '★'.repeat(descriptionField?.rating ?? 1) + '☆'.repeat(5 - (descriptionField?.rating ?? 1));

  return {
    detailLevelLabel: formatDetailLevelLabelDe(profile.detailCapability.level),
    qualityLabel: formatConnectorQualityLabelDe(quality),
    descriptionCoverage: `Beschreibung ${stars}`,
    lostFieldsLabel:
      profile.lostFields.length > 0 ? `Fehlende Felder: ${profile.lostFields.join(', ')}` : undefined,
  };
}

function formatReliabilityStars(confidence: number): string {
  const clamped = Math.max(1, Math.min(5, confidence));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export function formatSourceReliabilitySummaryDe(
  source: SourceRecord,
  events: Parameters<typeof buildSourceReliabilitySummary>[1] = [],
): {
  summary: SourceReliabilitySummary;
  healthLabel: string;
  coverageLines: string[];
  blockedFieldsLabel?: string;
  regressionLabel?: string;
  lastImportLabel: string;
} {
  const summary = buildSourceReliabilitySummary(source, events);
  const topCoverage = summary.coverage.fields
    .filter((field) => field.totalCount > 0)
    .sort((left, right) => right.coveragePercent - left.coveragePercent)
    .slice(0, 5)
    .map((field) => {
      const reliability = summary.declaration.fieldReliability.find((entry) => entry.field === field.field);
      const stars = formatReliabilityStars(reliability?.confidence ?? 1);
      return `${field.field} ${field.coveragePercent}% (${stars})`;
    });

  const criticalRegressions = summary.regressions.regressions.filter(
    (entry) => entry.severity === 'critical' || entry.severity === 'warning',
  );

  return {
    summary,
    healthLabel: `Health ${summary.healthScore} · Quality ${summary.qualityScore}`,
    coverageLines: topCoverage,
    blockedFieldsLabel:
      summary.blockedFields.length > 0
        ? `Blockiert: ${summary.blockedFields.join(', ')}`
        : undefined,
    regressionLabel:
      criticalRegressions.length > 0
        ? `Regressionen: ${criticalRegressions.map((entry) => entry.field).join(', ')}`
        : undefined,
    lastImportLabel: formatRelativeImportTimeDe(summary.lastSuccessfulImportAt),
  };
}
