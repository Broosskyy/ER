import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { FilterChip } from '@/components/discovery/FilterChip';
import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { componentSize } from '@/design/layout';
import { radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export type RecenterState = 'default' | 'active' | 'loading' | 'disabled' | 'permission_required';

export function RecenterButton({ state = 'default', onPress }: { state?: RecenterState; onPress?: () => void }) {
  const { theme } = useTheme();
  return state === 'loading' ? <View style={styles.iconControl}><ActivityIndicator color={theme.colors.accent} /></View> : (
    <IconButton icon={state === 'permission_required' ? 'location-outline' : 'locate-outline'} accessibilityLabel={state === 'permission_required' ? 'Standortfreigabe erforderlich' : 'Karte zentrieren'} disabled={state === 'disabled'} onPress={onPress} />
  );
}

export function MapFilterButton({ active = false, count, loading = false, disabled = false, onPress }: { active?: boolean; count?: number; loading?: boolean; disabled?: boolean; onPress?: () => void }) {
  return <FilterChip label="Filter" icon="options-outline" count={count} selected={active} disabled={disabled || loading} onPress={onPress} />;
}

export function DiscoveryGridMapToggle({
  value,
  onChange,
}: {
  value: 'grid' | 'map';
  onChange?: (value: 'grid' | 'map') => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[styles.toggle, { borderColor: theme.colors.borderSubtle }]}
      accessibilityRole="tablist"
    >
      {(['grid', 'map'] as const).map((item) => (
        <Pressable
          key={item}
          accessibilityRole="tab"
          accessibilityState={{ selected: item === value }}
          accessibilityLabel={item === 'grid' ? 'Explore-Grid' : 'Kartenansicht'}
          onPress={() => onChange?.(item)}
          style={[
            styles.toggleItem,
            { backgroundColor: item === value ? theme.colors.accentMuted : theme.colors.transparent },
          ]}
        >
          <AppIcon
            name={item === 'grid' ? 'grid-outline' : 'map-outline'}
            size="sm"
            color={item === value ? theme.colors.accent : theme.colors.textSecondary}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** @deprecated Use DiscoveryGridMapToggle */
export function MapListToggle({ value, onChange }: { value: 'map' | 'list'; onChange?: (value: 'map' | 'list') => void }) {
  const mapped: 'grid' | 'map' = value === 'map' ? 'map' : 'grid';
  return (
    <DiscoveryGridMapToggle
      value={mapped}
      onChange={(next) => onChange?.(next === 'map' ? 'map' : 'list')}
    />
  );
}

export function CitySelector({ cityLabel, selected = false, disabled = false, onPress }: { cityLabel: string; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  const { theme } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ort: ${cityLabel}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.city, { borderColor: selected ? theme.colors.accent : theme.colors.borderSubtle, backgroundColor: theme.colors.surface }]}><AppIcon name="location-outline" size="sm" color={theme.colors.accent} /><AppText role="label">{cityLabel}</AppText><AppIcon name="chevron-down" size="sm" color={theme.colors.textSecondary} /></Pressable>;
}

export function DistanceChip({ label, selected = false, disabled = false, onPress }: { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  return <FilterChip label={label} selected={selected} disabled={disabled} onPress={onPress} />;
}

const styles = StyleSheet.create({
  iconControl: { width: componentSize.iconButtonSize, height: componentSize.iconButtonSize, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', overflow: 'hidden', borderRadius: radii.md, borderWidth: 1 },
  toggleItem: { minWidth: componentSize.iconButtonSize, minHeight: componentSize.iconButtonSize, alignItems: 'center', justifyContent: 'center' },
  city: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: componentSize.chipHeight, paddingHorizontal: spacing.sm, borderRadius: radii.full, borderWidth: 1 },
});
