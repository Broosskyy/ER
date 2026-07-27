import { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GhostButton } from '@/components/buttons/GhostButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Banner } from '@/components/feedback/Banner';
import { AppText } from '@/components/layout/AppText';
import { Stack } from '@/components/layout/Stack';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FormField } from '@/features/create/components/FormField';
import { EventImagesSection, type EventImagesSectionLabels } from '@/features/create/components/EventImagesSection';
import { GenrePicker } from '@/features/create/components/GenrePicker';
import { VenueAutocomplete } from '@/features/create/components/VenueAutocomplete';
import type { VenueRecord } from '@/data/types/records';
import type { EventDraftFieldErrors, EventDraftValidationKey } from '@/features/create/types/event-draft-form';
import { FilterChip } from '@/features/home/components/FilterChip';

import type { EventFormData, LineupEntry } from '@/features/create/wizard/wizard-types';
import { createLineupEntry } from '@/features/create/wizard/wizard-types';
import type { WizardStepId } from '@/features/create/wizard/wizard-steps';

const TICKET_MODES = [
  { id: 'free', label: 'Kostenlos' },
  { id: 'external', label: 'Externer Anbieter' },
  { id: 'none', label: 'Kein Ticket erforderlich' },
] as const;

const TICKET_PROVIDERS = [
  'Resident Advisor',
  'Shotgun',
  'DICE',
  'Eventbrite',
  'Club-Website',
  'Eigener Anbieter',
] as const;

export interface WizardStepContentProps {
  stepId: WizardStepId;
  formData: EventFormData;
  fieldErrors: EventDraftFieldErrors;
  extensionError?: string;
  submitIssues?: string[];
  genreOptions: Array<{ id: string; label: string }>;
  venues: VenueRecord[];
  imageLabels: EventImagesSectionLabels;
  disabled?: boolean;
  onFormDataChange: (updater: (current: EventFormData) => EventFormData) => void;
  translateError: (key?: EventDraftValidationKey) => string | undefined;
}

