import type {
  AcquisitionStrategy,
  ParserType,
  PollingStrategy,
  SourceType,
} from '@/features/sources/domain/source-types';

export function formatSourceTypeLabel(value: SourceType | string): string {
  return value.replace(/_/g, ' ');
}

export function formatParserTypeLabel(value: ParserType | string): string {
  return value.replace(/_/g, ' ');
}

export function formatAcquisitionStrategyLabel(value: AcquisitionStrategy | string): string {
  return value.replace(/_/g, ' ');
}

export function formatPollingStrategyLabel(value: PollingStrategy | string): string {
  return value.replace(/_/g, ' ');
}

export function formatSourceStatus(enabled: boolean, archived: boolean): string {
  if (archived) {
    return 'Archived';
  }
  return enabled ? 'Enabled' : 'Disabled';
}
