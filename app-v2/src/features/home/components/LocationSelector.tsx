import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CitySelector } from '@/components';
import { LocationPickerModal } from '@/features/location/components/LocationPickerModal';
import { getManualDiscoveryCityOptions } from '@/features/location/discovery-city-options';
import { useHomeRadiusPreference } from '@/features/location/hooks/use-home-radius-preference';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export function LocationSelector() {
  const { t } = useAppTranslation();
  const { theme } = useTheme();
  const { displayLabel, loading, errorCode, location, requestCurrentLocation, selectDiscoveryCity, clearLocation } =
    useUserLocation();
  const { radiusKm, options: radiusOptions, setRadiusKm } = useHomeRadiusPreference();
  const [modalVisible, setModalVisible] = useState(false);
  const discoveryCities = getManualDiscoveryCityOptions();

  const handleOpen = () => {
    setModalVisible(true);
  };

  const handleUseCurrentLocation = () => {
    void requestCurrentLocation().then((success) => {
      if (success) {
        setModalVisible(false);
      }
    });
  };

  const handleSelectDiscoveryCity = (city: (typeof discoveryCities)[number]) => {
    void selectDiscoveryCity(city).then((success) => {
      if (success) {
        setModalVisible(false);
      }
    });
  };

  const handleClearLocation = () => {
    void clearLocation().then(() => {
      setModalVisible(false);
    });
  };

  return (
    <>
      <View
        style={styles.row}
        testID="home-location-selector"
        accessibilityLabel={t('home.location.a11y', { location: displayLabel })}
        accessibilityState={{ busy: loading }}
      >
        <CitySelector cityLabel={displayLabel} onPress={handleOpen} />
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.accent} testID="home-location-loading" />
        ) : null}
      </View>

      <LocationPickerModal
        visible={modalVisible}
        loading={loading}
        errorCode={errorCode}
        discoveryCities={discoveryCities}
        selectedDiscoveryCityId={location?.discoveryCityId}
        radiusKm={radiusKm}
        radiusOptions={radiusOptions}
        onRadiusChange={(next) => void setRadiusKm(next)}
        onClose={() => setModalVisible(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
        onSelectDiscoveryCity={handleSelectDiscoveryCity}
        onClearLocation={handleClearLocation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
