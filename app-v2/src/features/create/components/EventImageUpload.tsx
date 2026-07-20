import { Image, Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { EventImageDraft } from '@/features/create/types/event-draft-form';

export interface EventImageUploadLabels {
  add: string;
  replace: string;
  remove: string;
  hint: string;
}

export interface EventImageUploadProps {
  label: string;
  helper?: string;
  error?: string;
  image: EventImageDraft | null;
  labels: EventImageUploadLabels;
  disabled?: boolean;
  onPick: () => void;
  onRemove: () => void;
}

export function EventImageUpload({
  label,
  helper,
  error,
  image,
  labels,
  disabled,
  onPick,
  onRemove,
}: EventImageUploadProps) {
  const previewUri = image?.localUri || image?.remoteUrl;

  return (
    <View style={styles.container}>
      <AppText style={styles.label}>{label}</AppText>
      {helper ? <AppText style={styles.helper}>{helper}</AppText> : null}

      {previewUri ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
          <View style={styles.previewActions}>
            <SecondaryButton
              label={labels.replace}
              onPress={onPick}
              disabled={disabled}
            />
            <SecondaryButton
              label={labels.remove}
              onPress={onRemove}
              disabled={disabled}
            />
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onPick}
          disabled={disabled}
          style={({ pressed }) => [
            styles.placeholder,
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <AppText style={styles.placeholderText}>{labels.add}</AppText>
        </Pressable>
      )}

      <AppText style={styles.hint}>{labels.hint}</AppText>
      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...textRoles.cardTitle,
    color: colors.textPrimary,
  },
  helper: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  placeholder: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  placeholderText: {
    ...textRoles.body,
    color: colors.primary,
  },
  previewCard: {
    gap: spacing.sm,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hint: {
    ...textRoles.metadata,
    color: colors.textSecondary,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
});
