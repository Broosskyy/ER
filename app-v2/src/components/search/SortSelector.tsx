import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { AppIcon } from '@/components/primitives/AppIcon';
import { borderWidth, radii } from '@/design/radii';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { SortViewModel } from './view-models';

export interface SortSelectorProps {
  options: SortViewModel[];
  onSelect?: (id: SortViewModel['id']) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Sort options — mockup 10 filter row ("Sortieren"). */
export function SortSelector({ options, onSelect, style, testID }: SortSelectorProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.list, style]} testID={testID} accessibilityRole="radiogroup">
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
          <AppText role={option.selected ? 'bodyStrong' : 'body'} color={option.selected ? theme.colors.accent : undefined}>
            {option.label}
          </AppText>
          {option.selected ? <AppIcon name="checkmark" size="sm" color={theme.colors.accent} /> : null}
        </Pressable>
      ))}
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
