import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';
import { LocationPickerModal } from '@/features/location/components/LocationPickerModal';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

export function LocationSelector() {
  const { t } = useAppTranslation();
  const { displayLabel, loading, errorCode, requestCurrentLocation } = useUserLocation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleOpen = () => {
    if (loading) {
      return;
    }
    setModalVisible(true);
  };

  const handleUseCurrentLocation = () => {
    void requestCurrentLocation().then((success) => {
      if (success) {
        setModalVisible(false);
      }
    });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('home.location.a11y', { location: displayLabel })}
        accessibilityState={{ busy: loading }}
        onPress={handleOpen}
        disabled={loading}
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        testID="home-location-selector"
      >
        <Ionicons name="location" size={componentSize.iconSm} color={colors.primary} />
        <AppText style={styles.label} numberOfLines={1}>
          {displayLabel}
        </AppText>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={componentSize.iconSm} color={colors.textPrimary} />
        )}
      </Pressable>

      <LocationPickerModal
        visible={modalVisible}
        loading={loading}
        errorCode={errorCode}
        onClose={() => setModalVisible(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    minHeight: componentSize.chipHeight,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radiusRoles.chip,
    backgroundColor: colorRoles.chipBackground,
    borderWidth: 1,
    borderColor: colorRoles.chipBorder,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    ...textRoles.cardSubtitle,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
});