export function WizardStepContent({
  stepId,
  formData,
  fieldErrors,
  extensionError,
  submitIssues,
  genreOptions,
  venues,
  imageLabels,
  disabled,
  onFormDataChange,
  translateError,
}: WizardStepContentProps) {
  const inputStyle = useMemo(() => styles.input, []);
  const { core, extension } = formData;

  const updateCore = <K extends keyof typeof core>(field: K, value: (typeof core)[K]) => {
    onFormDataChange((current) => ({
      ...current,
      core: { ...current.core, [field]: value },
    }));
  };

  const updateExtension = <K extends keyof typeof extension>(
    field: K,
    value: (typeof extension)[K],
  ) => {
    onFormDataChange((current) => ({
      ...current,
      extension: { ...current.extension, [field]: value },
    }));
  };

  const renderLineup = () => (
    <Stack gap="md">
      <AppText role="bodyMuted">
        Füge Artists hinzu. Die Reihenfolge entspricht der Anzeige im Event Detail.
      </AppText>
      {extension.lineup.length === 0 ? (
        <Banner
          title="Noch kein Line-up"
          message="Du kannst diesen Schritt überspringen, wenn das Line-up noch nicht feststeht."
          variant="info"
        />
      ) : null}
      {extension.lineup.map((entry, index) => (
        <LineupEditorRow
          key={entry.id}
          entry={entry}
          disabled={disabled}
          onChange={(next) => {
            const lineup = [...extension.lineup];
            lineup[index] = next;
            updateExtension('lineup', lineup);
          }}
          onRemove={() => updateExtension('lineup', extension.lineup.filter((item) => item.id !== entry.id))}
          onMoveUp={
            index > 0
              ? () => {
                  const lineup = [...extension.lineup];
                  const [item] = lineup.splice(index, 1);
                  lineup.splice(index - 1, 0, item!);
                  updateExtension('lineup', lineup);
                }
              : undefined
          }
          onMoveDown={
            index < extension.lineup.length - 1
              ? () => {
                  const lineup = [...extension.lineup];
                  const [item] = lineup.splice(index, 1);
                  lineup.splice(index + 1, 0, item!);
                  updateExtension('lineup', lineup);
                }
              : undefined
          }
        />
      ))}
      <PrimaryButton
        label="Artist hinzufügen"
        onPress={() => updateExtension('lineup', [...extension.lineup, createLineupEntry('Neuer Artist')])}
        disabled={disabled}
      />
    </Stack>
  );

  switch (stepId) {
    case 'organizer':
      return (
        <Stack gap="md">
          <FormField label="Veranstaltername" error={extensionError} required>
            <TextInput
              value={extension.organizerDisplayName}
              onChangeText={(value) => updateExtension('organizerDisplayName', value)}
              style={inputStyle}
              placeholder="z. B. VOID Events"
              editable={!disabled}
            />
          </FormField>
          <FormField label="Kontakt-E-Mail" helper="Nur intern sichtbar, nicht öffentlich">
            <TextInput
              value={extension.organizerContactEmail}
              onChangeText={(value) => updateExtension('organizerContactEmail', value)}
              style={inputStyle}
              placeholder="kontakt@veranstalter.de"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!disabled}
            />
          </FormField>
        </Stack>
      );

    case 'basics':
      return (
        <Stack gap="md">
          <FormField label="Eventname" error={translateError(fieldErrors.title)} required>
            <TextInput
              value={core.title}
              onChangeText={(value) => updateCore('title', value)}
              style={inputStyle}
              placeholder="Name deines Events"
              editable={!disabled}
            />
          </FormField>
          <FormField label="Untertitel" optionalLabel="optional">
            <TextInput
              value={extension.subtitle}
              onChangeText={(value) => updateExtension('subtitle', value)}
              style={inputStyle}
              placeholder="Optionaler Untertitel"
              editable={!disabled}
            />
          </FormField>
        </Stack>
      );

    case 'schedule':
      return (
        <Stack gap="md">
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <FormField label="Startdatum" error={translateError(fieldErrors.startDate)} required>
                <TextInput
                  value={core.startDate}
                  onChangeText={(value) => updateCore('startDate', value)}
                  style={inputStyle}
                  placeholder="TT.MM.JJJJ"
                  editable={!disabled}
                />
              </FormField>
            </View>
            <View style={styles.rowItem}>
              <FormField label="Startzeit" error={translateError(fieldErrors.startTime)} required>
                <TextInput
                  value={core.startTime}
                  onChangeText={(value) => updateCore('startTime', value)}
                  style={inputStyle}
                  placeholder="HH:MM"
                  editable={!disabled}
                />
              </FormField>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <FormField label="Enddatum" error={translateError(fieldErrors.endDate)} optionalLabel="optional">
                <TextInput
                  value={core.endDate}
                  onChangeText={(value) => updateCore('endDate', value)}
                  style={inputStyle}
                  placeholder="TT.MM.JJJJ"
                  editable={!disabled}
                />
              </FormField>
            </View>
            <View style={styles.rowItem}>
              <FormField label="Endzeit" error={translateError(fieldErrors.endTime)} optionalLabel="optional">
                <TextInput
                  value={core.endTime}
                  onChangeText={(value) => updateCore('endTime', value)}
                  style={inputStyle}
                  placeholder="HH:MM"
                  editable={!disabled}
                />
              </FormField>
            </View>
          </View>
          <FormField label="Einlass" optionalLabel="optional">
            <TextInput
              value={extension.doorsOpen}
              onChangeText={(value) => updateExtension('doorsOpen', value)}
              style={inputStyle}
              placeholder="z. B. 22:00"
              editable={!disabled}
            />
          </FormField>
        </Stack>
      );

    case 'venue':
      return (
        <Stack gap="md">
          <VenueAutocomplete
            label="Club oder Venue"
            error={translateError(fieldErrors.venueText)}
            required={!extension.secretLocation}
            venues={venues}
            venueId={core.venueId}
            venueText={core.venueText}
            onVenueIdChange={(venueId) => updateCore('venueId', venueId)}
            onVenueTextChange={(venueText) => updateCore('venueText', venueText)}
            placeholder="Venue suchen oder eingeben"
            freeTextHint="Du kannst einen bestehenden Club wählen oder einen neuen Namen eingeben."
          />
          <FormField label="Stadt" error={extensionError} required={!extension.secretLocation}>
            <TextInput
              value={extension.city}
              onChangeText={(value) => updateExtension('city', value)}
              style={inputStyle}
              placeholder="Stadt"
              editable={!disabled}
            />
          </FormField>
          <View style={styles.chips}>
            <FilterChip
              label="Geheime Location"
              selected={extension.secretLocation}
              onPress={() => updateExtension('secretLocation', !extension.secretLocation)}
            />
            <FilterChip
              label="Indoor"
              selected={extension.indoorOutdoor === 'indoor'}
              onPress={() => updateExtension('indoorOutdoor', 'indoor')}
            />
            <FilterChip
              label="Outdoor"
              selected={extension.indoorOutdoor === 'outdoor'}
              onPress={() => updateExtension('indoorOutdoor', 'outdoor')}
            />
          </View>
        </Stack>
      );

    case 'genres':
      return (
        <GenrePicker
          label="Genres"
          helper="Wähle mindestens ein Genre."
          error={translateError(fieldErrors.genreId)}
          required
          options={genreOptions}
          value={core.genreId}
          onChange={(genreId) => {
            updateCore('genreId', genreId);
            updateExtension('genreIds', [genreId]);
          }}
          multiple
          selectedIds={extension.genreIds.length > 0 ? extension.genreIds : core.genreId ? [core.genreId] : []}
          onChangeMultiple={(genreIds) => {
            updateExtension('genreIds', genreIds);
            updateCore('genreId', genreIds[0] ?? '');
          }}
        />
      );

    case 'lineup':
      return renderLineup();

    case 'description':
      return (
        <Stack gap="md">
          <FormField label="Kurzbeschreibung" optionalLabel="optional">
            <TextInput
              value={extension.shortDescription}
              onChangeText={(value) => updateExtension('shortDescription', value)}
              style={[inputStyle, styles.textArea]}
              multiline
              textAlignVertical="top"
              editable={!disabled}
            />
          </FormField>
          <FormField label="Beschreibung" error={translateError(fieldErrors.description)} required>
            <TextInput
              value={core.description}
              onChangeText={(value) => updateCore('description', value)}
              style={[inputStyle, styles.textArea]}
              multiline
              textAlignVertical="top"
              editable={!disabled}
            />
          </FormField>
          <FormField label="Hinweise" optionalLabel="optional">
            <TextInput
              value={extension.awarenessNotes}
              onChangeText={(value) => updateExtension('awarenessNotes', value)}
              style={[inputStyle, styles.textArea]}
              multiline
              textAlignVertical="top"
              editable={!disabled}
            />
          </FormField>
        </Stack>
      );

    case 'media':
      return (
        <EventImagesSection
          coverImage={core.coverImage}
          flyerImage={core.flyerImage}
          labels={imageLabels}
          disabled={disabled}
          onImageChange={(field, value) => updateCore(field, value)}
          onImageError={() => undefined}
          translateError={(key) => (key ? translateError(key as EventDraftValidationKey) : undefined)}
        />
      );

    case 'tickets':
      return (
        <Stack gap="md">
          <View style={styles.chips}>
            {TICKET_MODES.map((mode) => (
              <FilterChip
                key={mode.id}
                label={mode.label}
                selected={extension.ticketMode === mode.id}
                onPress={() => updateExtension('ticketMode', mode.id)}
              />
            ))}
          </View>
          {extension.ticketMode === 'external' ? (
            <>
              <FormField label="Ticketanbieter">
                <View style={styles.chips}>
                  {TICKET_PROVIDERS.map((provider) => (
                    <FilterChip
                      key={provider}
                      label={provider}
                      selected={extension.ticketProvider === provider}
                      onPress={() => updateExtension('ticketProvider', provider)}
                    />
                  ))}
                </View>
              </FormField>
              <FormField label="Ticketlink" error={translateError(fieldErrors.ticketUrl)} required>
                <TextInput
                  value={core.ticketUrl}
                  onChangeText={(value) => updateCore('ticketUrl', value)}
                  style={inputStyle}
                  placeholder="https://"
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!disabled}
                />
              </FormField>
            </>
          ) : null}
        </Stack>
      );

    case 'social':
      return (
        <Stack gap="md">
          {(['websiteUrl', 'instagramUrl', 'facebookUrl'] as const).map((field) => (
            <FormField
              key={field}
              label={field === 'websiteUrl' ? 'Website' : field === 'instagramUrl' ? 'Instagram' : 'Facebook'}
              error={translateError(fieldErrors[field])}
              optionalLabel="optional"
            >
              <TextInput
                value={core[field]}
                onChangeText={(value) => updateCore(field, value)}
                style={inputStyle}
                placeholder="https://"
                autoCapitalize="none"
                keyboardType="url"
                editable={!disabled}
              />
            </FormField>
          ))}
          <FormField label="TikTok" optionalLabel="optional">
            <TextInput
              value={extension.tiktokUrl}
              onChangeText={(value) => updateExtension('tiktokUrl', value)}
              style={inputStyle}
              placeholder="https://"
              autoCapitalize="none"
              keyboardType="url"
              editable={!disabled}
            />
          </FormField>
        </Stack>
      );

    case 'submit':
      return (
        <Stack gap="md">
          <Banner title="Einreichungsübersicht" message="Prüfe deine Angaben vor dem Absenden." variant="info" />
          <SummaryRow label="Event" value={core.title || '—'} />
          <SummaryRow label="Datum" value={`${core.startDate} ${core.startTime}`.trim() || '—'} />
          <SummaryRow label="Ort" value={core.venueText || extension.city || '—'} />
          <SummaryRow label="Line-up" value={`${extension.lineup.length} Artists`} />
          <SummaryRow
            label="Tickets"
            value={
              extension.ticketMode === 'free'
                ? 'Kostenlos'
                : extension.ticketMode === 'external'
                  ? 'Externer Anbieter'
                  : 'Kein Ticket'
            }
          />
          {submitIssues?.map((issue) => (
            <AppText key={issue} role="caption" style={styles.errorText}>
              {issue}
            </AppText>
          ))}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: extension.legalConfirmed }}
            onPress={() => updateExtension('legalConfirmed', !extension.legalConfirmed)}
            style={styles.checkboxRow}
          >
            <AppText role="body">Ich bestätige die rechtlichen Hinweise.</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: extension.accuracyConfirmed }}
            onPress={() => updateExtension('accuracyConfirmed', !extension.accuracyConfirmed)}
            style={styles.checkboxRow}
          >
            <AppText role="body">Meine Angaben sind korrekt.</AppText>
          </Pressable>
        </Stack>
      );

    default:
      return null;
  }
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText role="caption" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText role="body">{value}</AppText>
    </View>
  );
}

function LineupEditorRow({
  entry,
  disabled,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: LineupEntry;
  disabled?: boolean;
  onChange: (entry: LineupEntry) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <View style={styles.lineupRow}>
      <TextInput
        value={entry.name}
        onChangeText={(name) => onChange({ ...entry, name })}
        style={[styles.input, styles.lineupName]}
        editable={!disabled}
      />
      <TextInput
        value={entry.setTime ?? ''}
        onChangeText={(setTime) => onChange({ ...entry, setTime })}
        style={[styles.input, styles.lineupTime]}
        placeholder="Zeit"
        editable={!disabled}
      />
      <Stack direction="horizontal" gap="xs">
        {onMoveUp ? <GhostButton label="↑" onPress={onMoveUp} /> : null}
        {onMoveDown ? <GhostButton label="↓" onPress={onMoveDown} /> : null}
        <GhostButton label="Entfernen" onPress={onRemove} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    fontSize: textRoles.body.fontSize,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryRow: {
    gap: spacing.xs,
  },
  checkboxRow: {
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: colors.live,
  },
  lineupRow: {
    gap: spacing.sm,
  },
  lineupName: {
    flex: 1,
  },
  lineupTime: {
    width: 96,
  },
});
