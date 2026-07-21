import { useMemo } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FormField } from '@/features/create/components/FormField';
import { EventImagesSection, type EventImagesSectionLabels } from '@/features/create/components/EventImagesSection';
import { GenrePicker } from '@/features/create/components/GenrePicker';
import { VenueAutocomplete } from '@/features/create/components/VenueAutocomplete';
import type { VenueRecord } from '@/data/types/records';
import type {
  EventDraftField,
  EventDraftFieldErrors,
  EventDraftFormValues,
  EventDraftValidationKey,
  EventImageField,
} from '@/features/create/types/event-draft-form';

export type EventDraftFormMode = 'create' | 'edit';

export interface EventDraftFormLabels {
  title: string;
  subtitle: string;
  fields: Record<EventDraftField, string>;
  helpers: Partial<Record<EventDraftField, string>>;
  placeholders: {
    title: string;
    date: string;
    time: string;
    venue: string;
    description: string;
  };
  venueFreeTextHint: string;
  optionalFieldLabel: string;
  submit: string;
  submitting: string;
  preview: string;
}

export interface EventDraftFormProps {
  mode: EventDraftFormMode;
  form: EventDraftFormValues;
  fieldErrors: EventDraftFieldErrors;
  genreOptions: Array<{ id: string; label: string }>;
  venues: VenueRecord[];
  labels: EventDraftFormLabels;
  imageLabels: EventImagesSectionLabels;
  submitting: boolean;
  submitError: string | null;
  imageErrors: Partial<Record<EventImageField, string>>;
  onFieldChange: <K extends EventDraftField>(field: K, value: EventDraftFormValues[K]) => void;
  onImageChange: (field: EventImageField, value: EventDraftFormValues[EventImageField]) => void;
  onImageError: (field: EventImageField, message: string | undefined) => void;
  onSubmit: () => void;
  onPreview?: () => void;
  translateError: (key?: EventDraftValidationKey) => string | undefined;
}

