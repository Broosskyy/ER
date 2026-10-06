import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { AppText } from '@/components/layout/AppText';
import { BottomSheet } from '@/components/overlay/BottomSheet';
import { spacing } from '@/design/spacing';

import type { MapClub } from '../types/discovery-models';

export interface MapClubPreviewBottomSheetProps {
  visible: boolean;
  club?: MapClub;
  onClose: () => void;
}

export function MapClubPreviewBottomSheet({ visible, club, onClose }: MapClubPreviewBottomSheetProps) {
  const router = useRouter();

  if (!club) {
    return null;
  }

  return (
    <BottomSheet
      visible={visible}
      title="Club"
      onClose={onClose}
      testID="map-club-preview-sheet"
      footer={
        <PrimaryButton
          label="Club Detail öffnen"
          onPress={() => {
            onClose();
            router.push({
              pathname: '/(tabs)/search',
              params: { query: club.title },
            });
          }}
        />
      }
    >
      {club.image ? <Image source={club.image} style={styles.hero} resizeMode="cover" /> : null}
      <View style={styles.content}>
        <AppText role="titleMedium">{club.title}</AppText>
        <AppText role="bodyMuted">{club.cityLabel}</AppText>
        <AppText role="caption">
          {club.logoReady ? 'Logo vorbereitet' : 'Logo folgt'}
        </AppText>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 160,
    borderRadius: 16,
  },
  content: {
    gap: spacing.xs,
  },
});
