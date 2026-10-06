import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { SavedSortViewModel } from './view-models';

export interface SavedSortSelectorProps {
  options: SavedSortViewModel[];
  onSelect?: (id: SavedSortViewModel['id']) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 14 "Neueste zuerst" sort control — UI-only. */
export function SavedSortSelector({ options, onSelect, style, testID }: SavedSortSelectorProps) {
  const { theme } = useTheme();
  const selected = options.find((option) => option.selected) ?? options[0];

  return (
    <View style={[styles.list, style]} testID={testID}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.selected }}
          accessibilityLabel={option.label}
          onPress={() => onSelect?.(option.id)}
          style={({ pressed }) => [
            styles.option,
            {
              borderColor: option.selected ? theme.colors.accent : theme.colors.borderSubtle,
              backgroundColor: option.selected ? theme.colors.accentMuted : theme.colors.surface,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <AppText role={option.selected ? 'bodyStrong' : 'body'}>
            {option.label}
          </AppText>
          {option.selected ? <AppIcon name="checkmark" size="sm" color={theme.colors.accent} /> : null}
        </Pressable>
      ))}
      {selected ? (
        <AppText role="caption" color={theme.colors.textSecondary}>
          Aktiv: {selected.label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: borderWidth.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
