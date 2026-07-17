import { DbLifecycleStatus } from '@/types/database';
import { EventDraftInput, EventEntity, EventSubmissionInput } from '@/domain/event/types';
import { canTransition } from '@/domain/event/status';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const URL_PATTERN = /^https?:\/\/.+/i;

export function validateRequiredString(value: string | undefined | null, field: string): string | null {
  if (!value?.trim()) return `${field} is required`;
  return null;
}

export function validateTicketUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  if (!URL_PATTERN.test(url.trim())) return 'Ticket URL must start with http:// or https://';
  return null;
}

export function validateSchedule(startDatetime: string, endDatetime?: string | null): string[] {
  const errors: string[] = [];
  const start = Date.parse(startDatetime);
  if (Number.isNaN(start)) errors.push('Start date/time is invalid');
  if (endDatetime) {
    const end = Date.parse(endDatetime);
    if (Number.isNaN(end)) errors.push('End date/time is invalid');
    else if (!Number.isNaN(start) && end < start) errors.push('End must be after start');
  }
  return errors;
}

export function validateEventDraft(input: Partial<EventDraftInput>): ValidationResult {
  const errors: string[] = [];

  const titleErr = validateRequiredString(input.title, 'Title');
  if (titleErr) errors.push(titleErr);

  if (input.schedule?.startDatetime) {
    errors.push(...validateSchedule(input.schedule.startDatetime, input.schedule.endDatetime));
  } else {
    errors.push('Start date/time is required');
  }

  const cityErr = validateRequiredString(input.address?.city, 'City');
  if (cityErr) errors.push(cityErr);

  const venueErr = validateRequiredString(input.address?.venueName, 'Venue');
  if (venueErr) errors.push(venueErr);

  const ticketErr = validateTicketUrl(input.ticketUrl);
  if (ticketErr) errors.push(ticketErr);

  return { valid: errors.length === 0, errors };
}

export function validateEventSubmission(input: EventSubmissionInput): ValidationResult {
  return validateEventDraft({
    title: input.title,
    schedule: input.schedule,
    address: input.address,
    ticketUrl: input.ticketUrl,
  });
}

export function validateStatusTransition(from: DbLifecycleStatus, to: DbLifecycleStatus): ValidationResult {
  if (canTransition(from, to)) return { valid: true, errors: [] };
  return { valid: false, errors: [`Cannot transition from ${from} to ${to}`] };
}

export function validateEntityForPublish(entity: EventEntity): ValidationResult {
  const base = validateEventDraft(entity);
  if (!base.valid) return base;
  if (entity.status !== 'approved' && entity.status !== 'pending_review') {
    return { valid: false, errors: ['Event must be approved before publishing'] };
  }
  return { valid: true, errors: [] };
}

/** Duplicate detection hook-in — returns warning only (Sprint 3 prep) */
export function validateDuplicatePrep(_entity: Partial<EventEntity>): ValidationResult {
  return { valid: true, errors: [] };
}
