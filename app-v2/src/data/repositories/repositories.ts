import { featureFlags } from '@/core/config/feature-flags';
import { AppError } from '@/core/errors/app-error';
import {
  fetchPublishedEventDetailById,
  fetchPublishedEventDetails,
  toPublishedSummaries,
} from '@/data/repositories/event-core-read';
import type { EventDetail, EventSummary } from '@/features/events/types/event-core';
import { getSupabaseClient } from '@/services/supabase/client';

export class EventRepository {
  private initialized = false;
  private summaries: EventSummary[] = [];
  private detailsById = new Map<string, EventDetail>();
  private loadError: AppError | null = null;

  async initialize(): Promise<void> {
    await this.reloadFromSupabase();
    this.initialized = true;
  }

  initializeSync(details: EventDetail[] = []): void {
    this.detailsById = new Map(details.map((detail) => [detail.id, detail]));
    this.summaries = toPublishedSummaries(details);
    this.initialized = true;
    this.loadError = null;
  }

  resetForTesting(): void {
    this.initialized = false;
    this.summaries = [];
    this.detailsById.clear();
    this.loadError = null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getLoadError(): AppError | null {
    return this.loadError;
  }

  getPublishedSummaries(): EventSummary[] {
    return this.summaries;
  }

  getPublishedDetail(eventId: string): EventDetail | undefined {
    return this.detailsById.get(eventId);
  }

  hasPublishedEvent(eventId: string): boolean {
    return this.detailsById.has(eventId);
  }

  async reloadFromSupabase(): Promise<void> {
    if (!featureFlags.useSupabase) {
      this.initializeSync([]);
      return;
    }

    try {
      const details = await fetchPublishedEventDetails(getSupabaseClient());
      this.detailsById = new Map(details.map((detail) => [detail.id, detail]));
      this.summaries = toPublishedSummaries(details);
      this.loadError = null;
    } catch (error) {
      this.loadError =
        error instanceof AppError
          ? error
          : new AppError('Published events could not be loaded.', {
              code: 'NETWORK',
              retryable: true,
            });
      throw this.loadError;
    }
  }

  async fetchPublishedDetailById(eventId: string): Promise<EventDetail | null> {
    const cached = this.detailsById.get(eventId);
    if (cached) {
      return cached;
    }

    if (!featureFlags.useSupabase) {
      return null;
    }

    const detail = await fetchPublishedEventDetailById(getSupabaseClient(), eventId);
    if (detail) {
      this.detailsById.set(detail.id, detail);
      this.summaries = toPublishedSummaries([...this.detailsById.values()]);
    }
    return detail;
  }

  resolveCanonicalId(eventId: string): string {
    return eventId;
  }

  applyCanonicalAliases(_aliases: Map<string, string>): void {
    // No-op until multi-source identity is reintroduced on the new core.
  }
}
