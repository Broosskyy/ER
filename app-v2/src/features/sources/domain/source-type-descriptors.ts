import type { PublishMode } from '@/features/import/domain/publish-mode';
import type { SourcePublishBehavior } from '@/features/import/domain/publish-behavior';
import type { SourceEntityRole } from '@/features/sources/domain/source-entity-roles';
import type { SourceType } from '@/features/sources/domain/source-types';

/** Generic source-type taxonomy for platform-agnostic configuration. */
export const SOURCE_TYPE_DESCRIPTOR_IDS = [
  'VENUE_WEBSITE',
  'ORGANIZER_WEBSITE',
  'FESTIVAL_WEBSITE',
  'TICKETING_PLATFORM',
  'EVENT_AGGREGATOR',
  'SOCIAL_MEDIA',
  'API',
  'RSS',
  'CUSTOM',
] as const;

export type SourceTypeDescriptorId = (typeof SOURCE_TYPE_DESCRIPTOR_IDS)[number];

export interface SourceSchedulerDefaults {
  schedulePolicy: 'interval' | 'cron' | 'manual_only' | 'paused';
  scheduleIntervalPreset:
    | 'disabled'
    | 'manual'
    | 'every_15_minutes'
    | 'every_30_minutes'
    | 'hourly'
    | 'every_6_hours'
    | 'daily'
    | 'custom';
  pollingIntervalMinutes?: number;
}

export interface SourceTypeDescriptor {
  id: SourceTypeDescriptorId;
  label: string;
  /** Capabilities exposed to onboarding and discovery. */
  capabilities: readonly string[];
  defaultTrustScore: number;
  defaultPublishBehavior: SourcePublishBehavior;
  defaultPublishMode: PublishMode;
  schedulerDefaults: SourceSchedulerDefaults;
  /** Metadata keys commonly stored on sources of this type. */
  supportedMetadata: readonly string[];
}

const DESCRIPTOR_REGISTRY: Record<SourceTypeDescriptorId, SourceTypeDescriptor> = {
  VENUE_WEBSITE: {
    id: 'VENUE_WEBSITE',
    label: 'Venue Website',
    capabilities: ['list_discovery', 'html_cards', 'json_ld', 'event_detail_page'],
    defaultTrustScore: 76,
    defaultPublishBehavior: 'auto_publish',
    defaultPublishMode: 'auto_publish',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'every_6_hours',
      pollingIntervalMinutes: 360,
    },
    supportedMetadata: ['market', 'venueId', 'organizerId', 'category'],
  },
  ORGANIZER_WEBSITE: {
    id: 'ORGANIZER_WEBSITE',
    label: 'Organizer Website',
    capabilities: ['list_discovery', 'json_ld', 'event_detail_page', 'ical'],
    defaultTrustScore: 72,
    defaultPublishBehavior: 'manual_review',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'every_6_hours',
      pollingIntervalMinutes: 360,
    },
    supportedMetadata: ['market', 'organizerId', 'category'],
  },
  FESTIVAL_WEBSITE: {
    id: 'FESTIVAL_WEBSITE',
    label: 'Festival Website',
    capabilities: ['list_discovery', 'json_ld', 'event_detail_page'],
    defaultTrustScore: 70,
    defaultPublishBehavior: 'manual_review',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'daily',
      pollingIntervalMinutes: 1440,
    },
    supportedMetadata: ['market', 'festivalEditionId', 'category'],
  },
  TICKETING_PLATFORM: {
    id: 'TICKETING_PLATFORM',
    label: 'Ticketing Platform',
    capabilities: ['list_discovery', 'json_ld', 'ticket_checkout', 'electronic_scope_filter'],
    defaultTrustScore: 68,
    defaultPublishBehavior: 'enrichment',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'every_6_hours',
      pollingIntervalMinutes: 360,
    },
    supportedMetadata: ['market', 'platform', 'shopSlug', 'category'],
  },
  EVENT_AGGREGATOR: {
    id: 'EVENT_AGGREGATOR',
    label: 'Event Aggregator',
    capabilities: ['list_discovery', 'api', 'rss'],
    defaultTrustScore: 60,
    defaultPublishBehavior: 'enrichment',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'hourly',
      pollingIntervalMinutes: 60,
    },
    supportedMetadata: ['market', 'platform', 'category'],
  },
  SOCIAL_MEDIA: {
    id: 'SOCIAL_MEDIA',
    label: 'Social Media',
    capabilities: ['reference_only'],
    defaultTrustScore: 45,
    defaultPublishBehavior: 'manual_review',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'manual_only',
      scheduleIntervalPreset: 'manual',
    },
    supportedMetadata: ['market', 'platform', 'handle'],
  },
  API: {
    id: 'API',
    label: 'API Feed',
    capabilities: ['api', 'incremental_sync'],
    defaultTrustScore: 65,
    defaultPublishBehavior: 'manual_review',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'hourly',
      pollingIntervalMinutes: 60,
    },
    supportedMetadata: ['market', 'apiVersion'],
  },
  RSS: {
    id: 'RSS',
    label: 'RSS / Atom',
    capabilities: ['rss', 'atom', 'feed_discovery'],
    defaultTrustScore: 62,
    defaultPublishBehavior: 'manual_review',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'interval',
      scheduleIntervalPreset: 'hourly',
      pollingIntervalMinutes: 60,
    },
    supportedMetadata: ['market', 'feedUrl'],
  },
  CUSTOM: {
    id: 'CUSTOM',
    label: 'Custom Source',
    capabilities: ['manual_reference'],
    defaultTrustScore: 50,
    defaultPublishBehavior: 'manual_review',
    defaultPublishMode: 'manual_review',
    schedulerDefaults: {
      schedulePolicy: 'manual_only',
      scheduleIntervalPreset: 'manual',
    },
    supportedMetadata: ['market', 'category', 'notes'],
  },
};

export function getSourceTypeDescriptor(id: SourceTypeDescriptorId): SourceTypeDescriptor {
  return DESCRIPTOR_REGISTRY[id];
}

export function listSourceTypeDescriptors(): SourceTypeDescriptor[] {
  return SOURCE_TYPE_DESCRIPTOR_IDS.map((id) => DESCRIPTOR_REGISTRY[id]);
}

export function inferSourceTypeDescriptorId(input: {
  sourceType?: SourceType | string;
  sourceRoles?: readonly SourceEntityRole[] | string[];
  category?: string;
}): SourceTypeDescriptorId {
  const roles = input.sourceRoles ?? [];
  const sourceType = input.sourceType ?? 'unknown';

  if (sourceType === 'ticket_platform' || input.category === 'ticket_platform') {
    return 'TICKETING_PLATFORM';
  }
  if (sourceType === 'social') {
    return 'SOCIAL_MEDIA';
  }
  if (sourceType === 'api') {
    return 'API';
  }
  if (sourceType === 'rss' || sourceType === 'ical') {
    return 'RSS';
  }
  if (roles.includes('festival')) {
    return 'FESTIVAL_WEBSITE';
  }
  if (roles.includes('club') || roles.includes('venue')) {
    return 'VENUE_WEBSITE';
  }
  if (roles.includes('organizer')) {
    return 'ORGANIZER_WEBSITE';
  }
  if (sourceType === 'website') {
    return 'ORGANIZER_WEBSITE';
  }
  return 'CUSTOM';
}

export function resolveDescriptorForSource(input: {
  sourceType?: SourceType | string;
  sourceRoles?: readonly SourceEntityRole[] | string[];
  category?: string;
}): SourceTypeDescriptor {
  return getSourceTypeDescriptor(inferSourceTypeDescriptorId(input));
}
