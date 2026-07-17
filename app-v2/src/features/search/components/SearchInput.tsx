import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search events, artists or venues...',
  testID,
}: SearchInputProps) {
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
        clearButtonMode="while-editing"
        placeholder={placeholder}
        placeholderTextColor={colorRoles.searchPlaceholder}
        returnKeyType="search"
        style={styles.input}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
      />
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
});
