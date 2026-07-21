import { AppError } from '@/core/errors/app-error';
import type { AdminEventSaveContext } from '@/data/repositories/repositories';
import type { ArtistRecord } from '@/data/types/records';
import { isContributorReviewEvent } from '@/features/admin/constants/admin-event-status';
import {
  canEditEventLineup,
  canEditEvents,
} from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import type { EventLineupInput } from '@/features/events/domain/event-lineup';
import type { EventLineupArtist } from '@/features/events/domain/event-lineup';
import {
  buildLineupFromMatchedArtistIds,
  derivePrimaryArtistId,
  normalizeLineupInputs,
} from '@/features/events/domain/event-lineup-primary';
import { validateEventLineupInputs } from '@/features/events/domain/event-lineup-validation';

export class EventLineupService {
  constructor(
    private readonly lineupRepository: {
      getLineupForEvent(eventId: string): Promise<EventLineupArtist[]>;
      replaceEventLineup(eventId: string, lineup: EventLineupInput[]): Promise<EventLineupArtist[]>;
    },
    private readonly loadArtists: () => Promise<ArtistRecord[]>,
    private readonly getEventById: (
      id: string,
    ) => Promise<{ status: string; createdBy?: string } | null>,
  ) {}

  async getLineupForAdmin(
    role: AdminRole | null,
    eventId: string,
  ): Promise<EventLineupArtist[]> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.lineupRepository.getLineupForEvent(eventId);
  }

  async replaceEventLineup(
    role: AdminRole | null,
    eventId: string,
    lineup: EventLineupInput[],
    context: AdminEventSaveContext = { source: 'cms' },
  ): Promise<EventLineupArtist[]> {
    if (!canEditEventLineup(role)) {
      throw new AppError('You do not have permission to edit event lineups.', {
        code: 'UNAUTHORIZED',
      });
    }

    const event = await this.getEventById(eventId);
    if (!event) {
      throw new AppError('Event not found.', { code: 'NOT_FOUND' });
    }

    if (
      context.source !== 'moderation' &&
      isContributorReviewEvent({ status: event.status as never, createdBy: event.createdBy })
    ) {
      throw new AppError(
        'Contributor submissions in review must be moderated through the review workflow.',
        { code: 'VALIDATION' },
      );
    }

    const artists = await this.loadArtists();
    const artistsById = new Map(artists.map((artist) => [artist.id, artist]));
    const normalized = normalizeLineupInputs(lineup);
    const validated = validateEventLineupInputs(normalized, artistsById);

    return this.lineupRepository.replaceEventLineup(eventId, validated);
  }

  async replaceFromMatchedArtistIds(
    role: AdminRole | null,
    eventId: string,
    matchedArtistIds: string[],
    context: AdminEventSaveContext = { source: 'cms' },
  ): Promise<EventLineupArtist[]> {
    return this.replaceEventLineup(
      role,
      eventId,
      buildLineupFromMatchedArtistIds(matchedArtistIds),
      context,
    );
  }

  derivePrimaryArtistId(lineup: EventLineupInput[]): string | null {
    return derivePrimaryArtistId(lineup);
  }
}

export function canAssignArtistToEvent(role: AdminRole | null): boolean {
  return canEditEvents(role);
}

export function canReorderEventLineup(role: AdminRole | null): boolean {
  return canEditEvents(role);
}
