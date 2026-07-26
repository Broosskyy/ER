import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { ProfileStatViewModel } from './view-models';

export interface ProfileStatsProps {
  stats: ProfileStatViewModel[];
  onStatPress?: (stat: ProfileStatViewModel) => void;
  style?: StyleProp<ViewStyle>;
}

/** Stateless profile counts from mockup 38. */
export function ProfileStats({ stats, onStatPress, style }: ProfileStatsProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, style]} accessibilityLabel="Profilstatistiken">
      {stats.map((stat) => {
        const content = (
          <>
            <AppText role="titleSmall">{stat.valueLabel}</AppText>
            <AppText role="caption" color={theme.colors.textSecondary}>{stat.label}</AppText>
          </>
        );
        return onStatPress ? (
          <Pressable key={stat.id} accessibilityRole="button" accessibilityLabel={`${stat.valueLabel} ${stat.label}`} onPress={() => onStatPress(stat)} style={styles.stat}>
            {content}
          </Pressable>
        ) : <View key={stat.id} style={styles.stat}>{content}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-around', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
});
