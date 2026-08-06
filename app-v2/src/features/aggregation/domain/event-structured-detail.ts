/** Timetable, running order and structured event attributes — import domain (Part 4.6.3). */

export interface TimetableSlotEntry {
  displayName: string;
  normalizedName?: string;
  artistId?: string;
  stageOrFloor?: string;
  startTime?: string;
  endTime?: string;
  performanceDate?: string;
  performanceType?: string;
  source: string;
  confidence: number;
}

export interface RunningOrderEntry {
  displayName: string;
  normalizedName?: string;
  stageOrFloor?: string;
  sortOrder: number;
  role?: string;
  source: string;
  confidence: number;
}

export type EventAttributeKey =
  | 'indoor'
  | 'outdoor'
  | 'open_air'
  | 'festival'
  | 'club_night'
  | 'day_rave'
  | 'afterhour'
  | 'concert'
  | 'multi_floor'
  | 'accessible'
  | 'official_source'
  | 'free'
  | 'waiting_list'
  | 'guest_list';

export interface SourcedEventAttribute {
  key: EventAttributeKey;
  label: string;
  value?: string | number | boolean;
  source: string;
  confidence: number;
}

export interface StructuredEventDetailSections {
  minimumAge?: string;
  admissionPolicy?: string;
  doorsOpenAt?: string;
  lastEntry?: string;
  dressCode?: string;
  faq?: string;
  organizerNotes?: string;
  venueNotes?: string;
}
