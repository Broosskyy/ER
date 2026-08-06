import type { SourceRegistryEntry } from '@/features/sources/domain/source-registry';
import type { SourceHealthResult } from '@/features/sources/domain/source-health-resolver';

import {
  averageCompletenessPercentage,
  calculateEventDataCompleteness,
  type EventCompletenessInput,
} from './event-data-completeness';
import {
  buildConnectorCapabilityProfile,
  type ConnectorCapabilityProfile,
} from './connector-field-coverage';

export interface ConnectorQualityScore {
  score: number;
  label: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  factors: {
    fieldCoverage: number;
    detailLevel: number;
    operationalHealth: number;
    completeness: number;
  };
  detailLevel: number;
  averageEventCompleteness: number;
  profile: ConnectorCapabilityProfile;
}

function averageFieldCoverage(profile: ConnectorCapabilityProfile): number {
  if (profile.fieldCoverage.length === 0) {
    return 0;
  }
  const total = profile.fieldCoverage.reduce((sum, field) => sum + field.rating, 0);
  return Math.round((total / profile.fieldCoverage.length / 5) * 100);
}

function detailLevelScore(level: number): number {
  return Math.min(100, level * 25);
}

function operationalHealthScore(health: SourceHealthResult): number {
  return health.score;
}

function qualityLabel(score: number): ConnectorQualityScore['label'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

export function calculateConnectorQualityScore(input: {
  source: SourceRegistryEntry;
  health: SourceHealthResult;
  sampleEvents?: EventCompletenessInput[];
}): ConnectorQualityScore {
  const profile = buildConnectorCapabilityProfile(input.source);
  const fieldCoverage = averageFieldCoverage(profile);
  const detailLevel = detailLevelScore(profile.detailCapability.level);
  const operationalHealth = operationalHealthScore(input.health);
  const completenessSamples = (input.sampleEvents ?? []).map((event) => calculateEventDataCompleteness(event));
  const completeness = averageCompletenessPercentage(completenessSamples);

  const score = Math.round(
    fieldCoverage * 0.35 + detailLevel * 0.25 + operationalHealth * 0.2 + completeness * 0.2,
  );

  return {
    score,
    label: qualityLabel(score),
    factors: {
      fieldCoverage,
      detailLevel,
      operationalHealth,
      completeness,
    },
    detailLevel: profile.detailCapability.level,
    averageEventCompleteness: completeness,
    profile,
  };
}

export function formatConnectorQualityLabelDe(score: ConnectorQualityScore): string {
  const labels: Record<ConnectorQualityScore['label'], string> = {
    excellent: 'Ausgezeichnet',
    good: 'Gut',
    fair: 'Mittel',
    poor: 'Schwach',
    critical: 'Kritisch',
  };
  return `${labels[score.label]} (${score.score})`;
}

export function formatDetailLevelLabelDe(level: number): string {
  const map: Record<number, string> = {
    1: 'Stufe 1 — Nur Liste',
    2: 'Stufe 2 — Liste + Detail',
    3: 'Stufe 3 — Strukturierte Daten',
    4: 'Stufe 4 — Offizielle API',
  };
  return map[level] ?? `Stufe ${level}`;
}
