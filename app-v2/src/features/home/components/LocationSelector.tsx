import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CitySelector } from '@/components';
import { LocationPickerModal } from '@/features/location/components/LocationPickerModal';
import { getManualDiscoveryCityOptions } from '@/features/location/discovery-city-options';
import { useUserLocation } from '@/features/location/UserLocationProvider';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export function LocationSelector() {
  const { t } = useAppTranslation();
  const { theme } = useTheme();
  const { displayLabel, loading, errorCode, location, requestCurrentLocation, selectDiscoveryCity } =
    useUserLocation();
  const [modalVisible, setModalVisible] = useState(false);
  const discoveryCities = getManualDiscoveryCityOptions();

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

  const handleSelectDiscoveryCity = (city: (typeof discoveryCities)[number]) => {
    void selectDiscoveryCity(city).then((success) => {
      if (success) {
        setModalVisible(false);
      }
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
        <CitySelector cityLabel={displayLabel} disabled={loading} onPress={handleOpen} />
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
        onClose={() => setModalVisible(false)}
        onUseCurrentLocation={handleUseCurrentLocation}
        onSelectDiscoveryCity={handleSelectDiscoveryCity}
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