export function EventDraftForm({
  form,
  fieldErrors,
  genreOptions,
  venues,
  labels,
  imageLabels,
  submitting,
  submitError,
  imageErrors,
  onFieldChange,
  onImageChange,
  onImageError,
  onSubmit,
  onPreview,
  translateError,
}: EventDraftFormProps) {
  const inputStyle = useMemo(() => styles.input, []);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <AppText accessibilityRole="header" style={styles.title}>
        {labels.title}
      </AppText>
      <AppText style={styles.subtitle}>{labels.subtitle}</AppText>

      <FormField
        label={labels.fields.title}
        helper={labels.helpers.title}
        error={translateError(fieldErrors.title)}
        nativeId="event-draft-title-label"
        required
      >
        <TextInput
          value={form.title}
          onChangeText={(value) => onFieldChange('title', value)}
          style={inputStyle}
          placeholder={labels.placeholders.title}
          placeholderTextColor={colorRoles.emptyStateDescription}
          accessibilityLabelledBy="event-draft-title-label"
        />
      </FormField>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <FormField
            label={labels.fields.startDate}
            helper={labels.helpers.startDate}
            error={translateError(fieldErrors.startDate)}
            required
          >
            <TextInput
              value={form.startDate}
              onChangeText={(value) => onFieldChange('startDate', value)}
              style={inputStyle}
              placeholder={labels.placeholders.date}
              placeholderTextColor={colorRoles.emptyStateDescription}
              autoCapitalize="none"
            />
          </FormField>
        </View>
        <View style={styles.rowItem}>
          <FormField
            label={labels.fields.startTime}
            helper={labels.helpers.startTime}
            error={translateError(fieldErrors.startTime)}
            required
          >
            <TextInput
              value={form.startTime}
              onChangeText={(value) => onFieldChange('startTime', value)}
              style={inputStyle}
              placeholder={labels.placeholders.time}
              placeholderTextColor={colorRoles.emptyStateDescription}
              autoCapitalize="none"
            />
          </FormField>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <FormField
            label={labels.fields.endDate}
            helper={labels.helpers.endDate}
            error={translateError(fieldErrors.endDate)}
            optionalLabel={labels.optionalFieldLabel}
          >
            <TextInput
              value={form.endDate}
              onChangeText={(value) => onFieldChange('endDate', value)}
              style={inputStyle}
              placeholder={labels.placeholders.date}
              placeholderTextColor={colorRoles.emptyStateDescription}
              autoCapitalize="none"
            />
          </FormField>
        </View>
        <View style={styles.rowItem}>
          <FormField
            label={labels.fields.endTime}
            helper={labels.helpers.endTime}
            error={translateError(fieldErrors.endTime)}
            optionalLabel={labels.optionalFieldLabel}
          >
            <TextInput
              value={form.endTime}
              onChangeText={(value) => onFieldChange('endTime', value)}
              style={inputStyle}
              placeholder={labels.placeholders.time}
              placeholderTextColor={colorRoles.emptyStateDescription}
              autoCapitalize="none"
            />
          </FormField>
        </View>
      </View>

      <VenueAutocomplete
        label={labels.fields.venueText}
        helper={labels.helpers.venueText}
        error={translateError(fieldErrors.venueText)}
        venues={venues}
        venueId={form.venueId}
        venueText={form.venueText}
        onVenueIdChange={(venueId) => onFieldChange('venueId', venueId)}
        onVenueTextChange={(venueText) => onFieldChange('venueText', venueText)}
        placeholder={labels.placeholders.venue}
        freeTextHint={labels.venueFreeTextHint}
      />

      <GenrePicker
        label={labels.fields.genreId}
        helper={labels.helpers.genreId}
        error={translateError(fieldErrors.genreId)}
        options={genreOptions}
        value={form.genreId}
        onChange={(genreId) => onFieldChange('genreId', genreId)}
      />

      <EventImagesSection
        coverImage={form.coverImage}
        flyerImage={form.flyerImage}
        labels={imageLabels}
        disabled={submitting}
        coverError={imageErrors.coverImage}
        flyerError={imageErrors.flyerImage}
        onImageChange={onImageChange}
        onImageError={onImageError}
        translateError={(key) => (key ? translateError(key as EventDraftValidationKey) : undefined)}
      />

      <FormField
        label={labels.fields.description}
        helper={labels.helpers.description}
        error={translateError(fieldErrors.description)}
        required
      >
        <TextInput
          value={form.description}
          onChangeText={(value) => onFieldChange('description', value)}
          style={[inputStyle, styles.textArea]}
          placeholder={labels.placeholders.description}
          placeholderTextColor={colorRoles.emptyStateDescription}
          multiline
          textAlignVertical="top"
        />
      </FormField>

      <FormField
        label={labels.fields.ticketUrl}
        helper={labels.helpers.ticketUrl}
        error={translateError(fieldErrors.ticketUrl)}
        optionalLabel={labels.optionalFieldLabel}
      >
        <TextInput
          value={form.ticketUrl}
          onChangeText={(value) => onFieldChange('ticketUrl', value)}
          style={inputStyle}
          placeholder="https://"
          placeholderTextColor={colorRoles.emptyStateDescription}
          autoCapitalize="none"
          keyboardType="url"
        />
      </FormField>

      <FormField
        label={labels.fields.websiteUrl}
        helper={labels.helpers.websiteUrl}
        error={translateError(fieldErrors.websiteUrl)}
      >
        <TextInput
          value={form.websiteUrl}
          onChangeText={(value) => onFieldChange('websiteUrl', value)}
          style={inputStyle}
          placeholder="https://"
          placeholderTextColor={colorRoles.emptyStateDescription}
          autoCapitalize="none"
          keyboardType="url"
        />
      </FormField>

      <FormField
        label={labels.fields.instagramUrl}
        helper={labels.helpers.instagramUrl}
        error={translateError(fieldErrors.instagramUrl)}
      >
        <TextInput
          value={form.instagramUrl}
          onChangeText={(value) => onFieldChange('instagramUrl', value)}
          style={inputStyle}
          placeholder="https://"
          placeholderTextColor={colorRoles.emptyStateDescription}
          autoCapitalize="none"
          keyboardType="url"
        />
      </FormField>

      <FormField
        label={labels.fields.facebookUrl}
        helper={labels.helpers.facebookUrl}
        error={translateError(fieldErrors.facebookUrl)}
      >
        <TextInput
          value={form.facebookUrl}
          onChangeText={(value) => onFieldChange('facebookUrl', value)}
          style={inputStyle}
          placeholder="https://"
          placeholderTextColor={colorRoles.emptyStateDescription}
          autoCapitalize="none"
          keyboardType="url"
        />
      </FormField>

      {submitError ? (
        <AppText accessibilityRole="alert" style={styles.submitError}>
          {submitError}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {onPreview ? (
          <SecondaryButton
            label={labels.preview}
            onPress={onPreview}
            disabled={submitting}
          />
        ) : null}
        <PrimaryButton
          label={submitting ? labels.submitting : labels.submit}
          onPress={onSubmit}
          disabled={submitting}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingBottom: spacingRoles.listBottomInset,
  },
  title: {
    ...textRoles.screenTitle,
  },
  subtitle: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    fontSize: textRoles.body.fontSize,
    lineHeight: textRoles.body.lineHeight,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.sm,
  },
  submitError: {
    ...textRoles.metadata,
    color: colors.live,
  },
  actions: {
    gap: spacing.sm,
  },
});
