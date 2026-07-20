export interface EventImageDraft {
  /** Persisted remote URL after upload. */
  remoteUrl: string;
  /** Local preview URI before upload completes. */
  localUri: string;
  mimeType?: string;
  fileName?: string;
}

export interface EventDraftFormValues {
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venueId: string;
  venueText: string;
  genreId: string;
  description: string;
  ticketUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  coverImage: EventImageDraft | null;
  flyerImage: EventImageDraft | null;
}

export const EMPTY_EVENT_DRAFT_FORM: EventDraftFormValues = {
  title: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  venueId: '',
  venueText: '',
  genreId: '',
  description: '',
  ticketUrl: '',
  websiteUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  coverImage: null,
  flyerImage: null,
};

export type EventDraftField = keyof EventDraftFormValues;

export type EventDraftValidationKey =
  | 'create.event.errors.titleRequired'
  | 'create.event.errors.titleTooLong'
  | 'create.event.errors.startDateRequired'
  | 'create.event.errors.startDateInvalid'
  | 'create.event.errors.startTimeRequired'
  | 'create.event.errors.startTimeInvalid'
  | 'create.event.errors.endDateInvalid'
  | 'create.event.errors.endTimeInvalid'
  | 'create.event.errors.endBeforeStart'
  | 'create.event.errors.venueRequired'
  | 'create.event.errors.genreRequired'
  | 'create.event.errors.descriptionRequired'
  | 'create.event.errors.descriptionTooLong'
  | 'create.event.errors.invalidUrl'
  | 'create.event.errors.imageTypeInvalid'
  | 'create.event.errors.imageTooLarge'
  | 'create.event.errors.imageUploadFailed'
  | 'create.event.errors.generic'
  | 'create.event.errors.notFound'
  | 'create.event.errors.notEditable'
  | 'create.event.errors.submitFailed';

export type EventDraftFieldErrors = Partial<Record<EventDraftField, EventDraftValidationKey>>;

export type EventImageField = 'coverImage' | 'flyerImage';
