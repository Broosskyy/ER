import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { componentSize } from '@/design/layout';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import { resolveMapPinStyle } from './map-styles';
import type { MapClusterViewModel, MapPinViewModel } from './view-models';

export function EventMapPin({ pin, onPress }: { pin: MapPinViewModel; onPress?: () => void }) {
  const { theme } = useTheme();
  const resolved = resolveMapPinStyle(theme, pin.status);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={pin.accessibilityLabel} accessibilityState={{ selected: pin.status === 'selected' }} onPress={onPress} style={[styles.pin, { backgroundColor: resolved.backgroundColor, borderColor: resolved.borderColor }]}>
      <AppIcon name="location" size="sm" color={resolved.labelColor} />
      {pin.label ? <AppText role="badge" color={resolved.labelColor}>{pin.label}</AppText> : null}
    </Pressable>
  );
}

export function EventMapCluster({ cluster, onPress }: { cluster: MapClusterViewModel; onPress?: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cluster.accessibilityLabel} accessibilityState={{ selected: cluster.selected }} onPress={onPress} style={[styles.cluster, { backgroundColor: cluster.selected ? theme.colors.accent : theme.colors.accentMuted, borderColor: theme.colors.accent }]}>
      <AppText role="bodyStrong" color={cluster.selected ? theme.colors.textOnAccent : theme.colors.accent}>{cluster.count}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pin: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: componentSize.chipHeight, paddingHorizontal: spacing.sm, borderRadius: radii.full, borderWidth: 1 },
  cluster: { minWidth: componentSize.mapClusterSize, minHeight: componentSize.mapClusterSize, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full, borderWidth: 1, paddingHorizontal: spacing.sm },
});
