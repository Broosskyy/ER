import type { Clock } from '@/core/clock/clock';
import { systemClock } from '@/core/clock/system-clock';

import {
  ARCHIVE_AFTER_ENDED_MS,
  DEFAULT_EVENT_DURATION_MS,
  type EventLifecycleInput,
  type EventLifecycleResult,
  type LifecycleStatus,
} from './lifecycle-types';

function parseInstant(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resolveEffectiveEndAt(input: EventLifecycleInput): string {
  if (input.endAt) {
    return input.endAt;
  }
  const start = parseInstant(input.startAt);
  if (start === null) {
    return input.startAt;
  }
  return new Date(start + DEFAULT_EVENT_DURATION_MS).toISOString();
}

export class EventLifecycleResolver {
  constructor(private readonly clock: Clock = systemClock) {}

  resolve(input: EventLifecycleInput, now = this.clock.now()): EventLifecycleResult {
    const reasonCodes: string[] = [];
    const nowMs = now.getTime();
    const effectiveEndAt = resolveEffectiveEndAt(input);
    const startMs = parseInstant(input.startAt);
    const endMs = parseInstant(effectiveEndAt);

    if (!input.timezone?.trim()) {
      reasonCodes.push('timezone_missing');
    }

    if (input.editorialStatus === 'draft') {
      return { status: 'draft', effectiveEndAt, reasonCodes };
    }
    if (input.editorialStatus === 'review') {
      return { status: 'needs_review', effectiveEndAt, reasonCodes };
    }
    if (input.editorialStatus === 'archived') {
      return { status: 'archived', effectiveEndAt, reasonCodes };
    }
    if (input.editorialStatus === 'rejected') {
      reasonCodes.push('rejected');
      return { status: 'archived', effectiveEndAt, reasonCodes };
    }
    if (input.cancelledAt) {
      reasonCodes.push('cancelled');
      return { status: 'cancelled', effectiveEndAt, reasonCodes };
    }
    if (input.postponedAt) {
      reasonCodes.push('postponed');
      return { status: 'postponed', effectiveEndAt, reasonCodes };
    }

    if (startMs !== null && endMs !== null) {
      if (nowMs >= startMs && nowMs <= endMs) {
        return { status: 'happening_now', effectiveEndAt, reasonCodes };
      }
      if (nowMs > endMs) {
        if (nowMs - endMs >= ARCHIVE_AFTER_ENDED_MS) {
          reasonCodes.push('archive_threshold_reached');
          return { status: 'archived', effectiveEndAt, reasonCodes };
        }
        reasonCodes.push('ended');
        return { status: 'ended', effectiveEndAt, reasonCodes };
      }
    }

    if (input.ticketStatus === 'sold_out') {
      return { status: 'sold_out', effectiveEndAt, reasonCodes };
    }

    const salesStart = input.salesStartAt ? parseInstant(input.salesStartAt) : null;
    const salesEnd = input.salesEndAt ? parseInstant(input.salesEndAt) : null;
    if (
      salesStart !== null &&
      salesEnd !== null &&
      nowMs >= salesStart &&
      nowMs <= salesEnd &&
      input.ticketStatus === 'on_sale'
    ) {
      return { status: 'on_sale', effectiveEndAt, reasonCodes };
    }

    return { status: 'scheduled', effectiveEndAt, reasonCodes };
  }

  isDiscoverable(input: EventLifecycleInput, now = this.clock.now()): boolean {
    const { status } = this.resolve(input, now);
    return status === 'scheduled' || status === 'on_sale' || status === 'sold_out' || status === 'happening_now';
  }
}

export const eventLifecycleResolver = new EventLifecycleResolver();

export function isTerminalLifecycleStatus(status: LifecycleStatus): boolean {
  return status === 'cancelled' || status === 'ended' || status === 'archived';
}
