import type { ImageSourcePropType } from 'react-native';

import type {
  AdminMetricViewModel,
  AdminQueueTabViewModel,
  AdminReviewViewModel,
  DuplicateCandidateViewModel,
  DuplicateComparisonViewModel,
  EventSourceViewModel,
  EventSummaryViewModel,
  ReviewTimelineEntryViewModel,
  ReviewTimelineViewModel,
} from '@/components/admin/view-models';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { EventModerationAuditEntry } from '@/features/admin/services/event-moderation-audit-service';
import type { EventModerationStateRecord, ModerationQueueStatus } from '@/features/admin/types/moderation-types';
import { resolveModerationQueueStatus } from '@/features/admin/utils/moderation-status';
import { formatSourceTypeLabel } from '@/features/sources/admin/source-labels';

const QUEUE_STATUS_LABELS: Record<ModerationQueueStatus, string> = {
  pending: 'Ausstehend',
  in_review: 'In Prüfung',
  needs_changes: 'Änderungen erforderlich',
  approved: 'Genehmigt',
  published: 'Veröffentlicht',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

const REVIEW_STATUS_MAP: Record<ModerationQueueStatus, AdminReviewViewModel['status']> = {
  pending: 'pending',
  in_review: 'in_review',
  needs_changes: 'changes_requested',
  approved: 'approved',
  published: 'approved',
  rejected: 'rejected',
  archived: 'rejected',
};

function toImageSource(uri?: string): ImageSourcePropType | undefined {
  if (!uri?.trim()) {
    return undefined;
  }
  return { uri: uri.trim() };
}

export function resolveQueueStatusLabel(status: ModerationQueueStatus): string {
  return QUEUE_STATUS_LABELS[status];
}

export function buildAdminDashboardMetrics(counts: Record<ModerationQueueStatus, number>): AdminMetricViewModel[] {
  return [
    {
      id: 'pending',
      kind: 'pending_events',
      label: 'Ausstehend',
      valueLabel: String(counts.pending),
      accessibilityLabel: `${counts.pending} ausstehende Events`,
    },
    {
      id: 'in_review',
      kind: 'pending',
      label: 'In Prüfung',
      valueLabel: String(counts.in_review),
      accessibilityLabel: `${counts.in_review} Events in Prüfung`,
    },
    {
      id: 'needs_changes',
      kind: 'duplicate_candidates',
      label: 'Änderungen erforderlich',
      valueLabel: String(counts.needs_changes),
      accessibilityLabel: `${counts.needs_changes} Events mit Änderungswunsch`,
    },
    {
      id: 'approved',
      kind: 'total_events',
      label: 'Genehmigt',
      valueLabel: String(counts.approved),
      accessibilityLabel: `${counts.approved} genehmigte Events`,
    },
    {
      id: 'published',
      kind: 'events',
      label: 'Veröffentlicht',
      valueLabel: String(counts.published),
      accessibilityLabel: `${counts.published} veröffentlichte Events`,
    },
    {
      id: 'rejected',
      kind: 'failed_sources',
      label: 'Abgelehnt',
      valueLabel: String(counts.rejected),
      accessibilityLabel: `${counts.rejected} abgelehnte Events`,
    },
  ];
}

export function buildAdminQueueTabs(
  counts: Record<ModerationQueueStatus, number>,
  active: ModerationQueueStatus | 'all',
): AdminQueueTabViewModel[] {
  const tabs: Array<{ id: ModerationQueueStatus | 'all'; label: string }> = [
    { id: 'all', label: 'Alle' },
    { id: 'pending', label: 'Ausstehend' },
    { id: 'in_review', label: 'In Prüfung' },
    { id: 'needs_changes', label: 'Änderungen' },
    { id: 'approved', label: 'Genehmigt' },
    { id: 'published', label: 'Veröffentlicht' },
    { id: 'rejected', label: 'Abgelehnt' },
  ];

  return tabs.map((tab) => ({
    id: tab.id === 'all' ? 'events' : 'events',
    label: tab.label,
    count: tab.id === 'all' ? undefined : counts[tab.id],
    active: tab.id === active,
  }));
}

export function mapAdminEventToReviewCard(
  event: AdminEventRecord,
  context: {
    cityLabel?: string;
    venueLabel?: string;
    state?: EventModerationStateRecord | null;
    isNew?: boolean;
  } = {},
): AdminReviewViewModel {
  const queueStatus = resolveModerationQueueStatus(event, context.state?.queueStatus);

  return {
    id: event.id,
    type: 'event',
    title: event.title || 'Unbenanntes Event',
    status: REVIEW_STATUS_MAP[queueStatus],
    priorityLabel: 'Priorität: Standard',
    submittedByLabel: event.createdBy ? `Veranstalter ${event.createdBy.slice(0, 8)}` : undefined,
    timestampLabel: `Eingereicht ${new Date(event.updatedAt).toLocaleString('de-DE')}`,
    locationLabel: [context.venueLabel, context.cityLabel].filter(Boolean).join(' · ') || undefined,
    dateLabel: new Date(event.startDate).toLocaleString('de-DE'),
    thumbnail: toImageSource(event.imageUrl),
    isNew: context.isNew,
    hintLabel: context.state?.note,
    accessibilityLabel: `Review für ${event.title || 'Event'}`,
  };
}

export function buildReviewTimeline(
  event: AdminEventRecord,
  auditEntries: EventModerationAuditEntry[],
  state?: EventModerationStateRecord | null,
): ReviewTimelineViewModel {
  const entries: ReviewTimelineEntryViewModel[] = [
    {
      id: 'submitted',
      label: 'Eingereicht',
      timestampLabel: new Date(event.createdAt).toLocaleString('de-DE'),
      status: 'completed',
      actorLabel: event.createdBy ? `Veranstalter ${event.createdBy.slice(0, 8)}` : undefined,
    },
  ];

  if (state?.queueStatus === 'in_review' || auditEntries.some((entry) => entry.action === 'marked_in_review')) {
    entries.push({
      id: 'in_review',
      label: 'In Prüfung',
      timestampLabel: state?.updatedAt
        ? new Date(state.updatedAt).toLocaleString('de-DE')
        : '—',
      status: resolveModerationQueueStatus(event, state?.queueStatus) === 'in_review' ? 'active' : 'completed',
      actorLabel: 'Admin',
    });
  }

  for (const audit of auditEntries) {
    entries.push({
      id: audit.id,
      label: audit.summary,
      timestampLabel: new Date(audit.createdAt).toLocaleString('de-DE'),
      status: 'completed',
      actorLabel: audit.actorId.slice(0, 8),
    });
  }

  const queueStatus = resolveModerationQueueStatus(event, state?.queueStatus);
  if (queueStatus === 'approved') {
    entries.push({
      id: 'approved',
      label: 'Genehmigt',
      timestampLabel: state?.updatedAt ? new Date(state.updatedAt).toLocaleString('de-DE') : '—',
      status: 'active',
    });
  }

  if (queueStatus === 'published') {
    entries.push({
      id: 'published',
      label: 'Veröffentlicht',
      timestampLabel: new Date(event.updatedAt).toLocaleString('de-DE'),
      status: 'active',
    });
  }

  return {
    id: `timeline-${event.id}`,
    entries,
    accessibilityLabel: `Verlauf für ${event.title}`,
  };
}

export function mapSourceRecordToViewModel(source: SourceRecord): EventSourceViewModel {
  const status = !source.enabled
    ? 'disabled'
    : source.archived
      ? 'paused'
      : source.lastJobStatus === 'failed'
        ? 'error'
        : 'active';

  return {
    id: source.id,
    name: source.displayName,
    sourceType:
      source.sourceType === 'api'
        ? 'api'
        : source.sourceType === 'rss' || source.sourceType === 'ical'
          ? 'feed'
          : source.sourceType === 'social'
            ? 'social'
            : 'manual',
    sourceTypeLabel: formatSourceTypeLabel(source.sourceType),
    urlLabel: source.baseUrl ?? undefined,
    lastImportLabel: source.lastImportAt
      ? new Date(source.lastImportAt).toLocaleString('de-DE')
      : 'Noch kein Import',
    status,
    eventCountLabel: undefined,
    healthLabel: source.lastJobStatus ? `Letzter Job: ${source.lastJobStatus}` : undefined,
    icon: 'server-outline',
    accessibilityLabel: `Quelle ${source.displayName}`,
  };
}

export function mapEventToSummary(
  event: AdminEventRecord,
  context: { cityLabel?: string; venueLabel?: string; sourceLabel?: string } = {},
): EventSummaryViewModel {
  return {
    id: event.id,
    title: event.title || 'Unbenanntes Event',
    dateLabel: new Date(event.startDate).toLocaleString('de-DE'),
    venueLabel: context.venueLabel ?? event.venueName ?? '—',
    cityLabel: context.cityLabel,
    sourceLabel: context.sourceLabel ?? 'Community-Einreichung',
    organizerLabel: event.createdBy ? `Veranstalter ${event.createdBy.slice(0, 8)}` : undefined,
  };
}

export function buildDuplicateCandidate(
  submission: AdminEventRecord,
  candidate: AdminEventRecord,
  context: {
    submissionCity?: string;
    submissionVenue?: string;
    candidateCity?: string;
    candidateVenue?: string;
  } = {},
): DuplicateCandidateViewModel {
  return {
    id: `${submission.id}-${candidate.id}`,
    similarityScoreLabel: 'Manuell vorbereitet',
    events: [
      mapEventToSummary(submission, {
        cityLabel: context.submissionCity,
        venueLabel: context.submissionVenue,
        sourceLabel: 'Einreichung',
      }),
      mapEventToSummary(candidate, {
        cityLabel: context.candidateCity,
        venueLabel: context.candidateVenue,
        sourceLabel: 'Bestehend',
      }),
    ],
    accessibilityLabel: `Dublettenvergleich ${submission.title} und ${candidate.title}`,
  };
}

export function buildDuplicateComparisons(
  submission: AdminEventRecord,
  candidate: AdminEventRecord,
): DuplicateComparisonViewModel[] {
  return [
    {
      fieldLabel: 'Titel',
      state:
        submission.title.trim().toLowerCase() === candidate.title.trim().toLowerCase()
          ? 'equal'
          : 'different',
      leftValueLabel: submission.title,
      rightValueLabel: candidate.title,
    },
    {
      fieldLabel: 'Datum',
      state: submission.startDate === candidate.startDate ? 'equal' : 'different',
      leftValueLabel: new Date(submission.startDate).toLocaleString('de-DE'),
      rightValueLabel: new Date(candidate.startDate).toLocaleString('de-DE'),
    },
    {
      fieldLabel: 'Venue',
      state:
        submission.venueName && candidate.venueName && submission.venueName === candidate.venueName
          ? 'equal'
          : submission.venueName || candidate.venueName
            ? 'different'
            : 'missing',
      leftValueLabel: submission.venueName ?? '—',
      rightValueLabel: candidate.venueName ?? '—',
    },
    {
      fieldLabel: 'Veranstalter',
      state: 'different',
      leftValueLabel: submission.createdBy ?? '—',
      rightValueLabel: candidate.createdBy ?? '—',
    },
    {
      fieldLabel: 'Quelle',
      state: 'different',
      leftValueLabel: 'Community-Einreichung',
      rightValueLabel: 'Bestehendes Event',
    },
  ];
}
