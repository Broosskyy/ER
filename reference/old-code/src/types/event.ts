import { EventLifecycleStatus } from './lifecycle';

export interface Artist {
  id: string;
  name: string;
  label?: string;
  imageUrl: string;
}

export interface Organizer {
  id: string;
  name: string;
  imageUrl: string;
  verified: boolean;
  followers: number;
  eventsCount: number;
}

export interface Event {
  id: string;
  title: string;
  city: string;
  country: string;
  venue: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  genres: string[];
  ageRestriction?: string;
  ticketPrice: number;
  ticketPriceLabel: string;
  guestlistInfo?: string;
  imageUrl: string;
  imageGradient: [string, string];
  distanceKm: number;
  isFeatured: boolean;
  isVerified: boolean;
  isLiveSoon: boolean;
  organizer: Organizer;
  lineup: Artist[];
  latitude: number;
  longitude: number;
  description: string;
  lifecycleStatus: EventLifecycleStatus;
  ticketUrl?: string;
  sourceUrl?: string;
  /** ISO timestamp — used for "New events" sorting */
  publishedAt?: string;
}

export type DateFilterId = 'today' | 'tomorrow' | 'weekend' | 'month' | 'all';
export type GenreFilterId =
  | 'all'
  | 'techno'
  | 'house'
  | 'hardtechno'
  | 'melodic'
  | 'trance'
  | 'drumandbass'
  | 'psytrance'
  | 'hardcore'
  | 'industrial'
  | 'minimal';
export type CityFilterId =
  | 'all'
  | 'berlin'
  | 'hamburg'
  | 'koeln'
  | 'frankfurt'
  | 'amsterdam'
  | 'rotterdam'
  | 'vienna'
  | 'zurich'
  | 'prague'
  | 'barcelona'
  | 'london';

export interface StoryItem {
  id: string;
  label: string;
  imageUrl?: string;
  imageSource?: number;
}
