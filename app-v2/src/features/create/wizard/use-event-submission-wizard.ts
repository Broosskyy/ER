import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EventDraftLinkLabels } from '@/features/create/mappers/event-draft-mapper';
import { mapAdminRecordToEventDraftForm } from '@/features/create/mappers/event-draft-mapper';
import { contributorEventService } from '@/features/create/services/contributor-event-service';
import type { EventDraftFieldErrors } from '@/features/create/types/event-draft-form';

import { autosaveWizardDraft, persistWizardDraftToContributor } from './event-submission-service';
import {
  createEmptyEventDraft,
  getEventWizardDraft,
  getEventWizardDraftByEventId,
  upsertEventWizardDraft,
} from './event-wizard-storage';
import type { EventDraft, EventFormData, WizardMode } from './wizard-types';
import { EMPTY_EVENT_WIZARD_EXTENSION } from './wizard-types';
import type { WizardStepId } from './wizard-steps';
import {
  getNextWizardStep,
  getPreviousWizardStep,
  WIZARD_STEP_IDS,
} from './wizard-steps';
import { validateFullSubmission, validateWizardStep } from './wizard-validation';

const AUTOSAVE_DEBOUNCE_MS = 2000;

export interface UseEventSubmissionWizardOptions {
  mode: WizardMode;
  eventId?: string;
  draftId?: string;
  userId: string;
  linkLabels: EventDraftLinkLabels;
  onDraftPersisted?: (eventId: string) => void;
}

export function useEventSubmissionWizard({
  mode,
  eventId,
  draftId,
  userId,
  linkLabels,
  onDraftPersisted,
}: UseEventSubmissionWizardOptions) {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EventDraftFieldErrors>({});
  const [extensionError, setExtensionError] = useState<string | undefined>();
  const [submitIssues, setSubmitIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadError(null);

      try {
        if (mode === 'editDraft' && eventId) {
          const existing =
            (await getEventWizardDraftByEventId(eventId)) ??
            (draftId ? await getEventWizardDraft(draftId) : null);

          if (existing) {
            if (!cancelled) {
              setDraft(existing);
            }
            return;
          }

          const record = await contributorEventService.getEvent(eventId, userId);
          if (!record || record.status !== 'draft') {
            throw new Error('Entwurf nicht gefunden.');
          }

          const mapped = createEmptyEventDraft({ eventId: record.id });
          mapped.formData.core = mapAdminRecordToEventDraftForm(record, linkLabels);
          mapped.currentStep = 'basics';
          if (!cancelled) {
            setDraft(mapped);
          }
          return;
        }

        if (draftId) {
          const existing = await getEventWizardDraft(draftId);
          if (!cancelled) {
            setDraft(existing ?? createEmptyEventDraft({ id: draftId }));
          }
          return;
        }

        if (!cancelled) {
          setDraft(createEmptyEventDraft());
        }
      } catch (cause) {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : 'Entwurf konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftId, eventId, linkLabels, mode, userId]);

  const scheduleAutosave = useCallback(
    (nextDraft: EventDraft) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(() => {
        void autosaveWizardDraft(nextDraft);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [],
  );

  const updateFormData = useCallback(
    (updater: (current: EventFormData) => EventFormData) => {
      setDraft((current) => {
        if (!current) {
          return current;
        }

        const next = {
          ...current,
          formData: updater(current.formData),
          updatedAt: new Date().toISOString(),
        };
        setDirty(true);
        scheduleAutosave(next);
        return next;
      });
    },
    [scheduleAutosave],
  );

  const setCurrentStep = useCallback((stepId: WizardStepId) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = { ...current, currentStep: stepId };
      scheduleAutosave(next);
      return next;
    });
  }, [scheduleAutosave]);

  const validateCurrentStep = useCallback((): boolean => {
    if (!draft) {
      return false;
    }

    const result = validateWizardStep(draft.currentStep, draft.formData);
    setFieldErrors(result.fieldErrors);
    setExtensionError(result.extensionError);
    setSubmitIssues(result.submitIssues ?? []);
    return result.isValid;
  }, [draft]);

  const goToNextStep = useCallback((): boolean => {
    if (!draft || !validateCurrentStep()) {
      return false;
    }

    const nextStep = getNextWizardStep(draft.currentStep);
    if (!nextStep) {
      return false;
    }

    const completedSteps = draft.completedSteps.includes(draft.currentStep)
      ? draft.completedSteps
      : [...draft.completedSteps, draft.currentStep];

    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = {
        ...current,
        currentStep: nextStep,
        completedSteps,
      };
      scheduleAutosave(next);
      return next;
    });

    setFieldErrors({});
    setExtensionError(undefined);
    return true;
  }, [draft, scheduleAutosave, validateCurrentStep]);

  const goToPreviousStep = useCallback(() => {
    if (!draft) {
      return;
    }

    const previous = getPreviousWizardStep(draft.currentStep);
    if (!previous) {
      return;
    }

    setCurrentStep(previous);
    setFieldErrors({});
    setExtensionError(undefined);
  }, [draft, setCurrentStep]);

  const saveDraft = useCallback(async (): Promise<string | null> => {
    if (!draft || persistLockRef.current) {
      return null;
    }

    persistLockRef.current = true;
    setSaving(true);

    try {
      const savedMeta = await upsertEventWizardDraft(draft);
      let eventIdResult = savedMeta.eventId;

      const validation = validateFullSubmission(savedMeta.formData);
      if (validation.isValid) {
        const record = await persistWizardDraftToContributor(savedMeta, userId, linkLabels);
        eventIdResult = record.id;
        const withEventId = await upsertEventWizardDraft({ ...savedMeta, eventId: record.id });
        setDraft(withEventId);
        onDraftPersisted?.(record.id);
      } else {
        setDraft(savedMeta);
      }

      setDirty(false);
      return eventIdResult ?? savedMeta.id;
    } finally {
      setSaving(false);
      persistLockRef.current = false;
    }
  }, [draft, linkLabels, onDraftPersisted, userId]);

  const jumpToStep = useCallback((stepId: WizardStepId) => {
    setCurrentStep(stepId);
    setFieldErrors({});
    setExtensionError(undefined);
  }, [setCurrentStep]);

  const validateAll = useCallback((): boolean => {
    if (!draft) {
      return false;
    }

    const result = validateFullSubmission(draft.formData);
    setFieldErrors(result.fieldErrors);
    setExtensionError(result.extensionError);
    setSubmitIssues(result.submitIssues ?? []);
    return result.isValid;
  }, [draft]);

  const progress = useMemo(() => {
    if (!draft) {
      return 0;
    }
    const index = WIZARD_STEP_IDS.indexOf(draft.currentStep);
    return Math.round(((index + 1) / WIZARD_STEP_IDS.length) * 100);
  }, [draft]);

  return {
    draft,
    loading,
    loadError,
    fieldErrors,
    extensionError,
    submitIssues,
    saving,
    dirty,
    progress,
    updateFormData,
    setCurrentStep,
    validateCurrentStep,
    goToNextStep,
    goToPreviousStep,
    saveDraft,
    jumpToStep,
    validateAll,
    setDirty,
  };
}
