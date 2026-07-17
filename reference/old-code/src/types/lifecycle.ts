import { Colors } from '@/constants/theme';

export type EventLifecycleStatus =
  | 'Draft'
  | 'Pending Review'
  | 'Imported Draft'
  | 'Needs Review'
  | 'Approved'
  | 'Published'
  | 'Rejected'
  | 'Duplicate'
  | 'Archived'
  | 'Deleted';

export type EventReviewStatus =
  | 'Pending Review'
  | 'Approved'
  | 'Published'
  | 'Rejected'
  | 'Duplicate';

export type ImportStatus =
  | 'Pending'
  | 'Parsed'
  | 'Imported Draft'
  | 'Needs Review'
  | 'Approved'
  | 'Rejected'
  | 'Duplicate';

export type ImportSource =
  | 'website'
  | 'instagram'
  | 'resident_advisor'
  | 'eventbrite'
  | 'shotgun'
  | 'plain_text'
  | 'csv'
  | 'flyer'
  | 'user_submission'
  | 'organizer';

export type EventType =
  | 'Club Night'
  | 'Festival'
  | 'Open Air'
  | 'Warehouse'
  | 'Afterhour'
  | 'Other';

export type EventGenre =
  | 'Techno'
  | 'Hard Techno'
  | 'House'
  | 'Melodic Techno'
  | 'Minimal'
  | 'Industrial'
  | 'Trance'
  | 'Psytrance'
  | 'Hardcore'
  | 'Drum & Bass'
  | 'Dubstep'
  | 'Electro'
  | 'Ambient'
  | 'Progressive'
  | 'Deep House'
  | 'Other';

export interface EventSubmission {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  country: string;
  venue: string;
  address: string;
  genres: string[];
  lineup: string;
  organizerName: string;
  ticketLink?: string;
  instagramLink?: string;
  websiteLink?: string;
  sourceLink?: string;
  price: number;
  ageRestriction?: string;
  eventType: EventType;
  description: string;
  status: EventReviewStatus;
  submittedAt: string;
  submittedBy: string;
  submittedByUserId?: string;
  source: ImportSource;
  duplicateWarning?: string;
  duplicateScore?: number;
  duplicateOfEventId?: string;
}

export interface OrganizerEventDraft {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  country: string;
  venue: string;
  address: string;
  genres: string[];
  lineup: string;
  description: string;
  eventType: EventType;
  ticketPrice: number;
  ticketLink?: string;
  instagramLink?: string;
  websiteLink?: string;
  status: EventLifecycleStatus;
  organizerId: string;
  organizerName: string;
  createdAt: string;
  updatedAt: string;
  duplicateWarning?: string;
  duplicateScore?: number;
  duplicateOfEventId?: string;
}

export interface ImportedEventDraft {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  country: string;
  venue: string;
  address: string;
  genres: string[];
  lineup: string;
  ticketLink?: string;
  ticketPrice?: number;
  sourceUrl: string;
  source: ImportSource;
  confidenceScore: number;
  duplicateWarning?: string;
  duplicateOfEventId?: string;
  status: ImportStatus;
  importedAt: string;
  description: string;
  pageType?: 'club_website' | 'event_page' | 'ticket_page' | 'instagram' | 'unknown';
}

export interface PublicEventFormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  country: string;
  venue: string;
  address: string;
  genres: string[];
  lineup: string;
  organizerName: string;
  ticketLink: string;
  instagramLink: string;
  websiteLink: string;
  sourceLink: string;
  price: string;
  ageRestriction: string;
  eventType: EventType;
  description: string;
  confirmed: boolean;
}

export interface OrganizerEventFormData {
  title: string;
  eventType: EventType;
  genres: string[];
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  lineup: string;
  ticketPrice: string;
  ticketLink: string;
  instagramLink: string;
  websiteLink: string;
}

export const EVENT_TYPES: EventType[] = [
  'Club Night',
  'Festival',
  'Open Air',
  'Warehouse',
  'Afterhour',
  'Other',
];

export const EVENT_GENRES: EventGenre[] = [
  'Techno',
  'Hard Techno',
  'House',
  'Melodic Techno',
  'Minimal',
  'Industrial',
  'Trance',
  'Psytrance',
  'Hardcore',
  'Drum & Bass',
  'Dubstep',
  'Electro',
  'Ambient',
  'Progressive',
  'Deep House',
  'Other',
];

export const PUBLIC_FEED_STATUSES: EventLifecycleStatus[] = ['Published'];

const LIFECYCLE_TO_REVIEW: Partial<Record<EventLifecycleStatus, EventReviewStatus>> = {
  'Pending Review': 'Pending Review',
  Approved: 'Approved',
  Published: 'Published',
  Rejected: 'Rejected',
  Duplicate: 'Duplicate',
};

export function lifecycleToReviewStatus(status: EventLifecycleStatus): EventReviewStatus {
  return LIFECYCLE_TO_REVIEW[status] ?? 'Pending Review';
}

export function statusColor(status: EventLifecycleStatus | EventReviewStatus | ImportStatus): string {
  switch (status) {
    case 'Published':
    case 'Approved':
      return Colors.success;
    case 'Pending Review':
    case 'Needs Review':
    case 'Imported Draft':
    case 'Pending':
    case 'Parsed':
      return Colors.warning;
    case 'Rejected':
      return Colors.live;
    case 'Duplicate':
      return Colors.textSecondary;
    case 'Archived':
      return Colors.textSecondary;
    case 'Deleted':
      return Colors.textSecondary;
    case 'Draft':
      return Colors.primary;
    default:
      return Colors.textSecondary;
  }
}
