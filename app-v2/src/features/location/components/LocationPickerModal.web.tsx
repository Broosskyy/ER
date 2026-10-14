import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { AppText } from '@/components/layout/AppText';
import { colors, colorRoles } from '@/design/colors';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { FilterChip } from '@/features/home/components/FilterChip';
import type { HomeRadiusKm } from '@/features/location/home-location-preferences';
import type { UserLocationErrorCode } from '@/features/location/types/user-location';
import type { ManualDiscoveryCityOption } from '@/features/location/UserLocationProvider';
import { filterDiscoveryCityOptions } from '@/features/location/discovery-city-options';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export interface LocationPickerModalProps {
  visible: boolean;
  loading: boolean;
  errorCode: UserLocationErrorCode | null;
  discoveryCities: ManualDiscoveryCityOption[];
  selectedDiscoveryCityId?: string;
  radiusKm: HomeRadiusKm;
  radiusOptions: readonly HomeRadiusKm[];
  onRadiusChange: (radiusKm: HomeRadiusKm) => void;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onSelectDiscoveryCity: (city: ManualDiscoveryCityOption) => void;
  onClearLocation?: () => void;
}

function resolveErrorMessage(
  errorCode: UserLocationErrorCode | null,
  t: ReturnType<typeof useAppTranslation>['t'],
): string | null {
  if (!errorCode) return null;
  if (errorCode === 'permission_denied') return t('home.location.permissionDenied');
  if (errorCode === 'permission_blocked') return t('home.location.permissionBlocked');
  if (errorCode === 'unavailable') return t('home.location.unavailable');
  if (errorCode === 'timeout') return t('home.location.timeout');
  if (errorCode === 'insecure_context') return t('home.location.insecureContext');
  if (errorCode === 'network') return t('home.location.network');
  return t('home.location.error');
}

export function LocationPickerModal({
  visible,
  loading,
  errorCode,
  discoveryCities,
  selectedDiscoveryCityId,
  radiusKm,
  radiusOptions,
  onRadiusChange,
  onClose,
  onUseCurrentLocation,
  onSelectDiscoveryCity,
  onClearLocation,
}: LocationPickerModalProps) {
  const { t } = useAppTranslation();
  const [cityQuery, setCityQuery] = useState('');
  const errorMessage = resolveErrorMessage(errorCode, t);

  const filteredCities = useMemo(
    () => filterDiscoveryCityOptions(discoveryCities, cityQuery),
    [cityQuery, discoveryCities],
  );

  if (!visible || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <View style={styles.overlay} testID="location-picker-modal">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.actions.close')}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={styles.sheet}>
        <AppText accessibilityRole="header" style={styles.title}>
          {t('home.location.modalTitle')}
        </AppText>
        <AppText style={styles.description}>{t('home.location.modalDescription')}</AppText>

        <AppText style={styles.sectionLabel}>{t('home.location.deviceSection')}</AppText>
        <PrimaryButton
          label={loading ? t('home.location.loading') : t('home.location.useCurrent')}
          onPress={onUseCurrentLocation}
          disabled={loading}
        />

        <AppText style={styles.sectionLabel}>{t('home.location.discoveryCitySection')}</AppText>
        <TextInput
          accessibilityLabel={t('home.location.citySearch', { defaultValue: 'Stadt suchen' })}
          placeholder={t('home.location.citySearchPlaceholder', { defaultValue: 'Stadt oder PLZ' })}
          placeholderTextColor={colorRoles.emptyStateDescription}
          value={cityQuery}
          onChangeText={setCityQuery}
          style={styles.citySearchInput}
          autoCapitalize="words"
          autoCorrect={false}
          testID="location-city-search"
        />
        <View style={styles.cityChips}>
          {filteredCities.map((city) => (
            <View key={city.id} testID={`location-city-${city.id}`}>
              <FilterChip
                label={city.label}
                selected={selectedDiscoveryCityId === city.id}
                onPress={() => onSelectDiscoveryCity(city)}
              />
            </View>
          ))}
        </View>
        {cityQuery.trim() && filteredCities.length === 0 ? (
          <AppText style={styles.hint}>
            {t('home.location.noCityMatch', { defaultValue: 'Keine Stadt gefunden.' })}
          </AppText>
        ) : null}

        <AppText style={styles.sectionLabel}>
          {t('home.location.radiusSection', { defaultValue: 'Umkreis' })}
        </AppText>
        <View style={styles.cityChips}>
          {radiusOptions.map((option) => (
            <FilterChip
              key={option}
              label={`${option} km`}
              selected={radiusKm === option}
              onPress={() => onRadiusChange(option)}
            />
          ))}
        </View>

        {onClearLocation ? (
          <SecondaryButton
            label={t('home.location.clear', { defaultValue: 'Standort zurücksetzen' })}
            onPress={onClearLocation}
            disabled={loading}
          />
        ) : null}

        {errorMessage ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </AppText>
        ) : null}

        <SecondaryButton label={t('common.actions.close')} onPress={onClose} disabled={loading} />
      </View>
    </View>,
    document.body,
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed' as never,
    inset: 0 as never,
    zIndex: 10000,
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
    paddingBottom: spacing.lg,
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
  sectionLabel: {
    ...textRoles.metadata,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  citySearchInput: {
    ...textRoles.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radiusRoles.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  cityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  hint: {
    ...textRoles.metadata,
    color: colorRoles.emptyStateDescription,
  },
  error: {
    ...textRoles.metadata,
    color: colors.live,
  },
});
