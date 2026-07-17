import { Colors } from '@/constants/theme';

export type EventSourceType =
  | 'ticketmaster'
  | 'eventbrite'
  | 'eventim'
  | 'shotgun'
  | 'resident_advisor'
  | 'club_website'
  | 'festival_website'
  | 'instagram'
  | 'csv'
  | 'text_paste'
  | 'flyer_upload';

export type EventSourceImportStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'needs_review'
  | 'failed';

export interface ManagedEventSource {
  id: string;
  name: string;
  sourceType: EventSourceType;
  url: string;
  country: string;
  city: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  importStatus: EventSourceImportStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedEventSourceFormData {
  name: string;
  sourceType: EventSourceType;
  url: string;
  country: string;
  city: string;
  isActive: boolean;
  notes: string;
}

export const EVENT_SOURCE_TYPES: { id: EventSourceType; label: string }[] = [
  { id: 'ticketmaster', label: 'Ticketmaster' },
  { id: 'eventbrite', label: 'Eventbrite' },
  { id: 'eventim', label: 'Eventim' },
  { id: 'shotgun', label: 'Shotgun' },
  { id: 'resident_advisor', label: 'Resident Advisor' },
  { id: 'club_website', label: 'Club Website' },
  { id: 'festival_website', label: 'Festival Website' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'csv', label: 'CSV' },
  { id: 'text_paste', label: 'Text Paste' },
  { id: 'flyer_upload', label: 'Flyer Upload' },
];

export const EVENT_SOURCE_IMPORT_STATUSES: EventSourceImportStatus[] = [
  'idle',
  'queued',
  'running',
  'success',
  'needs_review',
  'failed',
];

export function eventSourceTypeLabel(type: EventSourceType): string {
  return EVENT_SOURCE_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function importStatusColor(status: EventSourceImportStatus): string {
  switch (status) {
    case 'success':
      return Colors.success;
    case 'running':
    case 'queued':
      return Colors.warning;
    case 'needs_review':
      return Colors.primaryHighlight;
    case 'failed':
      return Colors.live;
    default:
      return Colors.textSecondary;
  }
}

export function mapEventSourceTypeToLegacyImport(type: EventSourceType): string {
  const map: Record<EventSourceType, string> = {
    ticketmaster: 'eventbrite',
    eventbrite: 'eventbrite',
    eventim: 'eventbrite',
    shotgun: 'shotgun',
    resident_advisor: 'resident_advisor',
    club_website: 'website',
    festival_website: 'website',
    instagram: 'instagram',
    csv: 'csv',
    text_paste: 'plain_text',
    flyer_upload: 'flyer',
  };
  return map[type];
}
