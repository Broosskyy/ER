import { useCallback, useState } from 'react';

import {
  EMPTY_EVENT_DRAFT_FORM,
  type EventDraftField,
  type EventDraftFieldErrors,
  type EventDraftFormValues,
  type EventDraftValidationKey,
} from '@/features/create/types/event-draft-form';
import {
  hasEventDraftErrors,
  validateEventDraftForm,
} from '@/features/create/validation/event-draft-validation';

function updateFormField<K extends EventDraftField>(
  current: EventDraftFormValues,
  field: K,
  value: EventDraftFormValues[K],
): EventDraftFormValues {
  return { ...current, [field]: value };
}

export function useEventDraftFormState(initialValues: EventDraftFormValues = EMPTY_EVENT_DRAFT_FORM) {
  const [form, setForm] = useState<EventDraftFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<EventDraftFieldErrors>({});

  const setFieldValue = useCallback(<K extends EventDraftField>(field: K, value: EventDraftFormValues[K]) => {
    setForm((current) => updateFormField(current, field, value));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const validate = useCallback((): EventDraftFieldErrors => {
    const errors = validateEventDraftForm(form);
    setFieldErrors(errors);
    return errors;
  }, [form]);

  const resetForm = useCallback((nextValues: EventDraftFormValues) => {
    setForm(nextValues);
    setFieldErrors({});
  }, []);

  const translateFieldError = useCallback(
    (key: EventDraftValidationKey | undefined, translate: (key: EventDraftValidationKey) => string) =>
      key ? translate(key) : undefined,
    [],
  );

  return {
    form,
    fieldErrors,
    setFieldValue,
    validate,
    resetForm,
    hasErrors: hasEventDraftErrors(fieldErrors),
    translateFieldError,
  };
}
