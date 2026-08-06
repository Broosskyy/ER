import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';
import { billingRelationLabel } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { LineupBillingRowViewModel } from '@/components/event-detail/view-models';

export interface BillingLineupCardProps {
  row: LineupBillingRowViewModel;
  onArtistPress?: (artistId: string) => void;
  style?: ViewStyle;
}

/** One lineup row with optional billing relation and per-artist navigation. */
export function BillingLineupCard({ row, onArtistPress, style }: BillingLineupCardProps) {
  const { theme } = useTheme();
  const isSolo = row.billingRelation === 'SOLO' || row.artists.length <= 1;
  const separator = ` ${billingRelationLabel(row.billingRelation)} `;

  return (
    <CardFoundation padding="md" style={style}>
      <View style={styles.row}>
        <View style={[styles.avatarFallback, { backgroundColor: theme.colors.surfaceSubtle }]}>
          <AppIcon name="headset-outline" size="md" colorRole="accent" />
        </View>
        <View style={styles.copy}>
          {isSolo ? (
            <Pressable
              disabled={!row.artists[0]?.profileNavigable || !row.artists[0]?.id || !onArtistPress}
              onPress={
                row.artists[0]?.profileNavigable && row.artists[0]?.id && onArtistPress
                  ? () => onArtistPress(row.artists[0]!.id!)
                  : undefined
              }
            >
              <AppText role="bodyStrong" numberOfLines={2}>
                {row.artists[0]?.name ?? ''}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.nameRow}>
              {row.artists.map((artist, index) => (
                <View key={artist.id ?? artist.name} style={styles.nameSegment}>
                  {index > 0 ? (
                    <AppText role="bodyMuted" color={theme.colors.textSecondary}>
                      {separator.trim()}
                    </AppText>
                  ) : null}
                  <Pressable
                    disabled={!artist.profileNavigable || !artist.id || !onArtistPress}
                    onPress={
                      artist.profileNavigable && artist.id && onArtistPress
                        ? () => onArtistPress(artist.id!)
                        : undefined
                    }
                  >
                    <AppText
                      role="bodyStrong"
                      color={
                        artist.profileNavigable && artist.id
                          ? theme.colors.accent
                          : theme.colors.textPrimary
                      }
                      numberOfLines={1}
                    >
                      {artist.name}
                    </AppText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </CardFoundation>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarFallback: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.xxl / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nameSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
