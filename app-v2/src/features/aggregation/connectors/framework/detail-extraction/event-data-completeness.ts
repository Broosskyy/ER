import { hasMeaningfulEventValue, meaningfulEventText } from '@/features/events/domain/event-field-value';

export const EVENT_COMPLETENESS_FIELDS = [
  'title',
  'startDate',
  'venue',
  'organizer',
  'description',
  'artists',
  'genres',
  'ticketUrl',
  'priceText',
  'image',
  'address',
  'city',
  'country',
] as const;

export type EventCompletenessField = (typeof EVENT_COMPLETENESS_FIELDS)[number];

export interface EventCompletenessFieldState {
  field: EventCompletenessField;
  present: boolean;
  valuePreview?: string;
}

export interface EventDataCompleteness {
  percentage: number;
  presentCount: number;
  totalFields: number;
  fields: EventCompletenessFieldState[];
}

export interface EventCompletenessInput {
  title?: string;
  startDate?: string;
  venue?: string;
  organizer?: string;
  description?: string;
  artists?: string[];
  lineup?: string[];
  genres?: string[];
  ticketUrl?: string;
  priceText?: string;
  imageUrl?: string;
  address?: string;
  city?: string;
  country?: string;
}

function fieldPresent(field: EventCompletenessField, input: EventCompletenessInput): boolean {
  switch (field) {
    case 'title':
    case 'startDate':
      return hasMeaningfulEventValue(input[field]);
    case 'venue':
      return hasMeaningfulEventValue(input.venue);
    case 'organizer':
      return hasMeaningfulEventValue(input.organizer);
    case 'description':
      return hasMeaningfulEventValue(input.description);
    case 'artists':
      return (input.lineup?.length ?? 0) > 0 || (input.artists?.length ?? 0) > 0;
    case 'genres':
      return (input.genres?.length ?? 0) > 0;
    case 'ticketUrl':
      return hasMeaningfulEventValue(input.ticketUrl);
    case 'priceText':
      return hasMeaningfulEventValue(input.priceText);
    case 'image':
      return hasMeaningfulEventValue(input.imageUrl);
    case 'address':
      return hasMeaningfulEventValue(input.address);
    case 'city':
      return hasMeaningfulEventValue(input.city);
    case 'country':
      return hasMeaningfulEventValue(input.country);
    default:
      return false;
  }
}

function previewValue(field: EventCompletenessField, input: EventCompletenessInput): string | undefined {
  switch (field) {
    case 'title':
      return meaningfulEventText(input.title);
    case 'description':
      return meaningfulEventText(input.description)?.slice(0, 80);
    case 'artists':
      return (input.lineup?.length ? input.lineup : input.artists)?.slice(0, 3).join(', ');
    case 'genres':
      return input.genres?.slice(0, 3).join(', ');
    default:
      return meaningfulEventText((input as Record<string, unknown>)[field] as string | undefined);
  }
}

export function calculateEventDataCompleteness(input: EventCompletenessInput): EventDataCompleteness {
  const fields = EVENT_COMPLETENESS_FIELDS.map((field) => {
    const present = fieldPresent(field, input);
    return {
      field,
      present,
      valuePreview: present ? previewValue(field, input) : undefined,
    };
  });
  const presentCount = fields.filter((field) => field.present).length;
  return {
    percentage: Math.round((presentCount / EVENT_COMPLETENESS_FIELDS.length) * 100),
    presentCount,
    totalFields: EVENT_COMPLETENESS_FIELDS.length,
    fields,
  };
}

export function averageCompletenessPercentage(samples: EventDataCompleteness[]): number {
  if (samples.length === 0) {
    return 0;
  }
  const total = samples.reduce((sum, sample) => sum + sample.percentage, 0);
  return Math.round(total / samples.length);
}
