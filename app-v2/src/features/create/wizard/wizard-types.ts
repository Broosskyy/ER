import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';

import type { WizardStepId } from './wizard-steps';

export type WizardMode =
  | 'create'
  | 'editDraft'
  | 'editRequestedChanges'
  | 'editPublished'
  | 'claimImportedEvent';

export type TicketMode = 'free' | 'external' | 'none';

export type IndoorOutdoor = 'indoor' | 'outdoor' | '';

export interface LineupEntry {
  id: string;
  name: string;
  setTime?: string;
  stage?: string;
  headliner?: boolean;
}

export interface EventWizardExtension {
  organizerId: string;
  organizerDisplayName: string;
  organizerContactEmail: string;
  subtitle: string;
  genreIds: string[];
  lineup: LineupEntry[];
  shortDescription: string;
  highlights: string;
  awarenessNotes: string;
  entryRules: string;
  ticketMode: TicketMode;
  ticketProvider: string;
  priceFrom: string;
  priceTo: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  indoorOutdoor: IndoorOutdoor;
  secretLocation: boolean;
  timezone: string;
  multiDay: boolean;
  doorsOpen: string;
  tiktokUrl: string;
  telegramUrl: string;
  legalConfirmed: boolean;
  accuracyConfirmed: boolean;
}

export const EMPTY_EVENT_WIZARD_EXTENSION: EventWizardExtension = {
  organizerId: '',
  organizerDisplayName: '',
  organizerContactEmail: '',
  subtitle: '',
  genreIds: [],
  lineup: [],
  shortDescription: '',
  highlights: '',
  awarenessNotes: '',
  entryRules: '',
  ticketMode: 'none',
  ticketProvider: '',
  priceFrom: '',
  priceTo: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
  indoorOutdoor: '',
  secretLocation: false,
  timezone: 'Europe/Berlin',
  multiDay: false,
  doorsOpen: '',
  tiktokUrl: '',
  telegramUrl: '',
  legalConfirmed: false,
  accuracyConfirmed: false,
};

export interface EventFormData {
  core: EventDraftFormValues;
  extension: EventWizardExtension;
}

export type DraftStatus = 'draft' | 'submitted';

export interface EventDraft {
  id: string;
  eventId?: string;
  organizerId: string;
  currentStep: WizardStepId;
  completedSteps: WizardStepId[];
  formData: EventFormData;
  createdAt: string;
  updatedAt: string;
  autosavedAt?: string;
  status: DraftStatus;
}

export type SubmissionDisplayStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'needs_changes'
  | 'resubmitted'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'cancelled'
  | 'archived';

export interface SubmissionHistoryEntry {
  status: SubmissionDisplayStatus;
  at: string;
}

export interface EventSubmission {
  id: string;
  eventId: string;
  draftId: string;
  organizerId: string;
  status: SubmissionDisplayStatus;
  submittedAt: string;
  updatedAt: string;
  eventSnapshot: Record<string, unknown>;
  history: SubmissionHistoryEntry[];
}

export function createLineupEntry(name: string): LineupEntry {
  return {
    id: `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
  };
}

export function createDraftId(): string {
  return `wizard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
