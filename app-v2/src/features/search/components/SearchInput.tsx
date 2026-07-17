import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colorRoles, colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search events, artists or venues...',
  testID,
  autoFocus = false,
}: SearchInputProps) {
  const hasValue = value.trim().length > 0;

  return (
    <View style={styles.container}>
      <Ionicons
        name="search"
        size={componentSize.iconMd}
        color={colorRoles.searchPlaceholder}
        style={styles.icon}
      />
      <TextInput
        accessibilityRole="search"
        accessibilityLabel="Search events"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        clearButtonMode="never"
        placeholder={placeholder}
        placeholderTextColor={colorRoles.searchPlaceholder}
        returnKeyType="search"
        style={styles.input}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
      />
      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
        >
          <Ionicons name="close-circle" size={componentSize.iconSm} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentSize.searchScreenFieldHeight,
    marginHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.md,
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
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
});
