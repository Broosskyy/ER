import type {
  ImportReviewQueueEntry,
  ImportReviewQueueRepository,
  SourceReputationEvent,
  SourceReputationRepository,
  TrustQualityRule,
  TrustQualityRuleRepository,
} from '../domain/trust-quality-types';

const DEFAULT_RULES: TrustQualityRule[] = [
  {
    id: 'rule-required-title',
    ruleKey: 'required_title',
    category: 'field_required',
    severity: 'blocking',
    decisionImpact: 'reject',
    enabled: true,
    weight: 1,
    config: { field: 'title' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-required-start-date',
    ruleKey: 'required_start_date',
    category: 'field_required',
    severity: 'blocking',
    decisionImpact: 'reject',
    enabled: true,
    weight: 1,
    config: { field: 'startDate' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-invalid-date',
    ruleKey: 'invalid_start_date',
    category: 'plausibility',
    severity: 'blocking',
    decisionImpact: 'reject',
    enabled: true,
    weight: 1,
    config: { field: 'startDate' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-missing-venue',
    ruleKey: 'missing_venue',
    category: 'field_required',
    severity: 'warning',
    decisionImpact: 'review_required',
    enabled: true,
    weight: 0.8,
    config: { field: 'venueName' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-missing-city',
    ruleKey: 'missing_city',
    category: 'field_required',
    severity: 'warning',
    decisionImpact: 'review_required',
    enabled: true,
    weight: 0.8,
    config: { field: 'cityName' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-missing-organizer',
    ruleKey: 'missing_organizer',
    category: 'field_required',
    severity: 'info',
    decisionImpact: 'hold',
    enabled: true,
    weight: 0.4,
    config: { field: 'organizerName' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-missing-image',
    ruleKey: 'missing_image',
    category: 'field_required',
    severity: 'info',
    decisionImpact: 'hold',
    enabled: true,
    weight: 0.5,
    config: { field: 'imageUrl' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-invalid-ticket-url',
    ruleKey: 'invalid_ticket_url',
    category: 'url',
    severity: 'warning',
    decisionImpact: 'review_required',
    enabled: true,
    weight: 0.9,
    config: { field: 'ticketUrl' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-duplicate-threshold',
    ruleKey: 'duplicate_threshold',
    category: 'duplicate',
    severity: 'warning',
    decisionImpact: 'review_required',
    enabled: true,
    weight: 1,
    config: { thresholdKey: 'duplicateThreshold' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-low-trust-score',
    ruleKey: 'low_trust_score',
    category: 'trust',
    severity: 'warning',
    decisionImpact: 'review_required',
    enabled: true,
    weight: 1,
    config: { thresholdKey: 'minTrustScore' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-low-extraction-confidence',
    ruleKey: 'low_extraction_confidence',
    category: 'trust',
    severity: 'info',
    decisionImpact: 'hold',
    enabled: true,
    weight: 0.7,
    config: { thresholdKey: 'minExtractionConfidence' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-validation-errors',
    ruleKey: 'validation_errors',
    category: 'plausibility',
    severity: 'blocking',
    decisionImpact: 'reject',
    enabled: true,
    weight: 1,
    config: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export class InMemoryTrustQualityRuleRepository implements TrustQualityRuleRepository {
  constructor(private readonly rules: TrustQualityRule[] = DEFAULT_RULES) {}

  async listEnabled(): Promise<TrustQualityRule[]> {
    return this.rules.filter((rule) => rule.enabled);
  }

  async listAll(): Promise<TrustQualityRule[]> {
    return [...this.rules];
  }
}

export class InMemoryImportReviewQueueRepository implements ImportReviewQueueRepository {
  private readonly entries = new Map<string, ImportReviewQueueEntry>();

  async upsert(entry: ImportReviewQueueEntry): Promise<ImportReviewQueueEntry> {
    this.entries.set(entry.id, { ...entry });
    return entry;
  }

  async findByImportRecordId(importRecordId: string): Promise<ImportReviewQueueEntry | null> {
    return [...this.entries.values()].find((entry) => entry.importRecordId === importRecordId) ?? null;
  }

  async findActiveBySourceAndExternalEventId(
    sourceId: string,
    externalEventId: string,
  ): Promise<ImportReviewQueueEntry | null> {
    return (
      [...this.entries.values()].find(
        (entry) =>
          entry.sourceId === sourceId &&
          entry.externalEventId === externalEventId &&
          (entry.status === 'pending' || entry.status === 'on_hold'),
      ) ?? null
    );
  }

  async listBySourceId(sourceId: string, limit = 50): Promise<ImportReviewQueueEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => entry.sourceId === sourceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listPending(limit = 100): Promise<ImportReviewQueueEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => entry.status === 'pending' || entry.status === 'on_hold')
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}

export class InMemorySourceReputationRepository implements SourceReputationRepository {
  private readonly events: SourceReputationEvent[] = [];

  async create(event: SourceReputationEvent): Promise<SourceReputationEvent> {
    this.events.push({ ...event });
    return event;
  }

  async listBySourceId(sourceId: string, limit = 50): Promise<SourceReputationEvent[]> {
    return this.events
      .filter((event) => event.sourceId === sourceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}
