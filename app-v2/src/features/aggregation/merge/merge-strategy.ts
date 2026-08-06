import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import { mergeCanonicalLineupEntries } from '@/features/aggregation/domain/lineup-entry-merge';
import { flattenCanonicalLineupArtistNames } from '@/features/aggregation/domain/canonical-lineup-entry';
import { pickBetterArtistNames } from '@/features/events/domain/lineup-artist-quality';
import { resolveBetterTicketUrl } from '@/features/events/domain/ticket-url-quality';

export interface SourceContribution {
  sourceId: string;
  sourceName: string;
  externalId: string;
  sourceUrl?: string;
  retrievedAt: string;
  priority: number;
  trustScore: number;
}

export interface MergeChangeEntry {
  field: string;
  previousValue?: string;
  nextValue?: string;
  changedAt: string;
  sourceId: string;
}

export interface MergedImportEvent {
  mergeGroupId: string;
  canonicalEvent: CanonicalImportEvent;
  primarySourceId: string;
  sourceContributions: SourceContribution[];
  changeHistory: MergeChangeEntry[];
  fieldProvenance?: Record<string, FieldProvenance>;
}

export interface MergeDecision {
  shouldMerge: boolean;
  mergeGroupId?: string;
  reason: string;
}

export interface MergeStrategy {
  decide(
    event: CanonicalImportEvent,
    existing: MergedImportEvent[],
    context: {
      sourcePriority: number;
      sourceTrustScore: number;
      retrievedAt: string;
      sourceType?: string;
      sourceQualityScore?: number;
      sourceHealthScore?: number;
      manualOverrides?: Record<string, unknown>;
    },
  ): MergeDecision;
  merge(
    event: CanonicalImportEvent,
    existing: MergedImportEvent | undefined,
    context: {
      sourcePriority: number;
      sourceTrustScore: number;
      retrievedAt: string;
      sourceType?: string;
      sourceQualityScore?: number;
      sourceHealthScore?: number;
      manualOverrides?: Record<string, unknown>;
    },
  ): MergedImportEvent;
}

function buildContribution(
  event: CanonicalImportEvent,
  context: { sourcePriority: number; sourceTrustScore: number; retrievedAt: string },
): SourceContribution {
  return {
    sourceId: event.sourceId,
    sourceName: event.sourceName,
    externalId: event.externalId,
    sourceUrl: event.sourceUrl,
    retrievedAt: context.retrievedAt,
    priority: context.sourcePriority,
    trustScore: context.sourceTrustScore,
  };
}

function pickPreferredValue<T>(
  current: T | undefined,
  incoming: T | undefined,
  currentPriority: number,
  incomingPriority: number,
): T | undefined {
  if (incoming === undefined) {
    return current;
  }
  if (current === undefined) {
    return incoming;
  }
  return incomingPriority >= currentPriority ? incoming : current;
}

function fieldAuthority(field: string, sourceType?: string): number {
  if (field === 'ticketUrl' && /ticket|partner/.test(sourceType ?? '')) return 30;
  if (['description', 'artistNames', 'organizerName'].includes(field) && /organizer/.test(sourceType ?? '')) return 25;
  if (['venueAddress', 'latitude', 'longitude'].includes(field) && /venue|club/.test(sourceType ?? '')) return 25;
  return 0;
}

function effectiveFieldPriority(
  field: string,
  context: Parameters<MergeStrategy['merge']>[2],
): number {
  return context.sourcePriority +
    fieldAuthority(field, context.sourceType) +
    (context.sourceQualityScore ?? 0) * 0.1 +
    (context.sourceHealthScore ?? 0) * 0.05;
}

export class PriorityBasedMergeStrategy implements MergeStrategy {
  decide(
    event: CanonicalImportEvent,
    existing: MergedImportEvent[],
    context: Parameters<MergeStrategy['decide']>[2],
  ): MergeDecision {
    const match = existing.find(
      (entry) =>
        entry.canonicalEvent.title.trim().toLowerCase() === event.title.trim().toLowerCase() &&
        entry.canonicalEvent.startDate.slice(0, 10) === event.startDate.slice(0, 10) &&
        (entry.canonicalEvent.venueName ?? '') === (event.venueName ?? ''),
    );

    if (!match) {
      return {
        shouldMerge: false,
        reason: 'no_existing_group',
      };
    }

    const existingPriority = match.sourceContributions[0]?.priority ?? 0;
    if (context.sourcePriority < existingPriority) {
      return {
        shouldMerge: true,
        mergeGroupId: match.mergeGroupId,
        reason: 'lower_priority_contribution',
      };
    }

    return {
      shouldMerge: true,
      mergeGroupId: match.mergeGroupId,
      reason: 'same_event_multiple_sources',
    };
  }

