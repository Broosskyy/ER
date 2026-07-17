import {
  hasValidCoordinates,
  isValidLatitude,
  isValidLongitude,
} from '../formatting/coordinates';
import { getDefaultTimezone, isValidIsoDateTime } from '../formatting/date-time';
import { isValidHttpUrl } from '../formatting/urls';
import type { Event } from '../types/event';
import { isEventStatus } from '../types/event-status';

import { createValidationResult, type ValidationResult } from './validation-result';

export function validateEvent(event: Event): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!event.id.trim()) {
    errors.push('Missing stable id');
  }

  if (!event.slug.trim()) {
    errors.push('Missing slug');
  }

  if (!event.title.trim()) {
    errors.push('Missing title');
  }

  if (!isValidIsoDateTime(event.startDateTime)) {
    errors.push('Invalid startDateTime');
  }

  if (event.endDateTime && !isValidIsoDateTime(event.endDateTime)) {
    errors.push('Invalid endDateTime');
  }

  if (!event.venue.trim() && !event.city.trim()) {
    errors.push('City or venue is required');
  }

  if (!event.source.trim()) {
    errors.push('Missing source');
  }

  if (!event.sourceEventId.trim()) {
    errors.push('Missing sourceEventId');
  }

  if (!isEventStatus(event.status)) {
    errors.push('Invalid status');
  }

  if (!event.timezone.trim()) {
    errors.push('Missing timezone');
  } else if (event.timezone !== getDefaultTimezone()) {
    warnings.push(`Non-default timezone: ${event.timezone}`);
  }

  if (event.ticketUrl && !isValidHttpUrl(event.ticketUrl)) {
    errors.push('Invalid ticketUrl');
  }

  if (event.sourceUrl && !isValidHttpUrl(event.sourceUrl)) {
    errors.push('Invalid sourceUrl');
  }

  if (event.imageUrl && !isValidHttpUrl(event.imageUrl)) {
    errors.push('Invalid imageUrl');
  }

  if (event.latitude !== undefined && !isValidLatitude(event.latitude)) {
    errors.push('Invalid latitude');
  }

  if (event.longitude !== undefined && !isValidLongitude(event.longitude)) {
    errors.push('Invalid longitude');
  }

  if (
    (event.latitude !== undefined || event.longitude !== undefined) &&
    !hasValidCoordinates(event.latitude, event.longitude)
  ) {
    errors.push('Latitude and longitude must both be valid when either is present');
  }

  if (!Array.isArray(event.genres)) {
    errors.push('Genres must be an array');
  }

  if (!Array.isArray(event.artists)) {
    errors.push('Artists must be an array');
  }

  if (!event.description.trim()) {
    warnings.push('Missing description');
  }

  if (!event.country.trim()) {
    warnings.push('Missing country');
  }

  return createValidationResult(errors, warnings);
}
