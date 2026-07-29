import { StyleSheet, View, ViewStyle } from 'react-native';

import { CardFoundation } from '@/components/cards/CardFoundation';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { VerificationBadge } from '@/components/profiles/VerificationBadge';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { EventImage } from './EventImage';
import type { LineupItemViewModel } from './view-models';

export interface ArtistLineupCardProps {
  artist: LineupItemViewModel;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Artist lineup card — foundation for profile navigation, follow, and claim flows.
 */
export function ArtistLineupCard({ artist, onPress, style }: ArtistLineupCardProps) {
  const { theme } = useTheme();

  return (
    <CardFoundation padding="md" onPress={onPress} style={style}>
      <View style={styles.row}>
        {artist.image ? (
          <EventImage source={artist.image} variant="compact" style={styles.image} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: theme.colors.surfaceSubtle }]}>
            <AppIcon name="headset-outline" size="md" colorRole="accent" />
          </View>
        )}
        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <AppText role="bodyStrong" numberOfLines={1}>
              {artist.name}
            </AppText>
            {artist.headliner ? (
              <AppText role="badge" color={theme.colors.accent}>
                Headliner
              </AppText>
            ) : null}
          </View>
          {artist.subtitleLabel ? (
            <AppText role="bodyMuted" numberOfLines={1}>
              {artist.subtitleLabel}
            </AppText>
          ) : null}
          {!artist.profileNavigable ? (
            <VerificationBadge status="unverified" />
          ) : null}
        </View>
        {onPress ? <AppIcon name="chevron-forward" size="sm" colorRole="muted" /> : null}
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
  image: {
    width: spacing.xxl,
    height: spacing.xxl,
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
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
