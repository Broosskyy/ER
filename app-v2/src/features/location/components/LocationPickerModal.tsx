import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import type { UserLocationErrorCode } from '@/features/location/types/user-location';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface LocationPickerModalProps {
  visible: boolean;
  loading: boolean;
  errorCode: UserLocationErrorCode | null;
  onClose: () => void;
  onUseCurrentLocation: () => void;
}

function resolveErrorMessage(
  errorCode: UserLocationErrorCode | null,
  t: ReturnType<typeof useAppTranslation>['t'],
): string | null {
  if (!errorCode) {
    return null;
  }

  if (errorCode === 'permission_denied') {
    return t('home.location.permissionDenied');
  }

  if (errorCode === 'permission_blocked') {
    return t('home.location.permissionBlocked');
  }

  if (errorCode === 'unavailable') {
    return t('home.location.unavailable');
  }

  return t('home.location.error');
}

export function LocationPickerModal({
  visible,
  loading,
  errorCode,
  onClose,
  onUseCurrentLocation,
}: LocationPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const errorMessage = resolveErrorMessage(errorCode, t);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.actions.close')}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <AppText accessibilityRole="header" style={styles.title}>
            {t('home.location.modalTitle')}
          </AppText>
          <AppText style={styles.description}>{t('home.location.modalDescription')}</AppText>

          {errorMessage ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {errorMessage}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              label={loading ? t('home.location.loading') : t('home.location.useCurrent')}
              onPress={onUseCurrentLocation}
              disabled={loading}
            />
            <SecondaryButton label={t('common.actions.close')} onPress={onClose} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radiusRoles.card,
    borderTopRightRadius: radiusRoles.card,
    paddingHorizontal: spacingRoles.screenHorizontal,
    paddingTop: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...textRoles.screenTitle,
  },
  description: {
    ...textRoles.body,
    color: colorRoles.emptyStateDescription,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
