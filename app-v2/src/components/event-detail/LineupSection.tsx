import { StyleSheet, View, ViewStyle } from 'react-native';

import { ArtistLineupCard } from '@/components/discovery/ArtistLineupCard';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { LineupSectionViewModel } from './view-models';

export interface LineupSectionProps {
  lineup: LineupSectionViewModel;
  title?: string;
  onArtistPress?: (artistId: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Line-up block with artist cards or high-quality placeholder. */
export function LineupSection({
  lineup,
  title = 'LINE-UP',
  onArtistPress,
  style,
  testID,
}: LineupSectionProps) {
  const { theme } = useTheme();
  const isEmpty = lineup.tba || lineup.artists.length === 0;

  return (
    <Section title={title} style={style} testID={testID}>
      {isEmpty ? (
        <CardFoundation padding="md">
          <View style={styles.placeholder}>
            <AppIcon name="musical-notes-outline" size="lg" colorRole="muted" />
            <AppText role="bodyMuted" color={theme.colors.textSecondary} style={styles.placeholderText}>
              {lineup.placeholderMessage ?? 'Line-up wird bald bekannt gegeben.'}
            </AppText>
          </View>
        </CardFoundation>
      ) : (
        <Stack gap="sm">
          {lineup.artists.map((artist) => (
            <ArtistLineupCard
              key={artist.id ?? artist.name}
              artist={artist}
              onPress={
                artist.profileNavigable && artist.id && onArtistPress
                  ? () => onArtistPress(artist.id!)
                  : undefined
              }
            />
          ))}
        </Stack>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  placeholderText: {
    textAlign: 'center',
  },
});
