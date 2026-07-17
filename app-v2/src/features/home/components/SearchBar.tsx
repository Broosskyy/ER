import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SearchBarProps {
  onPress?: () => void;
}

export function SearchBar({ onPress }: SearchBarProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search events"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <View style={styles.container} pointerEvents="none">
        <Ionicons
          name="search"
          size={componentSize.iconSm}
          color={colorRoles.searchPlaceholder}
          style={styles.icon}
        />
        <TextInput
          editable={false}
          placeholder="Suche nach Events, Clubs, Künstlern…"
          placeholderTextColor={colorRoles.searchPlaceholder}
          style={styles.input}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.92,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentSize.searchFieldHeight,
    paddingHorizontal: spacingRoles.searchPaddingHorizontal,
    borderRadius: radiusRoles.searchField,
    backgroundColor: colorRoles.searchBackground,
    borderWidth: 1,
    borderColor: colorRoles.searchBorder,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...textRoles.searchInput,
    paddingVertical: 0,
  },
});
