import { StyleSheet, View, ViewStyle } from 'react-native';

import { ArtistLineupCard } from '@/components/discovery/ArtistLineupCard';
import { BillingLineupCard } from '@/components/event-detail/BillingLineupCard';
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
  title = lineup.sectionTitle ?? 'LINE-UP',
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
      ) : lineup.billingRows && lineup.billingRows.length > 0 ? (
        <Stack gap="sm">
          {lineup.billingRows.map((row) =>
            row.billingRelation === 'SOLO' || row.artists.length <= 1 ? (
              <ArtistLineupCard
                key={row.id}
                artist={row.artists[0]!}
                onPress={
                  row.artists[0]?.profileNavigable && row.artists[0]?.id && onArtistPress
                    ? () => onArtistPress(row.artists[0]!.id!)
                    : undefined
                }
              />
            ) : (
              <BillingLineupCard key={row.id} row={row} onArtistPress={onArtistPress} />
            ),
          )}
        </Stack>
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
