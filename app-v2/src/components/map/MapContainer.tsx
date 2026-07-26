import type { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { useTheme } from '@/design/theme';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';

import type { MapContainerState } from './view-models';

export interface MapContainerProps {
  state?: MapContainerState;
  children?: ReactNode;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** UI-only map canvas: no map provider, coordinates, permissions, or network access. */
export function MapContainer({ state = 'default', children, accessibilityLabel, style, testID }: MapContainerProps) {
  const { theme } = useTheme();
  const showLoading = state === 'loading';
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.borderSubtle }, style]}
    >
      <View style={[styles.grid, { borderColor: theme.colors.accentMuted }]} />
      {showLoading ? <ActivityIndicator color={theme.colors.accent} /> : <AppIcon name="map-outline" size="lg" color={theme.colors.accent} />}
      {state !== 'default' && state !== 'loading' ? <AppText role="caption" color={theme.colors.textSecondary}>{stateLabel(state)}</AppText> : null}
      {children}
    </View>
  );
}

function stateLabel(state: Exclude<MapContainerState, 'default' | 'loading'>) {
  return {
    error: 'Karte nicht verfügbar',
    no_permission: 'Standortfreigabe erforderlich',
    location_disabled: 'Standortdienste deaktiviert',
    empty: 'Keine Events im Bereich',
    offline: 'Offline',
  }[state];
}

const styles = StyleSheet.create({
  container: { minHeight: 260, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.lg, borderWidth: 1 },
  grid: { ...StyleSheet.absoluteFill, opacity: 0.45, borderWidth: 1, borderStyle: 'dashed' },
});
