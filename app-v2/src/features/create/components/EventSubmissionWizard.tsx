import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { Banner } from '@/components/feedback/Banner';
import { Dialog } from '@/components/overlay/Dialog';
import {
  SubmissionFooterActions,
  SubmissionStepHeader,
} from '@/components/organizer/SubmissionComponents';
import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { useEventDraftFormLabels } from '@/features/create/hooks/useEventDraftFormLabels';
import { useEventDraftReferenceData } from '@/features/create/hooks/useEventDraftReferenceData';
import {
  buildContributorEventSuccessHref,
} from '@/features/create/constants/contributor-event-routes';
import type { EventDraftValidationKey } from '@/features/create/types/event-draft-form';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { useScreenBottomInset } from '@/platform/screen-insets';

import { EventWizardDetailPreview } from './wizard/EventWizardDetailPreview';
import { WizardStepContent } from './wizard/WizardStepContent';
import { submitWizardEvent } from '../wizard/event-submission-service';
import type { WizardMode } from '../wizard/wizard-types';
import {
  WIZARD_STEP_DESCRIPTIONS,
  WIZARD_STEP_IDS,
  WIZARD_STEP_LABELS,
} from '../wizard/wizard-steps';
import { useEventSubmissionWizard } from '../wizard/use-event-submission-wizard';

export interface EventSubmissionWizardProps {
  mode: WizardMode;
  eventId?: string;
  draftId?: string;
  userId: string;
  linkLabels: {
    website: string;
    instagram: string;
    facebook: string;
  };
}

export function EventSubmissionWizard({
  mode,
  eventId,
  draftId,
  userId,
  linkLabels,
}: EventSubmissionWizardProps) {
  const router = useRouter();
  const { t } = useAppTranslation();
  const bottomInset = useScreenBottomInset();
  const { data: referenceData, loading: optionsLoading } = useEventDraftReferenceData();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false);
  const submitLockRef = useRef(false);

  const wizard = useEventSubmissionWizard({
    mode,
    eventId,
    draftId,
    userId,
    linkLabels,
    onDraftPersisted: (id) => {
      if (!eventId) {
        router.setParams?.({ draftId: id } as never);
      }
    },
  });

  const translateError = useCallback(
    (key?: EventDraftValidationKey) => (key ? t(key) : undefined),
    [t],
  );

  const stepIndex = wizard.draft ? WIZARD_STEP_IDS.indexOf(wizard.draft.currentStep) + 1 : 1;
  const isFirstStep = wizard.draft?.currentStep === WIZARD_STEP_IDS[0];
  const isLastStep = wizard.draft?.currentStep === 'submit';
  const isPreviewStep = wizard.draft?.currentStep === 'preview';

  const { imageLabels } = useEventDraftFormLabels(mode === 'editDraft' ? 'edit' : 'create');

  const handleBackPress = useCallback(() => {
    if (wizard.dirty) {
      setLeaveDialogVisible(true);
      return true;
    }

    if (isFirstStep) {
      router.back();
      return true;
    }

    wizard.goToPreviousStep();
    return true;
  }, [isFirstStep, router, wizard]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  const handleSaveAndLeave = async () => {
    await wizard.saveDraft();
    setLeaveDialogVisible(false);
    router.back();
  };

  const handleDiscardAndLeave = () => {
    wizard.setDirty(false);
    setLeaveDialogVisible(false);
    router.back();
  };

  const handleNext = () => {
    if (isPreviewStep) {
      wizard.setCurrentStep('submit');
      return;
    }

    if (!wizard.goToNextStep() && wizard.draft?.currentStep === 'social') {
      wizard.setCurrentStep('preview');
    }
  };

  const handleSubmit = async () => {
    if (!wizard.draft || !wizard.validateAll() || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await wizard.saveDraft();
      const { submission } = await submitWizardEvent({
        draftId: wizard.draft.id,
        userId,
        linkLabels,
      });
      router.replace(
        `/create/event/status/${submission.id}` as '/create/event/submitted',
      );
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : t('create.event.errors.submitFailed'));
      submitLockRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  if (wizard.loading || optionsLoading || !wizard.draft) {
    return (
      <View style={styles.loading}>
        <AppText>{t('common.labels.loading')}</AppText>
      </View>
    );
  }

  if (wizard.loadError) {
    return (
      <View style={styles.loading}>
        <AppText style={styles.error}>{wizard.loadError}</AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <IconButton
          icon="arrow-back"
          accessibilityLabel={t('common.actions.back')}
          onPress={handleBackPress}
        />
        <AppText role="caption" style={styles.progressText}>
          Schritt {stepIndex} von {WIZARD_STEP_IDS.length}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SubmissionStepHeader
          stepIndex={stepIndex}
          totalSteps={WIZARD_STEP_IDS.length}
          title={WIZARD_STEP_LABELS[wizard.draft.currentStep]}
          description={WIZARD_STEP_DESCRIPTIONS[wizard.draft.currentStep]}
        />

        {isPreviewStep ? (
          <EventWizardDetailPreview
            formData={wizard.draft.formData}
            eventId={wizard.draft.eventId ?? wizard.draft.id}
            userId={userId}
          />
        ) : (
          <WizardStepContent
            stepId={wizard.draft.currentStep}
            formData={wizard.draft.formData}
            fieldErrors={wizard.fieldErrors}
            extensionError={wizard.extensionError}
            submitIssues={wizard.submitIssues}
            genreOptions={referenceData.genreOptions}
            venues={referenceData.venues}
            imageLabels={imageLabels}
            disabled={submitting || wizard.saving}
            onFormDataChange={wizard.updateFormData}
            translateError={translateError}
          />
        )}

        {submitError ? (
          <Banner title="Fehler" message={submitError} variant="error" />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + spacing.md }]}>
        <SubmissionFooterActions
          onBack={!isFirstStep ? wizard.goToPreviousStep : undefined}
          onNext={!isLastStep ? handleNext : undefined}
          onSaveDraft={() => void wizard.saveDraft().then((id) => {
            if (id) {
              router.push(buildContributorEventSuccessHref(id) as '/create/event/success');
            }
          })}
          onSubmit={isLastStep ? () => void handleSubmit() : undefined}
          backLabel="Zurück"
          nextLabel={isPreviewStep ? 'Zur Einreichung' : 'Weiter'}
          saveDraftLabel={wizard.saving ? 'Speichert…' : 'Entwurf speichern'}
          submitLabel={submitting ? 'Wird eingereicht…' : 'Event einreichen'}
          loading={submitting || wizard.saving}
          disabled={submitting || wizard.saving}
        />
      </View>

      <Dialog
        visible={leaveDialogVisible}
        title="Ungespeicherte Änderungen"
        message="Möchtest du deinen Fortschritt speichern, bevor du den Wizard verlässt?"
        confirmLabel="Entwurf speichern"
        cancelLabel="Weiter bearbeiten"
        onConfirm={() => void handleSaveAndLeave()}
        onCancel={() => setLeaveDialogVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacing.sm,
  },
  progressText: {
    color: colors.textSecondary,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  error: {
    ...textRoles.body,
    color: colors.live,
    textAlign: 'center',
  },
});