  merge(
    event: CanonicalImportEvent,
    existing: MergedImportEvent | undefined,
    context: Parameters<MergeStrategy['merge']>[2],
  ): MergedImportEvent {
    const contribution = buildContribution(event, context);

    if (!existing) {
      return {
        mergeGroupId: `${event.sourceId}:${event.externalId}`,
        canonicalEvent: event,
        primarySourceId: event.sourceId,
        sourceContributions: [contribution],
        changeHistory: [],
      };
    }

    const primaryPriority = existing.sourceContributions[0]?.priority ?? 0;
    const useIncomingAsPrimary = context.sourcePriority >= primaryPriority;
    const base = useIncomingAsPrimary ? event : existing.canonicalEvent;
    const selectField = <T>(
      field: string,
      current: T | undefined,
      incoming: T | undefined,
    ): T | undefined => {
      const override = context.manualOverrides?.[field] as T | undefined;
      if (override !== undefined) return override;
      if (field === 'ticketUrl') {
        const resolution = resolveBetterTicketUrl(
          typeof current === 'string' ? current : undefined,
          typeof incoming === 'string' ? incoming : undefined,
        );
        if (resolution.reason === 'preserve_existing_on_tie') {
          return pickPreferredValue(
            current,
            incoming,
            primaryPriority,
            effectiveFieldPriority(field, context),
          );
        }
        return (resolution.selected as T | undefined) ?? current;
      }
      if (field === 'artistNames') {
        return pickBetterArtistNames(
          current as string[] | undefined,
          incoming as string[] | undefined,
        ) as T | undefined;
      }
      if (field === 'lineupEntries') {
        return mergeCanonicalLineupEntries(
          (current as CanonicalImportEvent['lineupEntries']) ?? [],
          (incoming as CanonicalImportEvent['lineupEntries']) ?? [],
          {
            existingConfidence: 0.5,
            incomingConfidence: 0.75,
          },
        ) as T | undefined;
      }
      return pickPreferredValue(
        current,
        incoming,
        primaryPriority,
        effectiveFieldPriority(field, context),
      );
    };
    const mergedLineupEntries = selectField(
      'lineupEntries',
      existing.canonicalEvent.lineupEntries,
      event.lineupEntries,
    );
    const mergedArtistNames =
      mergedLineupEntries && mergedLineupEntries.length > 0
        ? flattenCanonicalLineupArtistNames(mergedLineupEntries)
        : selectField('artistNames', existing.canonicalEvent.artistNames, event.artistNames);

    const mergedEvent: CanonicalImportEvent = {
      ...base,
      description: selectField('description', existing.canonicalEvent.description, event.description),
      imageUrl: selectField('imageUrl', existing.canonicalEvent.imageUrl, event.imageUrl),
      ticketUrl: selectField('ticketUrl', existing.canonicalEvent.ticketUrl, event.ticketUrl),
      organizerName: selectField('organizerName', existing.canonicalEvent.organizerName, event.organizerName),
      venueAddress: selectField('venueAddress', existing.canonicalEvent.venueAddress, event.venueAddress),
      latitude: selectField('latitude', existing.canonicalEvent.latitude, event.latitude),
      longitude: selectField('longitude', existing.canonicalEvent.longitude, event.longitude),
      artistNames: mergedArtistNames,
      lineupEntries: mergedLineupEntries,
    };

    const changeHistory = [...existing.changeHistory];
    if (useIncomingAsPrimary && existing.canonicalEvent.title !== event.title) {
      changeHistory.push({
        field: 'title',
        previousValue: existing.canonicalEvent.title,
        nextValue: event.title,
        changedAt: context.retrievedAt,
        sourceId: event.sourceId,
      });
    }

    return {
      mergeGroupId: existing.mergeGroupId,
      canonicalEvent: mergedEvent,
      primarySourceId: useIncomingAsPrimary ? event.sourceId : existing.primarySourceId,
      sourceContributions: [...existing.sourceContributions, contribution],
      changeHistory,
      fieldProvenance: {
        ...(existing.fieldProvenance ?? {}),
        description: {
          value: mergedEvent.description,
          selectedSourceId: context.manualOverrides?.description !== undefined ? 'manual_override' : event.sourceId,
          selectionReason: context.manualOverrides?.description !== undefined ? 'manual_override' : 'field_priority',
          alternatives: [{ sourceId: existing.primarySourceId, value: existing.canonicalEvent.description }],
          lastChangedAt: context.retrievedAt,
        },
        ticketUrl: {
          value: mergedEvent.ticketUrl,
          selectedSourceId: context.manualOverrides?.ticketUrl !== undefined ? 'manual_override' : event.sourceId,
          selectionReason: context.manualOverrides?.ticketUrl !== undefined ? 'manual_override' : 'field_priority',
          alternatives: [{ sourceId: existing.primarySourceId, value: existing.canonicalEvent.ticketUrl }],
          lastChangedAt: context.retrievedAt,
        },
      },
    };
  }
}

export const priorityBasedMergeStrategy = new PriorityBasedMergeStrategy();
