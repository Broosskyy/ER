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

import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';

import { validateEventLineupInputs } from '@/features/events/domain/event-lineup-validation';

import {

  syncCompatibilityProjectionFromStructured,

  writeCanonicalStructuredLineup,

  type CanonicalLineupWriteRepositories,

} from '@/features/events/services/canonical-structured-lineup-writer';



function flatLineupToStructuredEntries(

  lineup: EventLineupInput[],

  provenanceSource: string,

): ResolvedCanonicalLineupEntry[] {

  return lineup.map((entry, order) => ({

    order,

    artists: [],

    artistIds: [entry.artistId],

    billingRelation: 'SOLO' as const,

    confidence: 0.8,

    provenance: { source: provenanceSource },

  }));

}



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

    private readonly structuredLineupRepository?: {

      getEntriesForEvent(eventId: string): Promise<ResolvedCanonicalLineupEntry[]>;

      replaceEventLineupEntries(

        eventId: string,

        entries: ResolvedCanonicalLineupEntry[],

      ): Promise<ResolvedCanonicalLineupEntry[]>;

    },

  ) {}



  private canonicalRepositories(): CanonicalLineupWriteRepositories {

    return {

      getEntriesForEvent: async (eventId) =>

        this.structuredLineupRepository?.getEntriesForEvent(eventId) ?? [],

      replaceEventLineupEntries: async (eventId, entries) => {

        if (!this.structuredLineupRepository) {

          throw new AppError('Structured lineup storage is not available.', { code: 'VALIDATION' });

        }

        return this.structuredLineupRepository.replaceEventLineupEntries(eventId, entries);

      },

      getLineupArtistIds: async (eventId) => this.getLineupArtistIds(eventId),

      replaceEventLineup: async (eventId, lineup) => {

        await this.lineupRepository.replaceEventLineup(eventId, lineup);

      },

    };

  }



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

    if (!canEditEventLineup(role) && context.source !== 'import') {

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



    if (this.structuredLineupRepository) {

      const structuredEntries = flatLineupToStructuredEntries(

        validated,

        context.source === 'import' ? 'legacy_flat_import' : 'cms_manual',

      );

      await writeCanonicalStructuredLineup({

        eventId,

        entries: structuredEntries,

        context: {

          source: context.source === 'import' ? 'import' : 'cms',

          forceReplace: true,

        },

        repositories: this.canonicalRepositories(),

        artistsById,

      });

      return this.lineupRepository.getLineupForEvent(eventId);

    }



    return this.lineupRepository.replaceEventLineup(eventId, validated);

  }



  async replaceFromMatchedArtistIds(

    role: AdminRole | null,

    eventId: string,

    matchedArtistIds: string[],

    context: AdminEventSaveContext = { source: 'cms' },

  ): Promise<EventLineupArtist[]> {

    if (context.source !== 'import' && !canEditEventLineup(role)) {

      throw new AppError('You do not have permission to edit event lineups.', {

        code: 'UNAUTHORIZED',

      });

    }



    return this.replaceEventLineup(

      role,

      eventId,

      buildLineupFromMatchedArtistIds(matchedArtistIds),

      context,

    );

  }



  /**

   * @deprecated Flat import writes are blocked. Converts to structured SOLO entries via canonical writer.

   */

  async replaceFromImportPipeline(

    eventId: string,

    matchedArtistIds: string[],

  ): Promise<EventLineupArtist[]> {

    return this.replaceFromMatchedArtistIds(null, eventId, matchedArtistIds, {

      source: 'import',

    });

  }



  async getStructuredLineupForEvent(eventId: string): Promise<ResolvedCanonicalLineupEntry[]> {

    if (!this.structuredLineupRepository) {

      return [];

    }

    return this.structuredLineupRepository.getEntriesForEvent(eventId);

  }



  async replaceStructuredLineupFromImport(

    eventId: string,

    entries: ResolvedCanonicalLineupEntry[],

    options?: { importRecordId?: string; forceReplace?: boolean },

  ): Promise<ResolvedCanonicalLineupEntry[]> {

    if (!this.structuredLineupRepository) {

      return this.replaceFromImportPipeline(

        eventId,

        entries.flatMap((entry) => entry.artistIds),

      ).then(() => entries);

    }



    const artists = await this.loadArtists();

    const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

    const result = await writeCanonicalStructuredLineup({

      eventId,

      entries,

      context: {

        source: 'import',

        importRecordId: options?.importRecordId,

        forceReplace: options?.forceReplace,

      },

      repositories: this.canonicalRepositories(),

      artistsById,

    });

    return result.entries;

  }



  async replaceStructuredLineup(

    role: AdminRole | null,

    eventId: string,

    entries: ResolvedCanonicalLineupEntry[],

    context: AdminEventSaveContext = { source: 'cms' },

  ): Promise<ResolvedCanonicalLineupEntry[]> {

    if (!canEditEventLineup(role) && context.source !== 'import') {

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



    if (!this.structuredLineupRepository) {

      throw new AppError('Structured lineup storage is not available.', { code: 'VALIDATION' });

    }



    const artists = await this.loadArtists();

    const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

    const result = await writeCanonicalStructuredLineup({

      eventId,

      entries,

      context: {

        source: context.source === 'moderation' ? 'moderation' : 'cms',

        forceReplace: true,

      },

      repositories: this.canonicalRepositories(),

      artistsById,

    });

    return result.entries;

  }



  async syncCompatibilityProjection(eventId: string): Promise<EventLineupArtist[]> {

    if (!this.structuredLineupRepository) {

      return this.lineupRepository.getLineupForEvent(eventId);

    }

    const artists = await this.loadArtists();

    const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

    await syncCompatibilityProjectionFromStructured({

      eventId,

      repositories: this.canonicalRepositories(),

      artistsById,

    });

    return this.lineupRepository.getLineupForEvent(eventId);

  }



  async getLineupArtistIds(eventId: string): Promise<string[]> {

    const lineup = await this.lineupRepository.getLineupForEvent(eventId);

    return lineup.map((entry) => entry.artist.id);

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



export { writeCanonicalStructuredLineup, syncCompatibilityProjectionFromStructured } from '@/features/events/services/canonical-structured-lineup-writer';


