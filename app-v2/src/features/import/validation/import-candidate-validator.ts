import { FIELD_LIMITS } from '@/features/import/config/import-config';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import { isEndBeforeStart } from '@/features/import/normalization/date-time-normalizer';
import { validateUrl } from '@/features/import/normalization/url-normalizer';
import type {
  CandidateValidationResult,
  ValidationIssue,
} from '@/features/import/validation/validation-codes';

function hasLocationInfo(candidate: NormalizedEventCandidate): boolean {
  return Boolean(
    candidate.venueName ||
      candidate.cityName ||
      candidate.venueAddress ||
      (candidate.latitude !== undefined && candidate.longitude !== undefined),
  );
}

export class ImportCandidateValidator {
  validate(candidate: NormalizedEventCandidate): CandidateValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!candidate.title?.trim()) {
      errors.push({ code: 'TITLE_MISSING', field: 'title', message: 'Title is required.' });
    } else if (candidate.title.length > FIELD_LIMITS.title) {
      errors.push({
        code: 'FIELD_TOO_LONG',
        field: 'title',
        message: `Title exceeds ${FIELD_LIMITS.title} characters.`,
      });
    }

    if (!candidate.startDate) {
      errors.push({
        code: 'START_DATE_MISSING',
        field: 'startDate',
        message: 'Start date is required.',
      });
    } else if (Number.isNaN(new Date(candidate.startDate).getTime())) {
      errors.push({
        code: 'START_DATE_INVALID',
        field: 'startDate',
        message: 'Start date is invalid.',
      });
    }

    if (candidate.endDate) {
      if (Number.isNaN(new Date(candidate.endDate).getTime())) {
        errors.push({
          code: 'END_DATE_INVALID',
          field: 'endDate',
          message: 'End date is invalid.',
        });
      } else if (candidate.startDate && isEndBeforeStart(candidate.startDate, candidate.endDate)) {
        errors.push({
          code: 'END_DATE_BEFORE_START',
          field: 'endDate',
          message: 'End date must not be before start date.',
        });
      }
    } else {
      warnings.push({
        code: 'END_DATE_MISSING',
        field: 'endDate',
        message: 'End date is missing.',
      });
    }

    if (!hasLocationInfo(candidate)) {
      errors.push({
        code: 'LOCATION_MISSING',
        field: 'location',
        message: 'At least one location field is required.',
      });
    }

    if (!candidate.timezone) {
      warnings.push({
        code: 'TIMEZONE_MISSING',
        field: 'timezone',
        message: 'Timezone is missing.',
      });
    }

    if (!candidate.description) {
      warnings.push({
        code: 'DESCRIPTION_MISSING',
        field: 'description',
        message: 'Description is missing.',
      });
    }

    for (const field of ['eventUrl', 'ticketUrl', 'imageUrl', 'sourceUrl'] as const) {
      const value = candidate[field];
      if (value && !validateUrl(value).valid) {
        errors.push({
          code: 'URL_INVALID',
          field,
          message: `Invalid URL in ${field}.`,
        });
      }
    }

    if (candidate.latitude !== undefined) {
      if (candidate.latitude < -90 || candidate.latitude > 90) {
        errors.push({
          code: 'COORDINATES_INVALID',
          field: 'latitude',
          message: 'Latitude out of range.',
        });
      }
    }
    if (candidate.longitude !== undefined) {
      if (candidate.longitude < -180 || candidate.longitude > 180) {
        errors.push({
          code: 'COORDINATES_INVALID',
          field: 'longitude',
          message: 'Longitude out of range.',
        });
      }
    }

    if (candidate.countryCode && !/^[A-Z]{2,3}$/.test(candidate.countryCode)) {
      errors.push({
        code: 'COUNTRY_CODE_INVALID',
        field: 'countryCode',
        message: 'Country code must be 2-3 letters.',
      });
    }

    if (candidate.minimumAge !== undefined) {
      if (candidate.minimumAge < 0 || candidate.minimumAge > 99) {
        errors.push({
          code: 'MINIMUM_AGE_INVALID',
          field: 'minimumAge',
          message: 'Minimum age is out of range.',
        });
      }
    }

    if (candidate.description && candidate.description.length > FIELD_LIMITS.description) {
      warnings.push({
        code: 'FIELD_TRUNCATED',
        field: 'description',
        message: 'Description was truncated during normalization.',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedCandidate: candidate,
    };
  }
}

export const importCandidateValidator = new ImportCandidateValidator();
